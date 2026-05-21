import { useEffect, useMemo, useRef, useState } from "react";
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
    <section className="ai-panel ai-workbench">
      <div className="panel-title">
        <div>
          <span className="eyebrow">AI Assistant</span>
          <h3>多轮学习助手</h3>
        </div>
        <strong>{status}</strong>
      </div>

      <div className="ai-mode-tabs" aria-label="AI 功能切换">
        <button className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}>对话</button>
        <button className={mode === "artifact" ? "active" : ""} onClick={() => setMode("artifact")}>资料学习包</button>
        <button className={mode === "code" ? "active" : ""} onClick={() => setMode("code")}>代码闭环</button>
      </div>

      <div className="ai-layout">
        <section className="ai-conversation">
          <div className="chat-stream" ref={chatStreamRef} aria-live="polite">
            {messages.map((item) => (
              <article key={item.id} className={`chat-message ${item.role} ${item.id === waitingMessageId ? "waiting" : ""}`}>
                <span>{item.role === "user" ? "我" : "AI"}</span>
                <p>{item.content}</p>
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
              </article>
            ))}
          </div>
          {isPending && (
            <div className="ai-pending-banner" role="status">
              正在等待大模型回复，当前请求还在处理中，请不要重复提交。
            </div>
          )}

          {mode === "chat" && (
            <>
              <label>
                多轮提问
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} disabled={isPending} />
              </label>
              <div className="status-actions">
                <button onClick={handleChat} disabled={isPending || !message.trim()}>
                  {pendingAction === "chat" ? "等待回复中..." : "发送并生成闭环"}
                </button>
                <button type="button" className="secondary-button" onClick={clearSession} disabled={isPending}>清空对话</button>
              </div>
            </>
          )}

          {mode === "artifact" && (
            <>
              <label>
                上传/粘贴资料
                <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={8} disabled={isPending} />
              </label>
              <div className="status-actions">
                <button onClick={handleArtifacts} disabled={isPending || !sourceText.trim()}>
                  {pendingAction === "artifact" ? "生成中..." : "生成 Quiz 与知识卡片"}
                </button>
                <button type="button" className="secondary-button" onClick={clearSession} disabled={isPending}>清空对话</button>
              </div>
            </>
          )}

          {mode === "code" && (
            <>
              <label>
                C++ 代码或生成需求
                <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={7} disabled={isPending} />
              </label>
              <label>
                代码生成需求
                <input value={message} onChange={(event) => setMessage(event.target.value)} disabled={isPending} />
              </label>
              <div className="status-actions">
                <button onClick={handleAnalyze} disabled={isPending || !code.trim()}>
                  {pendingAction === "analysis" ? "分析中..." : "分析错误并跳转"}
                </button>
                <button onClick={handleGenerateCode} disabled={isPending}>
                  {pendingAction === "code" ? "生成中..." : "生成规范 C++ 代码"}
                </button>
                <button type="button" className="secondary-button" onClick={clearSession} disabled={isPending}>清空对话</button>
              </div>
            </>
          )}
        </section>

        <aside className="ai-insights">
          <section>
            <h4>知识点跳转卡片</h4>
            <div className="ai-card-grid">
              {workspace.nodeCards.map((card) => (
                <button key={`${card.nodeId}-${card.source}`} className="ai-node-card" onClick={() => onSelect(card.nodeId)}>
                  <strong>{card.title}</strong>
                  <span>{card.description}</span>
                  <em>难度 {card.difficulty} / {card.category}</em>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h4>图谱关系</h4>
            <div className="ai-relation-list">
              {workspace.graphRelations.length === 0 ? (
                <p className="muted">对话或分析后会显示知识图谱关系。</p>
              ) : (
                workspace.graphRelations.map((relation) => (
                  <button key={`${relation.subjectId}-${relation.objectId}-${relation.label}`} onClick={() => onSelect(relation.objectId)}>
                    {relation.subjectName} {relation.label} {relation.objectName}
                  </button>
                ))
              )}
            </div>
          </section>

          <section>
            <h4>Quiz</h4>
            <div className="quiz-list">
              {(workspace.quiz.length ? workspace.quiz : []).map((item) => (
                <article key={item.id}>
                  <strong>{item.question}</strong>
                  {item.options && <p>{item.options.join(" / ")}</p>}
                  <em>答案：{item.answer}</em>
                  <span>{item.explanation}</span>
                </article>
              ))}
              {workspace.quiz.length === 0 && <p className="muted">资料学习包或问答闭环会生成 Quiz。</p>}
            </div>
          </section>
        </aside>
      </div>

      <div className="ai-output-grid">
        <section>
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

        <section>
          <h4>练习与推荐</h4>
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
          </div>
        </section>
      </div>

      {workspace.generatedCode && (
        <section className="generated-code-panel">
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
    </section>
  );
}
