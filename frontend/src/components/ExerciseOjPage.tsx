import { useState } from "react";
import { analyzeCode } from "../api";
import type { CodeAnalysisRule, Exercise, KnowledgeContent, KnowledgeNode } from "../types";

interface Props {
  exercises: Exercise[];
  selectedExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  onOpenKnowledge: (nodeId: string) => void;
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

export function ExerciseOjPage({
  exercises,
  selectedExerciseId,
  onSelectExercise,
  onOpenKnowledge,
  nodeById,
  contentByNodeId,
  analysisRules
}: Props) {
  const selected = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? exercises[0];
  const [submission, setSubmission] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [apiLinkedNodeIds, setApiLinkedNodeIds] = useState<string[]>([]);
  const [analysisStatus, setAnalysisStatus] = useState("等待提交分析");
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
      : ["提交后会根据代码结构、关键字和错题节点生成知识绑定。"];

  function handleAnalyzeSubmission() {
    setAnalysisStatus("正在请求 /api/ai/code-analysis");
    analyzeCode(submission || selected.title, selected.title)
      .then((result) => {
        setApiLinkedNodeIds(result.linkedNodes);
        setApiSuggestions(result.suggestions);
        setAnalysisStatus("后端分析完成");
      })
      .catch((error: Error) => {
        setAnalysisStatus(`后端分析失败：${error.message}`);
      });
  }

  return (
    <section className="page-panel oj-page">
      <div className="panel-title">
        <div>
          <span className="eyebrow">Online Judge</span>
          <h3>练习题与错因分析</h3>
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
              {selected.options.map((option) => <button key={option}>{option}</button>)}
            </div>
          )}

          <label>
            提交内容
            <textarea
              value={submission}
              onChange={(event) => setSubmission(event.target.value)}
              placeholder="在这里粘贴答案、思路或 C++ 代码，OJ 接口接入后可替换为真实提交。"
              rows={8}
            />
          </label>

          <div className="status-actions">
            <button onClick={() => setShowAnswer(true)}>查看参考答案</button>
            <button onClick={handleAnalyzeSubmission}>提交分析</button>
            <button onClick={() => onOpenKnowledge(selected.nodeId)}>打开绑定知识点</button>
            <span className="inline-status">{analysisStatus}</span>
          </div>

          {showAnswer && <p className="assistant-reply">参考答案：{selected.answer}</p>}

          <section>
            <h4>错因分析与知识库绑定</h4>
            <div className="relation-list">
              {linkedNodeIds.map((nodeId) => (
                <button key={nodeId} onClick={() => onOpenKnowledge(nodeId)}>
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
