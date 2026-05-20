import { useEffect, useState } from "react";
import { Check, Clock, HardDrive, Play, Send, X } from "lucide-react";
import {
  analyzeCode,
  fetchProblemData,
  normalizeJudgeResponse,
  submitJudge,
  type JudgeCaseDetail,
  type JudgeResponse
} from "../../api";
import { MarkdownContent } from "./MarkdownContent";
import type { CodeAnalysisRule, Exercise, KnowledgeContent, KnowledgeNode, ProgressRecord } from "../../types";
import { CodeEditor } from "./CodeEditor";
import { normalizeCodeString } from "./code-editor-utils";
import { difficultyLabel, exerciseRoute, knowledgeName, resolveOjProblemId } from "./oj-utils";
import { parseSampleCasesFromMarkdown } from "./problem-markdown";
import { useVerticalPaneResize } from "./useVerticalPaneResize";

interface Props {
  questions: Exercise[];
  nodeById: Record<string, KnowledgeNode>;
  contentByNodeId: Record<string, KnowledgeContent>;
  analysisRules: CodeAnalysisRule[];
  onOpenKnowledge: (nodeId: string) => void;
  onJudgeComplete?: (nodeId: string, accepted: boolean, previous?: ProgressRecord) => void;
}

const DEFAULT_TIME_LIMIT = 2;
const DEFAULT_MEM_LIMIT = 256;

type DescTab = "desc" | "submit";

