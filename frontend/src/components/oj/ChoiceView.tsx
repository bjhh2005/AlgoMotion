import { useEffect, useState } from "react";
import { Check, ChevronRight, Lightbulb, X } from "lucide-react";
import type { Exercise, KnowledgeNode } from "../../types";
import { difficultyLabel, exerciseRoute, knowledgeName, typeLabel } from "./oj-utils";

interface Props {
  questions: Exercise[];
  index: number;
  onIndexChange: (index: number) => void;
  nodeById: Record<string, KnowledgeNode>;
}

export function ChoiceView({ questions, index, onIndexChange, nodeById }: Props) {
  const q = questions[index];
  const [selected, setSelected] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelected(null);
    setSubmitted(false);
  }, [q?.id]);

  if (!q) {
    return <p className="oj-empty">暂无选择题</p>;
  }

  const options = q.choiceOptions ?? (q.options ?? []).map((text, i) => ({
    key: String.fromCharCode(65 + i),
    text
  }));
  const answer = q.choiceAnswer ?? q.answer;
  const correct = submitted && selected === answer;

  return (
    <div className="oj-question-view">
      <header className="oj-question-header">
        <div className="oj-question-meta">
          <span>{exerciseRoute(q)}</span>
          <span>·</span>
          <span>第 {index + 1} / {questions.length} 题</span>
        </div>
        <div className="oj-badge-row">
          <span className="oj-badge oj-badge-muted">{typeLabel.choice}</span>
          <span className="oj-badge oj-badge-outline">{knowledgeName(q, nodeById)}</span>
          <span className="oj-badge oj-badge-success">{difficultyLabel[q.difficulty]}</span>
        </div>
      </header>

      <article className="oj-card">
        <h3 className="oj-question-title">{q.title}</h3>
        {q.stem && <p className="oj-question-stem">{q.stem}</p>}

        <div className="oj-choice-list">
          {options.map((opt) => {
            const isSel = selected === opt.key;
            const isAns = opt.key === answer;
            let state = "";
            if (isSel && !submitted) state = "selected";
            if (submitted && isAns) state = "correct";
            if (submitted && isSel && !isAns) state = "wrong";

            return (
              <button
                key={opt.key}
                type="button"
                disabled={submitted}
                className={`oj-choice-item ${state}`}
                onClick={() => setSelected(opt.key)}
              >
                <span className="oj-choice-key">{opt.key}</span>
                <span className="oj-choice-text">{opt.text}</span>
                {submitted && isAns && <Check size={18} className="oj-choice-icon ok" />}
                {submitted && isSel && !isAns && <X size={18} className="oj-choice-icon bad" />}
              </button>
            );
          })}
        </div>
      </article>

      {submitted && (
        <article className={`oj-feedback ${correct ? "ok" : "bad"}`}>
          <div className="oj-feedback-head">
            <span className={`oj-verdict ${correct ? "ok" : "bad"}`}>
              {correct ? "回答正确" : "回答错误"}
            </span>
            <span className="oj-feedback-answer">正确答案：{answer}</span>
          </div>
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
          <button type="button" className="oj-btn-primary" disabled={!selected} onClick={() => setSubmitted(true)}>
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
