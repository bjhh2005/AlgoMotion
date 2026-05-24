import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { BookOpen, Bot, CheckCircle2, ChevronDown, ClipboardList, Code2, FileText, GitBranch, Layers3, Loader2, MessageSquareText, RotateCcw, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import { analyzeCode, askAi, generateCode, generateStudyArtifacts } from "../api";
import type {
  AiChatMessage,
  AiGraphRelation,
  AiKnowledgeCard,
  AiLearningAction,
  AiNodeCard,
  AiQuizItem,
  AiRecommendedExercise,
  KnowledgeNode
} from "../types";

interface Props {
  selectedNode: KnowledgeNode;
  nodeById: Record<string, KnowledgeNode>;
  onSelect: (nodeId: string) => void;
  onQuizResult?: (nodeId: string, correct: boolean) => void;
}

type AiMode = "chat" | "artifact" | "code";

interface AiWorkspace {
  nodeCards: AiNodeCard[];
  graphRelations: AiGraphRelation[];
  quiz: AiQuizItem[];
  knowledgeCards: AiKnowledgeCard[];
  recommendedExercises: AiRecommendedExercise[];
  learningActions: AiLearningAction[];
  generatedCode: string;
  generatedExplanation: string;
}

type PendingAction = "chat" | "artifact" | "analysis" | "code" | null;
type StudioSectionKey = "quiz" | "cards" | "actions" | "code" | "links";

interface AiSessionSnapshot {
  mode: AiMode;
  message: string;
  code: string;
  sourceText: string;
  messages: AiChatMessage[];
  workspace: AiWorkspace;
  pendingAction: PendingAction;
  quizAnswers: Record<string, string>;
  flippedCards: Record<string, boolean>;
  studioCollapsed: Record<StudioSectionKey, boolean>;
}

const initialWorkspace: AiWorkspace = {
  nodeCards: [],
  graphRelations: [],
  quiz: [],
  knowledgeCards: [],
  recommendedExercises: [],
  learningActions: [],
  generatedCode: "",
  generatedExplanation: ""
};

const AI_SESSION_STORAGE_KEY = "algomotion.ai.session.v1";
const waitingMessageId = "assistant-waiting";

const defaultMessage = "我不会判断这段栈代码为什么可能出错，能帮我讲清楚并给练习吗？";
const defaultCode = "stack<int> s;\ns.pop();";
const defaultSourceText = "栈具有后进先出特性，递归调用会把未完成的函数状态保存在调用栈中。空栈时直接 pop 或 top 是常见错误。";
const promptSuggestions = [
  { label: "讲清概念", value: "请用生活类比解释这个知识点，并指出最容易混淆的地方。" },
  { label: "生成练习", value: "围绕当前知识点生成 3 道由浅入深的练习，并给出解析。" },
  { label: "错因定位", value: "我这段代码哪里可能出错？请关联到知识图谱中的知识点。" }
];

function welcomeMessage(selectedNode: KnowledgeNode): AiChatMessage {
  return {
    id: "assistant-welcome",
    role: "assistant",
    content: `当前聚焦「${selectedNode.name}」。可以提问、粘贴资料生成 Quiz，或让 AI 生成规范 C++ 代码。`,
    linkedNodeIds: [selectedNode.id]
  };
}

function initialWorkspaceForNode(selectedNode: KnowledgeNode): AiWorkspace {
  return {
    ...initialWorkspace,
    nodeCards: [{
      nodeId: selectedNode.id,
      title: selectedNode.name,
      description: selectedNode.description,
      category: selectedNode.category,
      difficulty: selectedNode.difficulty,
      tags: selectedNode.tags,
      reason: selectedNode.description,
      source: "knowledge-graph"
    }]
  };
}

function withoutWaitingMessage(messages: AiChatMessage[]) {
  return messages.filter((item) => item.id !== waitingMessageId);
}

function loadSessionSnapshot(): AiSessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(AI_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiSessionSnapshot>;
    if (!Array.isArray(parsed.messages) || !parsed.workspace) return null;
    return {
      mode: parsed.mode === "artifact" || parsed.mode === "code" ? parsed.mode : "chat",
      message: typeof parsed.message === "string" ? parsed.message : defaultMessage,
      code: typeof parsed.code === "string" ? parsed.code : defaultCode,
      sourceText: typeof parsed.sourceText === "string" ? parsed.sourceText : defaultSourceText,
      messages: withoutWaitingMessage(parsed.messages),
      quizAnswers: typeof parsed.quizAnswers === "object" && parsed.quizAnswers ? parsed.quizAnswers as Record<string, string> : {},
      flippedCards: typeof parsed.flippedCards === "object" && parsed.flippedCards ? parsed.flippedCards as Record<string, boolean> : {},
      studioCollapsed: {
        quiz: false,
        cards: true,
        actions: true,
        code: true,
        links: true,
        ...(typeof parsed.studioCollapsed === "object" && parsed.studioCollapsed ? parsed.studioCollapsed as Partial<Record<StudioSectionKey, boolean>> : {})
      },
      pendingAction:
        parsed.pendingAction === "chat" ||
        parsed.pendingAction === "artifact" ||
        parsed.pendingAction === "analysis" ||
        parsed.pendingAction === "code"
          ? parsed.pendingAction
          : null,
      workspace: {
        ...initialWorkspace,
        ...parsed.workspace
      }
    };
  } catch {
    return null;
  }
}

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function renderAssistantContent(content: string): ReactElement[] {
  const blocks = content
    .replace(/<\/?(details|summary)>/g, "")
    .split(/```/)
    .map((block, index) => ({ block, isCode: index % 2 === 1 }));

  return blocks.flatMap(({ block, isCode }, blockIndex) => {
    if (isCode) {
      const lines = block.replace(/^\w+\n/, "").trim();
      return lines ? [<pre key={`code-${blockIndex}`}><code>{lines}</code></pre>] : [];
    }

    return block.split(/\n+/).map((line, lineIndex) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "---") return null;
      if (/^#{1,6}\s+/.test(trimmed)) {
        return <h5 key={`h-${blockIndex}-${lineIndex}`}>{trimmed.replace(/^#{1,6}\s+/, "")}</h5>;
      }
      if (/^[-*]\s+/.test(trimmed)) {
        return <p key={`li-${blockIndex}-${lineIndex}`} className="markdown-list-line">{renderInlineMarkdown(trimmed.replace(/^[-*]\s+/, ""))}</p>;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        return <p key={`ol-${blockIndex}-${lineIndex}`} className="markdown-list-line ordered">{renderInlineMarkdown(trimmed.replace(/^\d+\.\s+/, ""))}</p>;
      }
      return <p key={`p-${blockIndex}-${lineIndex}`}>{renderInlineMarkdown(trimmed)}</p>;
    }).filter((item): item is ReactElement => item !== null);
  });
}

function mergeWorkspace(current: AiWorkspace, next: Partial<AiWorkspace>): AiWorkspace {
  return {
    ...current,
    ...next,
    nodeCards: next.nodeCards ?? current.nodeCards,
    graphRelations: next.graphRelations ?? current.graphRelations,
    quiz: next.quiz ?? current.quiz,
    knowledgeCards: next.knowledgeCards ?? current.knowledgeCards,
    recommendedExercises: next.recommendedExercises ?? current.recommendedExercises,
    learningActions: next.learningActions ?? current.learningActions
  };
}

export function AiPanel({ selectedNode, nodeById, onSelect, onQuizResult }: Props) {
  const initialSession = useRef<AiSessionSnapshot | null>(null);
  if (initialSession.current === null) {
    initialSession.current = loadSessionSnapshot();
  }

  const [mode, setMode] = useState<AiMode>(initialSession.current?.mode ?? "chat");
  const [message, setMessage] = useState(initialSession.current?.message ?? defaultMessage);
  const [code, setCode] = useState(initialSession.current?.code ?? defaultCode);
  const [sourceText, setSourceText] = useState(initialSession.current?.sourceText ?? defaultSourceText);
  const [messages, setMessages] = useState<AiChatMessage[]>(
    initialSession.current?.messages ?? [welcomeMessage(selectedNode)]
  );
  const [workspace, setWorkspace] = useState<AiWorkspace>(
    initialSession.current?.workspace ?? initialWorkspaceForNode(selectedNode)
  );
  const [status, setStatus] = useState(
    initialSession.current?.pendingAction
      ? "正在恢复上次未完成的 AI 回复"
      : initialSession.current
        ? "已恢复上次 AI 对话"
        : "等待输入"
  );
  const [pendingAction, setPendingAction] = useState<PendingAction>(initialSession.current?.pendingAction ?? null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>(initialSession.current?.quizAnswers ?? {});
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>(initialSession.current?.flippedCards ?? {});
  const [studioCollapsed, setStudioCollapsed] = useState<Record<StudioSectionKey, boolean>>(
    initialSession.current?.studioCollapsed ?? {
      quiz: false,
      cards: true,
      actions: true,
      code: true,
      links: true
    }
  );
  const chatStreamRef = useRef<HTMLDivElement | null>(null);
  const restoredPendingRef = useRef(false);

  const linkedNodes = useMemo(() => {
    return Array.from(new Set([
      ...workspace.nodeCards.map((card) => card.nodeId),
      ...messages.flatMap((item) => item.linkedNodeIds ?? [])
    ]));
  }, [messages, workspace.nodeCards]);

  const isPending = pendingAction !== null;
  const sourceCount = workspace.nodeCards.length;
  const actionCount = workspace.recommendedExercises.length + workspace.learningActions.length;
  const linkCount = linkedNodes.length;
  const codeCount = workspace.generatedCode ? 1 : 0;
  const answeredQuizCount = workspace.quiz.filter((item) => quizAnswers[item.id]).length;
  const flippedCardCount = workspace.knowledgeCards.filter((card) => flippedCards[card.nodeId]).length;
  const studioCount = workspace.quiz.length + workspace.knowledgeCards.length + actionCount + codeCount + linkCount;

  useEffect(() => {
    const snapshot: AiSessionSnapshot = {
      mode,
      message,
      code,
      sourceText,
      messages: withoutWaitingMessage(messages),
      workspace,
      pendingAction,
      quizAnswers,
      flippedCards,
      studioCollapsed
    };
    window.localStorage.setItem(AI_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  }, [mode, message, code, sourceText, messages, workspace, pendingAction, quizAnswers, flippedCards, studioCollapsed]);

  useEffect(() => {
    chatStreamRef.current?.scrollTo({
      top: chatStreamRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  useEffect(() => {
    if (messages.length > 1) return;
    setMessages([welcomeMessage(selectedNode)]);
    setWorkspace(initialWorkspaceForNode(selectedNode));
  }, [selectedNode]);

  useEffect(() => {
    if (restoredPendingRef.current) return;
    const snapshot = initialSession.current;
    const history = withoutWaitingMessage(snapshot?.messages ?? []);
    const lastMessage = history[history.length - 1];
    const shouldResumeChat = snapshot?.pendingAction === "chat" || lastMessage?.role === "user";
    if (!shouldResumeChat) return;
    restoredPendingRef.current = true;

    if (shouldResumeChat) {
      const lastUserMessage = [...history].reverse().find((item) => item.role === "user");
      if (!lastUserMessage) {
        setPendingAction(null);
        setStatus("已恢复对话，但没有找到上次提问");
        return;
      }
      setPendingAction("chat");
      setStatus("正在恢复上次未完成的 AI 回复");
      pushWaitingMessage("正在恢复上次未完成的回复，请稍候。");
      askAi(lastUserMessage.content, selectedNode.id, history)
        .then((result) => {
          syncFocusFromAi(result.linkedNodes);
          setMessages((current) => [...withoutWaitingMessage(current), result.message]);
          setWorkspace((current) => mergeWorkspace(current, {
            nodeCards: result.nodeCards,
            graphRelations: result.graphRelations,
            quiz: result.quiz ?? current.quiz,
            knowledgeCards: result.knowledgeCards ?? current.knowledgeCards,
            recommendedExercises: result.recommendedExercises ?? current.recommendedExercises,
            learningActions: result.learningActions ?? current.learningActions
          }));
          finishPending("已恢复并生成讲解、跳转卡片、Quiz 和推荐练习");
        })
        .catch((error: Error) => {
          pushAssistant(`恢复上次 AI 回复失败：${error.message}`, [selectedNode.id]);
          finishPending("恢复上次 AI 回复失败");
        });
    } else {
      pushWaitingMessage("上次操作尚未完成，请重新提交一次。");
      setStatus("已恢复上次操作，但需要重新提交");
    }
  }, [selectedNode.id]);

  function pushAssistant(content: string, linkedNodeIds: string[] = []) {
    setMessages((current) => [
      ...withoutWaitingMessage(current),
      {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content,
        linkedNodeIds
      }
    ]);
  }

  function pushWaitingMessage(content: string) {
    setMessages((current) => [
      ...withoutWaitingMessage(current),
      {
        id: waitingMessageId,
        role: "assistant",
        content,
        linkedNodeIds: [selectedNode.id]
      }
    ]);
  }

  function syncFocusFromAi(linkedNodeIds: string[] = []) {
    const nextFocusId = linkedNodeIds.find((nodeId) => nodeById[nodeId]);
    if (nextFocusId && nextFocusId !== selectedNode.id) {
      onSelect(nextFocusId);
    }
  }

  function finishPending(nextStatus: string) {
    setPendingAction(null);
    setStatus(nextStatus);
  }

  function clearSession() {
    const resetMessages = [welcomeMessage(selectedNode)];
    const resetWorkspace = initialWorkspaceForNode(selectedNode);
    setMode("chat");
    setMessage(defaultMessage);
    setCode(defaultCode);
    setSourceText(defaultSourceText);
    setMessages(resetMessages);
    setWorkspace(resetWorkspace);
    setQuizAnswers({});
    setFlippedCards({});
    setStatus("已清空 AI 对话");
    setPendingAction(null);
    window.localStorage.removeItem(AI_SESSION_STORAGE_KEY);
  }

  function answerQuiz(item: AiQuizItem, answer: string) {
    setQuizAnswers((current) => ({ ...current, [item.id]: answer }));
    const correct = normalizeAnswer(answer) === normalizeAnswer(item.answer);
    const nodeId = item.linkedNodeIds[0] ?? selectedNode.id;
    onQuizResult?.(nodeId, correct);
    setStatus(correct ? "Quiz 回答正确，已同步学习追踪" : "Quiz 回答错误，已记录为待巩固知识点");
  }

  function toggleCard(nodeId: string) {
    setFlippedCards((current) => ({ ...current, [nodeId]: !current[nodeId] }));
  }

  function toggleStudioSection(section: StudioSectionKey) {
    setStudioCollapsed((current) => ({ ...current, [section]: !current[section] }));
  }

  function sectionHeader(section: StudioSectionKey, title: string, count: number, detail?: string) {
    const collapsed = studioCollapsed[section];
    return (
      <button className="studio-section-toggle" onClick={() => toggleStudioSection(section)} aria-expanded={!collapsed}>
        <span>
          <strong>{title}</strong>
          {detail && <em>{detail}</em>}
        </span>
        <b>{count}</b>
        <ChevronDown size={16} className={collapsed ? "" : "open"} />
      </button>
    );
  }

  function handleChat() {
    const text = message.trim();
    if (!text || isPending) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      linkedNodeIds: []
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setMessage("");
    setPendingAction("chat");
    setStatus("正在进行多轮问答并生成学习闭环");
    pushWaitingMessage("正在等待 DeepSeek 回复，请稍候。模型会结合当前知识图谱生成讲解、练习和推荐。");

    askAi(text, selectedNode.id, withoutWaitingMessage(messages))
      .then((result) => {
        syncFocusFromAi(result.linkedNodes);
        setMessages((current) => [...withoutWaitingMessage(current), result.message]);
        setWorkspace((current) => mergeWorkspace(current, {
          nodeCards: result.nodeCards,
          graphRelations: result.graphRelations,
          quiz: result.quiz ?? current.quiz,
          knowledgeCards: result.knowledgeCards ?? current.knowledgeCards,
          recommendedExercises: result.recommendedExercises ?? current.recommendedExercises,
          learningActions: result.learningActions ?? current.learningActions
        }));
        finishPending("已生成讲解、跳转卡片、Quiz 和推荐练习");
      })
      .catch((error: Error) => {
        pushAssistant(`问答接口调用失败：${error.message}`, [selectedNode.id]);
        finishPending("问答接口调用失败");
      });
  }

  function handleAnalyze() {
    if (isPending) return;
    setPendingAction("analysis");
    setStatus("正在分析错误并绑定知识图谱节点");
    pushWaitingMessage("正在分析代码错误，并把错误原因关联到知识图谱节点。");
    analyzeCode(code, message || "代码分析")
      .then((result) => {
        pushAssistant(result.summary, result.linkedNodes);
        setWorkspace((current) => mergeWorkspace(current, {
          nodeCards: result.nodeCards,
          graphRelations: result.graphRelations,
          recommendedExercises: result.recommendedExercises ?? current.recommendedExercises,
          learningActions: result.learningActions ?? current.learningActions
        }));
        finishPending("错误分析已关联知识点，可点击跳转");
      })
      .catch((error: Error) => {
        pushAssistant(`代码分析失败：${error.message}`, [selectedNode.id]);
        finishPending("代码分析失败");
      });
  }

  function handleArtifacts() {
    if (isPending) return;
    setPendingAction("artifact");
    setStatus("正在根据资料生成 Quiz 和知识卡片");
    pushWaitingMessage("正在阅读资料并生成 Quiz、知识卡片与知识点跳转。");
    generateStudyArtifacts(sourceText, "AI 上传资料学习包", selectedNode.id)
      .then((result) => {
        pushAssistant(result.summary, result.linkedNodes);
        setWorkspace((current) => mergeWorkspace(current, {
          nodeCards: result.nodeCards,
          graphRelations: result.graphRelations,
          quiz: result.quiz ?? [],
          knowledgeCards: result.knowledgeCards ?? [],
          recommendedExercises: result.recommendedExercises ?? [],
          learningActions: result.learningActions ?? []
        }));
        finishPending("已生成 Quiz、知识卡片与知识点跳转");
      })
      .catch((error: Error) => {
        pushAssistant(`资料生成失败：${error.message}`, [selectedNode.id]);
        finishPending("资料生成失败");
      });
  }

  function handleGenerateCode() {
    if (isPending) return;
    const prompt = message.trim() || "生成与当前知识点相关的规范 C++ 代码";
    setPendingAction("code");
    setStatus("正在生成规范 C++ 代码并关联图谱节点");
    pushWaitingMessage("正在生成规范 C++ 代码，并把结果关联到相关知识点。");
    generateCode(prompt, selectedNode.id, messages)
      .then((result) => {
        pushAssistant(result.explanation, result.linkedNodes);
        setWorkspace((current) => mergeWorkspace(current, {
          nodeCards: result.nodeCards,
          graphRelations: result.graphRelations,
          recommendedExercises: result.recommendedExercises ?? current.recommendedExercises,
          learningActions: result.learningActions ?? current.learningActions,
          generatedCode: result.code,
          generatedExplanation: result.explanation
        }));
        finishPending("代码已生成，可点击关联知识点复习");
      })
      .catch((error: Error) => {
        pushAssistant(`代码生成失败：${error.message}`, [selectedNode.id]);
        finishPending("代码生成失败");
      });
  }

  return (
    <section className="ai-panel ai-notebook">
      <header className="ai-notebook-header">
        <div>
          <span className="eyebrow">AI Notebook</span>
          <h3>数据结构学习工作台</h3>
          <p>把知识图谱、问答、代码诊断和练习推荐收束到同一个学习空间。</p>
        </div>
        <div className="ai-header-metrics" aria-label="AI 工作台统计">
          <span><strong>{sourceCount}</strong>上下文</span>
          <span><strong>{messages.length}</strong>轮对话</span>
          <span><strong>{studioCount}</strong>产物</span>
        </div>
        <div className="ai-status-chip">
          {isPending && <Loader2 size={15} />}
          <span>{status}</span>
        </div>
      </header>

      <div className="ai-notebook-grid">
        <aside className="ai-sources-panel">
          <div className="ai-panel-heading">
            <span><FileText size={16} /> Sources</span>
            <em>{sourceCount} 个上下文</em>
          </div>

          <button className="source-current-card" onClick={() => onSelect(selectedNode.id)}>
            <span>当前知识点</span>
            <strong>{selectedNode.name}</strong>
            <small>{selectedNode.description}</small>
            <em>{selectedNode.tags.slice(0, 3).join(" · ")}</em>
          </button>

          <div className="source-list">
            {workspace.nodeCards.map((card) => (
              <button key={`${card.nodeId}-${card.source}`} className="source-card" onClick={() => onSelect(card.nodeId)}>
                <BookOpen size={15} />
                <span>
                  <strong>{card.title}</strong>
                  <small>{card.category} · 难度 {card.difficulty}</small>
                </span>
              </button>
            ))}
          </div>

          <div className="source-editor">
            <label>
              <span>粘贴资料</span>
              <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={7} disabled={isPending} />
            </label>
            <button onClick={handleArtifacts} disabled={isPending || !sourceText.trim()}>
              <Sparkles size={16} />
              {pendingAction === "artifact" ? "生成中..." : "生成学习包"}
            </button>
          </div>

          <div className="source-relations">
            <span><GitBranch size={15} /> 图谱关系</span>
            {workspace.graphRelations.length === 0 ? (
              <p>对话或分析后会出现关联关系。</p>
            ) : (
              workspace.graphRelations.map((relation) => (
                <button key={`${relation.subjectId}-${relation.objectId}-${relation.label}`} onClick={() => onSelect(relation.objectId)}>
                  {relation.subjectName} {relation.label} {relation.objectName}
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="ai-chat-panel">
          <div className="ai-chat-toolbar">
            <div className="ai-mode-tabs" aria-label="AI 功能切换">
              <button className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}><MessageSquareText size={15} /> 对话</button>
              <button className={mode === "artifact" ? "active" : ""} onClick={() => setMode("artifact")}><ClipboardList size={15} /> 学习包</button>
              <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}><Code2 size={15} /> 代码</button>
            </div>
            <button type="button" className="icon-text-button" onClick={clearSession} disabled={isPending}>
              <Trash2 size={15} /> 清空
            </button>
          </div>

          <div className="chat-stream" ref={chatStreamRef} aria-live="polite">
            {messages.map((item) => (
              <article key={item.id} className={`chat-message ${item.role} ${item.id === waitingMessageId ? "waiting" : ""}`}>
                <div className="chat-avatar">{item.role === "user" ? "我" : <Bot size={16} />}</div>
                <div className="chat-bubble">
                  {item.role === "assistant" ? (
                    <div className="assistant-markdown">{renderAssistantContent(item.content)}</div>
                  ) : (
                    <p>{item.content}</p>
                  )}
                  {item.id === waitingMessageId && <div className="typing-dots" aria-label="正在等待模型回复"><i /><i /><i /></div>}
                  {(item.linkedNodeIds ?? []).length > 0 && (
                    <div className="inline-node-card-grid">
                      {(item.linkedNodeIds ?? []).slice(0, 4).map((nodeId) => {
                        const node = nodeById[nodeId];
                        return (
                          <button key={nodeId} onClick={() => onSelect(nodeId)}>
                            <BookOpen size={15} />
                            <span>
                              <strong>{node?.name ?? nodeId}</strong>
                              <small>{node?.description ?? "点击跳转到知识图谱节点"}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {messages.length <= 1 && (
              <div className="prompt-suggestion-grid">
                {promptSuggestions.map((suggestion) => (
                  <button key={suggestion.label} onClick={() => setMessage(suggestion.value)} disabled={isPending}>
                    <Sparkles size={15} />
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isPending && (
            <div className="ai-pending-banner" role="status">
              正在等待大模型回复，当前请求还在处理中，请不要重复提交。
            </div>
          )}

          <div className="ai-composer">
            {mode === "chat" && (
              <>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} disabled={isPending} placeholder="围绕当前知识点继续提问..." />
                <button className="send-button" onClick={handleChat} disabled={isPending || !message.trim()}>
                  {pendingAction === "chat" ? <Loader2 size={16} /> : <Send size={16} />}
                  {pendingAction === "chat" ? "等待回复" : "发送"}
                </button>
              </>
            )}

            {mode === "artifact" && (
              <>
                <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={4} disabled={isPending} placeholder="粘贴一段课程资料，生成 Quiz 和知识卡片..." />
                <button className="send-button" onClick={handleArtifacts} disabled={isPending || !sourceText.trim()}>
                  {pendingAction === "artifact" ? <Loader2 size={16} /> : <Sparkles size={16} />}
                  {pendingAction === "artifact" ? "生成中" : "生成学习包"}
                </button>
              </>
            )}

            {mode === "code" && (
              <div className="code-composer">
                <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={5} disabled={isPending} />
                <input value={message} onChange={(event) => setMessage(event.target.value)} disabled={isPending} placeholder="描述你想生成的 C++ 代码或错误现象" />
                <div className="composer-actions">
                  <button onClick={handleAnalyze} disabled={isPending || !code.trim()}>
                    {pendingAction === "analysis" ? <Loader2 size={16} /> : <GitBranch size={16} />}
                    {pendingAction === "analysis" ? "分析中" : "分析错误"}
                  </button>
                  <button onClick={handleGenerateCode} disabled={isPending}>
                    {pendingAction === "code" ? <Loader2 size={16} /> : <Code2 size={16} />}
                    {pendingAction === "code" ? "生成中" : "生成代码"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="ai-studio-panel">
          <div className="ai-panel-heading">
            <span><Sparkles size={16} /> Studio</span>
            <em>{studioCount} 个产物</em>
          </div>

          <section className="studio-section">
            {sectionHeader("quiz", "Quiz", workspace.quiz.length, `${answeredQuizCount}/${workspace.quiz.length} 已作答`)}
            {!studioCollapsed.quiz && (
              <div className="quiz-list">
                {workspace.quiz.map((item) => (
                  <article key={item.id} className={`quiz-card ${quizAnswers[item.id] ? (normalizeAnswer(quizAnswers[item.id]) === normalizeAnswer(item.answer) ? "correct" : "wrong") : ""}`}>
                    <strong>{item.question}</strong>
                    {item.options ? (
                      <div className="quiz-option-grid">
                        {item.options.map((option) => (
                          <button
                            key={option}
                            className={quizAnswers[item.id] === option ? "selected" : ""}
                            onClick={() => answerQuiz(item, option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="quiz-short-answer">
                        <input
                          value={quizAnswers[item.id] ?? ""}
                          onChange={(event) => setQuizAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
                          placeholder="输入答案后点击判分"
                        />
                        <button onClick={() => answerQuiz(item, quizAnswers[item.id] ?? "")}>判分</button>
                      </div>
                    )}
                    {quizAnswers[item.id] && (
                      <div className="quiz-feedback">
                        {normalizeAnswer(quizAnswers[item.id]) === normalizeAnswer(item.answer) ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        <span>答案：{item.answer}。{item.explanation}</span>
                      </div>
                    )}
                    <div className="quiz-linked-row">
                      {item.linkedNodeIds.map((nodeId) => (
                        <button key={nodeId} onClick={() => onSelect(nodeId)}>跳转 {nodeById[nodeId]?.name ?? nodeId}</button>
                      ))}
                    </div>
                  </article>
                ))}
                {workspace.quiz.length === 0 && <p className="muted">生成学习包或完成问答后会出现在这里。</p>}
              </div>
            )}
          </section>

          <section className="studio-section">
            {sectionHeader("cards", "知识卡片", workspace.knowledgeCards.length, `${flippedCardCount}/${workspace.knowledgeCards.length} 已翻看`)}
            {!studioCollapsed.cards && (
              <div className="flashcard-grid">
                {workspace.knowledgeCards.map((card) => (
                  <button
                    key={card.nodeId}
                    className={`flashcard ${flippedCards[card.nodeId] ? "flipped" : ""}`}
                    onClick={() => toggleCard(card.nodeId)}
                  >
                    <span className="flashcard-toolbar">
                      <Layers3 size={15} />
                      <em>{flippedCards[card.nodeId] ? "反面" : "正面"}</em>
                      <RotateCcw size={14} />
                    </span>
                    {!flippedCards[card.nodeId] ? (
                      <>
                        <strong>{card.front}</strong>
                        <p>{card.back}</p>
                      </>
                    ) : (
                      <>
                        <strong>关键性质与常见错误</strong>
                        <ul>
                          {card.bullets.filter(Boolean).map((bullet) => <li key={bullet}>{bullet}</li>)}
                        </ul>
                        {card.mistake && <p>常见错误：{card.mistake}</p>}
                        {card.cppExample && <pre><code>{card.cppExample}</code></pre>}
                      </>
                    )}
                  </button>
                ))}
                {workspace.knowledgeCards.length === 0 && <p className="muted">还没有生成知识卡片。</p>}
              </div>
            )}
          </section>

          <section className="studio-section">
            {sectionHeader("actions", "推荐行动", actionCount, `${workspace.recommendedExercises.length} 练习 / ${workspace.learningActions.length} 动作`)}
            {!studioCollapsed.actions && (
              <div className="ai-action-list">
                {workspace.recommendedExercises.map((exercise) => (
                  <button key={exercise.exerciseId} onClick={() => onSelect(exercise.nodeId)}>
                    {exercise.title}
                    <span>{exercise.reason}</span>
                  </button>
                ))}
                {workspace.learningActions.map((action) => (
                  <button key={`${action.type}-${action.nodeId}`} onClick={() => onSelect(action.nodeId)}>
                    {action.label}
                    <span>{action.description}</span>
                  </button>
                ))}
                {workspace.recommendedExercises.length === 0 && workspace.learningActions.length === 0 && (
                  <p className="muted">AI 会把薄弱点转换成复习和练习建议。</p>
                )}
              </div>
            )}
          </section>

          {studioCount === 0 && (
            <div className="studio-empty-card">
              <Sparkles size={18} />
              <strong>让 AI 生成第一组学习产物</strong>
              <span>从一次提问或一段资料开始，系统会自动补全 Quiz、知识卡片和推荐路径。</span>
            </div>
          )}

          {workspace.generatedCode && (
            <section className="studio-section generated-code-panel">
              {sectionHeader("code", "生成的 C++ 代码", codeCount, "点击展开代码")}
              {!studioCollapsed.code && (
                <>
                  <p>{workspace.generatedExplanation}</p>
                  <pre><code>{workspace.generatedCode}</code></pre>
                </>
              )}
            </section>
          )}

          <section className="studio-section">
            {sectionHeader("links", "图谱跳转", linkCount, "相关节点")}
            {!studioCollapsed.links && (
              <div className="relation-list">
                {linkedNodes.map((nodeId) => (
                  <button key={nodeId} onClick={() => onSelect(nodeId)}>
                    跳转: {nodeById[nodeId]?.name ?? nodeId}
                  </button>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}