function createSubmissionId() {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function judgeStatusClass(status: string) {
  if (status === "Accepted") return "accepted";
  if (status === "Compile Error") return "compile-error";
  return "failed";
}

function isCasePassed(status: string) {
  return status === "Accepted" || status === "AC";
}

function formatTime(time: number) {
  const value = Number(time) || 0;
  if (value < 1) return `${(value * 1000).toFixed(1)} ms`;
  return `${value.toFixed(3)} s`;
}

function formatMemory() {
  return "—";
}

function enrichJudgeWithSamples(
  result: JudgeResponse,
  samples: { input: string; expected: string }[]
): JudgeResponse {

  return {
    ...result,
    details: result.details.map((detail, index) => {
      const sample = samples[index];
      return {
        ...detail,
        input: normalizeCodeString(detail.input || sample?.input || ""),
        expected: normalizeCodeString(detail.expected || sample?.expected || ""),
        actual: normalizeCodeString(detail.actual ?? "")
      };
    })
  };
}

function IoBlock({
  title,
  body,
  tone
}: {
  title: string;
  body: string;
  tone?: "ok" | "bad" | "neutral";
}) {
  return (
    <div className={`oj-io-block oj-io-${tone ?? "neutral"}`}>
      <span>{title}</span>
      <pre>{normalizeCodeString(body) || "（空）"}</pre>
    </div>
  );
}

function CaseDetailPanel({ detail }: { detail: JudgeCaseDetail }) {
  const passed = isCasePassed(detail.status);

  return (
    <div className="oj-case-detail">
      <p className="oj-case-stats">
        <span>
          <Clock size={14} />
          {formatTime(detail.time)}
        </span>
        <span>
          <HardDrive size={14} />
          {formatMemory()}
        </span>
        <span className="oj-case-status-tag">{detail.status}</span>
      </p>
      <IoBlock title="输入" body={detail.input ?? ""} />
      <IoBlock title="期望输出" body={detail.expected ?? ""} tone="ok" />
      <IoBlock title="实际输出" body={detail.actual ?? ""} tone={passed ? "ok" : "bad"} />
    </div>
  );
}

export function CodeView({
  questions,
  nodeById,
  contentByNodeId,
  onOpenKnowledge,
  onJudgeComplete
}: Props) {
  const question = questions[0];
  const [code, setCode] = useState(() => normalizeCodeString(question?.starterCode ?? ""));
  const [descTab, setDescTab] = useState<DescTab>("desc");
  const [caseTab, setCaseTab] = useState(0);
  const [running, setRunning] = useState(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResponse | null>(null);
  const [submitStatus, setSubmitStatus] = useState("");
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [apiLinkedNodeIds, setApiLinkedNodeIds] = useState<string[]>([]);
  const [showErrorBind, setShowErrorBind] = useState(false);
  const [problemMarkdown, setProblemMarkdown] = useState("");
  const [problemLoadStatus, setProblemLoadStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [problemLoadMessage, setProblemLoadMessage] = useState("");
  const { paneRef, editorRatio, consoleRatio, isResizing, onResizeStart } = useVerticalPaneResize();

  useEffect(() => {
    setCode(normalizeCodeString(question?.starterCode ?? ""));
    setJudgeResult(null);
    setSubmitStatus("");
    setAnalysisStatus("");
    setCaseTab(0);
    setDescTab("desc");
    setShowErrorBind(false);
    setApiLinkedNodeIds([]);
  }, [question?.id, question?.starterCode]);

  useEffect(() => {
    if (!question?.id) return;

    let cancelled = false;
    setProblemLoadStatus("loading");
    setProblemLoadMessage("");
    setProblemMarkdown("");

    fetchProblemData(question.id)
      .then((payload) => {
        if (cancelled) return;
        if (payload.id === "Error") {
          setProblemLoadStatus("error");
          setProblemLoadMessage(payload.details ?? "题面加载失败");
          return;
        }
        if (payload.content) {
          setProblemMarkdown(payload.content);
          if (payload.starterCode) {
            setCode(normalizeCodeString(payload.starterCode));
          }
          setProblemLoadStatus("ok");
          return;
        }
        setProblemLoadStatus("error");
        setProblemLoadMessage("未返回题面 Markdown 内容");
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setProblemLoadStatus("error");
        setProblemLoadMessage(error.message);
      });

    return () => {
      cancelled = true;
    };
  }, [question?.id]);

  if (!question) {
    return <p className="oj-empty">暂无编程题</p>;
  }

  const linkedNodeIds = Array.from(
    new Set([question.nodeId, ...(question.linkedNodeIds ?? []), ...apiLinkedNodeIds])
  );
  const knowledgeTags = linkedNodeIds
    .map((id) => nodeById[id]?.name)
    .filter(Boolean) as string[];

  function runErrorAnalysis() {
    setAnalysisStatus("正在分析错因…");
    analyzeCode(code || question.title, question.title)
      .then((result) => {
        setApiLinkedNodeIds(result.linkedNodes);
        setAnalysisStatus(result.suggestions[0] ?? "错因分析完成");
      })
      .catch((error: Error) => {
        setAnalysisStatus(`错因分析失败：${error.message}`);
      });
  }

  function runJudge(isSubmit: boolean) {
    const trimmed = code.trim();
    if (!trimmed) {
      setSubmitStatus("请先编写代码");
      return;
    }

    setRunning(true);
    setJudgeResult(null);
    setShowErrorBind(false);
    setAnalysisStatus("");
    setSubmitStatus(isSubmit ? "正在提交评测…" : "正在运行样例…");

    submitJudge({
      submission_id: createSubmissionId(),
      problem_id: resolveOjProblemId(question),
      code: trimmed,
      time_limit: DEFAULT_TIME_LIMIT,
      mem_limit: DEFAULT_MEM_LIMIT
    })
      .then((raw) => {
        const samples = parseSampleCasesFromMarkdown(problemMarkdown);
        const result = enrichJudgeWithSamples(normalizeJudgeResponse(raw), samples);
        setJudgeResult(result);
        setCaseTab(0);

        const accepted = result.status === "Accepted";
        setSubmitStatus(
          result.message
            ? result.message
            : accepted
              ? `通过 ${result.passed_cases}/${result.total_cases} 个测例`
              : `${result.status}（${result.passed_cases}/${result.total_cases}）`
        );

        if (isSubmit) {
          try {
            onJudgeComplete?.(question.nodeId, accepted);
          } catch {
            // 避免进度同步异常导致整页白屏
          }
          if (!accepted) {
            setShowErrorBind(true);
            runErrorAnalysis();
          } else {
            setApiLinkedNodeIds([]);
          }
        }
      })
      .catch((error: Error) => {
        const fallback = normalizeJudgeResponse({
          status: "Request Error",
          total_cases: 0,
          passed_cases: 0,
          details: [],
          error_log: error.message
        });
        setJudgeResult(fallback);
        setSubmitStatus(`请求失败：${error.message}`);
      })
      .finally(() => setRunning(false));
  }

  const verdict = judgeResult?.status ?? null;
  const activeCase = judgeResult?.details[caseTab];

  return (
    <div className="oj-code-view">
      <header className="oj-code-toolbar">
        <div className="oj-code-toolbar-meta">
          <span className="muted">{exerciseRoute(question)}</span>
          <span>·</span>
          <strong>{question.title}</strong>
          <span className="oj-badge oj-badge-outline">{knowledgeName(question, nodeById)}</span>
          <span className="oj-badge oj-badge-warn">{difficultyLabel[question.difficulty]}</span>
        </div>
        <div className="oj-code-toolbar-actions">
          <button type="button" className="oj-btn-outline" disabled={running} onClick={() => runJudge(false)}>
            <Play size={14} />
            运行
          </button>
          <button type="button" className="oj-btn-primary" disabled={running} onClick={() => runJudge(true)}>
            <Send size={14} />
            提交
          </button>
        </div>
      </header>

      <div className="oj-code-panels">
        <section className="oj-code-desc">
          <div className="oj-inner-tabs">
            <button type="button" className={descTab === "desc" ? "active" : ""} onClick={() => setDescTab("desc")}>
              题目描述
            </button>
            <button type="button" className={descTab === "submit" ? "active" : ""} onClick={() => setDescTab("submit")}>
              提交记录
            </button>
          </div>

          {descTab === "desc" && (
            <div className="oj-desc-body">
              {problemLoadStatus === "loading" && (
                <p className="muted">正在加载题面…</p>
              )}
              {problemLoadStatus === "error" && (
                <p className="oj-problem-error">{problemLoadMessage || "题面加载失败"}</p>
              )}
              {problemLoadStatus === "ok" && (
                <MarkdownContent markdown={problemMarkdown} />
              )}
              {knowledgeTags.length > 0 && (
                <div className="oj-knowledge-card">
                  <div className="oj-knowledge-card-title">关联知识点</div>
                  <div className="oj-badge-row">
                    {linkedNodeIds.map((nodeId) => {
                      const name = nodeById[nodeId]?.name;
                      if (!name) return null;
                      return (
                        <button
                          key={nodeId}
                          type="button"
                          className="oj-badge oj-badge-outline oj-knowledge-link"
                          onClick={() => onOpenKnowledge(nodeId)}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {descTab === "submit" && (
            <p className="muted">暂无提交记录，完成提交后将在此展示历史结果。</p>
          )}
        </section>

        <section
          ref={paneRef}
          className={`oj-code-editor-pane ${isResizing ? "is-resizing" : ""}`}
        >
          <div className="oj-editor-slot" style={{ flex: `${editorRatio} 1 0` }}>
            <CodeEditor value={code} onChange={setCode} language="C++" tabSize={4} />
          </div>

          <button
            type="button"
            className="oj-pane-resizer"
            aria-label="拖动调整控制台高度"
            onMouseDown={onResizeStart}
          />

          <div className="oj-console" style={{ flex: `${consoleRatio} 1 0` }}>
            <div className="oj-console-head">
              <div className="oj-console-title">
                <span>控制台</span>
                {verdict && (
                  <span className={`oj-verdict ${judgeStatusClass(verdict)}`}>{verdict}</span>
                )}
              </div>
              {judgeResult && judgeResult.total_cases > 0 && (
                <span className="muted">
                  通过 {judgeResult.passed_cases} / {judgeResult.total_cases}
                </span>
              )}
            </div>

            <div className="oj-console-body">
              {running && <p className="muted">运行中…</p>}

              {!running && !judgeResult && (
                <p className="oj-console-placeholder">
                  点击「运行」执行样例测试，点击「提交」进行全量评测。
                </p>
              )}

              {!running && judgeResult && (
                <>
                  {judgeResult.details.length > 0 ? (
                    <>
                      <div className="oj-case-tabs">
                        {judgeResult.details.map((detail, index) => (
                          <button
                            key={index}
                            type="button"
                            className={caseTab === index ? "active" : ""}
                            onClick={() => setCaseTab(index)}
                          >
                            {isCasePassed(detail.status) ? (
                              <Check size={14} className="ok" />
                            ) : (
                              <X size={14} className="bad" />
                            )}
                            用例 {index + 1}
                          </button>
                        ))}
                      </div>
                      {activeCase && <CaseDetailPanel detail={activeCase} />}
                    </>
                  ) : (
                    <div className={`judge-result ${judgeStatusClass(judgeResult.status)}`}>
                      <p>{submitStatus || judgeResult.status}</p>
                      {judgeResult.compile_log && <pre>{judgeResult.compile_log}</pre>}
                      {judgeResult.error_log && <pre>{judgeResult.error_log}</pre>}
                    </div>
                  )}
                </>
              )}

              {analysisStatus && <p className="oj-analysis-inline">{analysisStatus}</p>}

              {!running && showErrorBind && judgeResult && judgeResult.status !== "Accepted" && (
                <div className="oj-error-bind">
                  <p>错因知识绑定：</p>
                  <div className="relation-list">
                    {linkedNodeIds.map((nodeId) => (
                      <button key={nodeId} type="button" onClick={() => onOpenKnowledge(nodeId)}>
                        {nodeById[nodeId]?.name ?? nodeId}
                      </button>
                    ))}
                  </div>
                  {linkedNodeIds
                    .flatMap((nodeId) => contentByNodeId[nodeId]?.commonMistakes ?? [])
                    .map((hint) => (
                      <p key={hint} className="muted">{hint}</p>
                    ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
