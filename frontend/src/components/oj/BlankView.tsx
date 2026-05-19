import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CloudUpload, Lightbulb } from "lucide-react";
import type { Exercise, KnowledgeNode } from "../../types";
import { difficultyLabel, exerciseRoute, knowledgeName, typeLabel } from "./oj-utils";

interface Props {
  questions: Exercise[];
  index: number;
  onIndexChange: (index: number) => void;
  nodeById: Record<string, KnowledgeNode>;
}

export function BlankView({ questions, index, onIndexChange, nodeById }: Props) {
  const q = questions[index];
  const [values, setValues] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [savedAt, setSavedAt] = useState("");

  useEffect(() => {
    setValues({});
    setSubmitted(false);
    setSavedAt("");
  }, [q?.id]);

  useEffect(() => {
    if (Object.keys(values).length === 0) return;
    const timer = window.setTimeout(() => {
      const d = new Date();
      setSavedAt(
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`
      );
    }, 400);
    return () => window.clearTimeout(timer);
  }, [values]);

  const tokens = useMemo(() => {
    if (!q?.fillStem) return [];
    const parts: { type: "text" | "blank"; value: string; id?: number }[] = [];
    const re = /\{\{(\d+)\}\}/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(q.fillStem)) !== null) {
      if (match.index > last) {
        parts.push({ type: "text", value: q.fillStem.slice(last, match.index) });
      }
      parts.push({ type: "blank", value: "", id: Number(match[1]) });
      last = match.index + match[0].length;
    }
    if (last < q.fillStem.length) {
      parts.push({ type: "text", value: q.fillStem.slice(last) });
    }
    return parts;
  }, [q?.fillStem]);

  if (!q || !q.blanks?.length) {
    return <p className="oj-empty">暂无填空题</p>;
  }

  const allCorrect = q.blanks.every((blank) => (values[blank.id] ?? "").trim() === blank.answer);

  return (
    <div className="oj-question-view">
      <header className="oj-question-header">
        <div className="oj-question-meta">
          <span>{exerciseRoute(q)}</span>
          <span>·</span>
          <span>第 {index + 1} / {questions.length} 题</span>
          {savedAt && !submitted && (
            <span className="oj-autosave">
              <CloudUpload size={14} />
              已自动保存 {savedAt}
            </span>
          )}
        </div>
        <div className="oj-badge-row">
          <span className="oj-badge oj-badge-muted">{typeLabel.fill}</span>
          <span className="oj-badge oj-badge-outline">{knowledgeName(q, nodeById)}</span>
          <span className="oj-badge oj-badge-success">{difficultyLabel[q.difficulty]}</span>
        </div>
      </header>

      <article className="oj-card">
        <h3 className="oj-question-title">{q.title}</h3>
        <p className="oj-fill-stem">
          {tokens.map((token, i) => {
            if (token.type === "text") {
              return <span key={i}>{token.value}</span>;
            }
            const id = token.id!;
            const value = values[id] ?? "";
            const blank = q.blanks!.find((item) => item.id === id)!;
            const isRight = submitted && value.trim() === blank.answer;
            const isWrong = submitted && !isRight;
            return (
              <input
                key={i}
                disabled={submitted}
                value={value}
                onChange={(event) => setValues((prev) => ({ ...prev, [id]: event.target.value }))}
                placeholder={`填空 ${id}`}
                className={`oj-blank-input ${isRight ? "ok" : isWrong ? "bad" : ""}`}
              />
            );
          })}
        </p>
      </article>

      {submitted && (
        <article className={`oj-feedback ${allCorrect ? "ok" : "bad"}`}>
          <div className="oj-feedback-head">
            <span className={`oj-verdict ${allCorrect ? "ok" : "bad"}`}>
              {allCorrect ? "全部正确" : "存在错误"}
            </span>
            <span className="oj-feedback-answer">参考答案如下</span>
          </div>
          <ul className="oj-blank-answers">
            {q.blanks.map((blank) => (
              <li key={blank.id}>
                <Check size={16} />
                填空 {blank.id}：<strong>{blank.answer}</strong>
              </li>
            ))}
          </ul>
          {q.analysis && (
            <p className="oj-analysis">
              <Lightbulb size={16} />
              {q.analysis}
            </p>
          )}
        </article>
      )}

      <footer className="oj-actions">
        {!submitted ? (
          <button
            type="button"
            className="oj-btn-primary"
            disabled={q.blanks.some((blank) => !(values[blank.id] ?? "").trim())}
            onClick={() => setSubmitted(true)}
          >
            提交答案
          </button>
        ) : (
          <button
            type="button"
            className="oj-btn-primary"
            onClick={() => onIndexChange((index + 1) % questions.length)}
          >
            下一题 <ChevronRight size={16} />
          </button>
        )}
      </footer>
    </div>
  );
}
