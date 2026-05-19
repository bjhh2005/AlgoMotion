import { useState } from "react";
import { analyzeCode, submitJudge, type JudgeResponse } from "../api";
import type { CodeAnalysisRule, Exercise, KnowledgeContent, KnowledgeNode, ProgressRecord } from "../types";

interface Props {
  exercises: Exercise[];
  selectedExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  onOpenKnowledge: (nodeId: string) => void;
  onJudgeComplete?: (nodeId: string, accepted: boolean, previous?: ProgressRecord) => void;
  nodeById: Record<string, KnowledgeNode>;
  contentByNodeId: Record<string, KnowledgeContent>;
  analysisRules: CodeAnalysisRule[];
}

const typeText = {
  choice: "选择题",
  fill: "填空题",
  programming: "编程题"
};

const difficultyText = {
  basic: "基础",
  postgraduate: "考研",
  interview: "面试"
};

const DEFAULT_TIME_LIMIT = 2;
const DEFAULT_MEM_LIMIT = 256;

function createSubmissionId() {
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function judgeStatusClass(status: string) {
  if (status === "Accepted") return "accepted";
  if (status === "Compile Error") return "compile-error";
  return "failed";
}

export function ExerciseOjPage({
  exercises,
  selectedExerciseId,
  onSelectExercise,
  onOpenKnowledge,
  onJudgeComplete,
  nodeById,
  contentByNodeId,
  analysisRules
}: Props) {
  const selected = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? exercises[0];
  const [submission, setSubmission] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [apiLinkedNodeIds, setApiLinkedNodeIds] = useState<string[]>([]);
  const [judgeResult, setJudgeResult] = useState<JudgeResponse | null>(null);
  const [submitStatus, setSubmitStatus] = useState("等待提交");
  const [analysisStatus, setAnalysisStatus] = useState("未触发错因分析");
  const normalizedSubmission = submission.toLowerCase();

  if (!selected) {
    return (
      <section className="page-panel oj-page">
        <p className="muted">暂无题目，后端或题库数据未返回练习记录。</p>
      </section>
    );
  }

  const matchedRules = analysisRules.filter((rule) =>
    rule.keywords.some((keyword) => normalizedSubmission.includes(keyword.toLowerCase()))
  );
  const linkedNodeIds = Array.from(
    new Set([
      selected.nodeId,
      ...(selected.linkedNodeIds ?? []),
      ...matchedRules.flatMap((rule) => rule.linkedNodes),
      ...apiLinkedNodeIds
    ])
  );
  const mistakeHints = linkedNodeIds.flatMap((nodeId) => contentByNodeId[nodeId]?.commonMistakes ?? []);
  const suggestions = apiSuggestions.length > 0
    ? apiSuggestions
    : matchedRules.length > 0
      ? matchedRules.map((rule) => rule.suggestion)
      : ["提交后会根据判题结果、代码关键字和错题节点生成知识绑定。"];

  function runErrorAnalysis() {
    setAnalysisStatus("正在请求 /api/ai/code-analysis");
    analyzeCode(submission || selected.title, selected.title)
      .then((result) => {
        setApiLinkedNodeIds(result.linkedNodes);
        setApiSuggestions(result.suggestions);
        setAnalysisStatus("错因分析完成");
      })
      .catch((error: Error) => {
        setAnalysisStatus(`错因分析失败：${error.message}`);
      });
  }

  function handleSubmit() {
    const code = submission.trim();
    if (!code) {
      setSubmitStatus("请先填写提交内容");
      return;
    }

    setSubmitStatus("正在请求 /api/judge");
    setJudgeResult(null);
    setShowAnswer(false);

    submitJudge({
      submission_id: createSubmissionId(),
      problem_id: selected.id,
      code,
      time_limit: DEFAULT_TIME_LIMIT,
      mem_limit: DEFAULT_MEM_LIMIT
    })
      .then((result) => {
        setJudgeResult(result);
        const accepted = result.status === "Accepted";
        setSubmitStatus(
          accepted
            ? `判题通过（${result.passed_cases}/${result.total_cases}）`
            : `判题未通过：${result.status}（${result.passed_cases}/${result.total_cases}）`
        );
        onJudgeComplete?.(selected.nodeId, accepted);

        if (!accepted) {
          runErrorAnalysis();
        } else {
          setAnalysisStatus("已通过，无需错因分析");
          setApiLinkedNodeIds([]);
          setApiSuggestions([]);
        }
      })
      .catch((error: Error) => {
        setSubmitStatus(`判题请求失败：${error.message}`);
      });
  }

  return (
    <section className="page-panel oj-page">
      <div className="panel-title">
        <div>
          <span className="eyebrow">Online Judge</span>
          <h3>练习题与判题</h3>
        </div>
        <strong>{exercises.length} 题</strong>
      </div>

      <div className="oj-layout">
        <aside className="exercise-sidebar">
          {exercises.map((exercise) => (
            <button
              key={exercise.id}
              className={exercise.id === selected.id ? "active" : ""}
              onClick={() => {
                onSelectExercise(exercise.id);
                setShowAnswer(false);
                setJudgeResult(null);
                setSubmitStatus("等待提交");
              }}
            >
              <strong>{exercise.title}</strong>
              <span>{typeText[exercise.type]} / {difficultyText[exercise.difficulty]}</span>
            </button>
          ))}
        </aside>

        <article className="oj-problem">
          <div className="problem-meta">
            <span>{selected.ojRoute ?? `/oj/${selected.id}`}</span>
            <span>{typeText[selected.type]}</span>
            <span>{difficultyText[selected.difficulty]}</span>
          </div>
          <h4>{selected.title}</h4>

          {selected.options && (
            <div className="option-grid">
              {selected.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={submission === option ? "active" : ""}
                  onClick={() => setSubmission(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <label>
            提交内容
            <textarea
              value={submission}
              onChange={(event) => setSubmission(event.target.value)}
              placeholder={
                selected.type === "programming"
                  ? "粘贴 C++ 代码，提交后将调用 POST /api/judge 判题。"
                  : "填写答案；选择题也可直接点选项。"
              }
              rows={8}
            />
          </label>

          <div className="status-actions">
            <button type="button" onClick={handleSubmit}>提交 OJ</button>
            <button type="button" onClick={() => setShowAnswer(true)}>查看参考答案</button>
            <button type="button" onClick={runErrorAnalysis}>错因分析</button>
            <button type="button" onClick={() => onOpenKnowledge(selected.nodeId)}>打开绑定知识点</button>
            <span className="inline-status">{submitStatus}</span>
          </div>

          {judgeResult && (
            <section className={`judge-result ${judgeStatusClass(judgeResult.status)}`}>
              <h4>判题结果</h4>
              <p>
                状态：<strong>{judgeResult.status}</strong>
                {" · "}
                通过 {judgeResult.passed_cases}/{judgeResult.total_cases} 个测例
              </p>
              <ul className="judge-case-list">
                {judgeResult.details.map((detail, index) => (
                  <li key={`${detail.status}-${index}`}>
                    测例 {index + 1}：{detail.status}（{detail.time.toFixed(4)}s）
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showAnswer && <p className="assistant-reply">参考答案：{selected.answer}</p>}

          <section>
            <h4>错因分析与知识库绑定</h4>
            <p className="inline-status">{analysisStatus}</p>
            <div className="relation-list">
              {linkedNodeIds.map((nodeId) => (
                <button key={nodeId} type="button" onClick={() => onOpenKnowledge(nodeId)}>
                  {nodeById[nodeId]?.name ?? nodeId}
                </button>
              ))}
            </div>
            <ul className="content-list">
              {suggestions.map((suggestion) => <li key={suggestion}>{suggestion}</li>)}
              {mistakeHints.map((hint) => <li key={hint}>{hint}</li>)}
            </ul>
          </section>
        </article>
      </div>
    </section>
  );
}
