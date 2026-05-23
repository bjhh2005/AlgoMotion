import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { BookOpen, Bot, ClipboardList, Code2, FileText, GitBranch, Loader2, MessageSquareText, Send, Sparkles, Trash2 } from "lucide-react";
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

interface AiSessionSnapshot {
  mode: AiMode;
  message: string;
  code: string;
  sourceText: string;
  messages: AiChatMessage[];
  workspace: AiWorkspace;
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
      workspace: {
        ...initialWorkspace,
        ...parsed.workspace
      }
    };
  } catch {
    return null;
  }
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

export function AiPanel({ selectedNode, nodeById, onSelect }: Props) {
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
  const [status, setStatus] = useState(initialSession.current ? "已恢复上次 AI 对话" : "等待输入");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const chatStreamRef = useRef<HTMLDivElement | null>(null);

  const linkedNodes = useMemo(() => {
    return Array.from(new Set([
      ...workspace.nodeCards.map((card) => card.nodeId),
      ...messages.flatMap((item) => item.linkedNodeIds ?? [])
    ]));
  }, [messages, workspace.nodeCards]);

  const isPending = pendingAction !== null;
  const sourceCount = workspace.nodeCards.length;
  const studioCount = workspace.quiz.length + workspace.knowledgeCards.length + workspace.recommendedExercises.length + workspace.learningActions.length;

  useEffect(() => {
    const snapshot: AiSessionSnapshot = {
      mode,
      message,
      code,
      sourceText,
      messages: withoutWaitingMessage(messages),
      workspace
    };
    window.localStorage.setItem(AI_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  }, [mode, message, code, sourceText, messages, workspace]);

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
    setStatus("已清空 AI 对话");
    setPendingAction(null);
    window.localStorage.removeItem(AI_SESSION_STORAGE_KEY);
  }

  function handleChat() {
    const text = message.trim();
    if (!text || isPending) return;

    const userMessage: AiChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      linkedNodeIds: [selectedNode.id]
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setMessage("");
    setPendingAction("chat");
    setStatus("正在进行多轮问答并生成学习闭环");
    pushWaitingMessage("正在等待 DeepSeek 回复，请稍候。模型会结合当前知识图谱生成讲解、练习和推荐。");

    askAi(text, selectedNode.id, withoutWaitingMessage(messages))
      .then((result) => {
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
                    <div className="mini-link-row">
                      {(item.linkedNodeIds ?? []).map((nodeId) => (
                        <button key={nodeId} onClick={() => onSelect(nodeId)}>
                          {nodeById[nodeId]?.name ?? nodeId}
                        </button>
                      ))}
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
            <h4>Quiz</h4>
            <div className="quiz-list">
              {workspace.quiz.map((item) => (
                <article key={item.id}>
                  <strong>{item.question}</strong>
                  {item.options && <p>{item.options.join(" / ")}</p>}
                  <em>答案：{item.answer}</em>
                  <span>{item.explanation}</span>
                </article>
              ))}
              {workspace.quiz.length === 0 && <p className="muted">生成学习包或完成问答后会出现在这里。</p>}
            </div>
          </section>

          <section className="studio-section">
            <h4>知识卡片</h4>
            <div className="flashcard-grid">
              {workspace.knowledgeCards.map((card) => (
                <article key={card.nodeId}>
                  <strong>{card.front}</strong>
                  <p>{card.back}</p>
                  <em>{card.mistake}</em>
                </article>
              ))}
              {workspace.knowledgeCards.length === 0 && <p className="muted">还没有生成知识卡片。</p>}
            </div>
          </section>

          <section className="studio-section">
            <h4>推荐行动</h4>
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
              <h4>生成的 C++ 代码</h4>
              <p>{workspace.generatedExplanation}</p>
              <pre><code>{workspace.generatedCode}</code></pre>
            </section>
          )}

          <div className="relation-list">
            {linkedNodes.map((nodeId) => (
              <button key={nodeId} onClick={() => onSelect(nodeId)}>
                跳转: {nodeById[nodeId]?.name ?? nodeId}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
