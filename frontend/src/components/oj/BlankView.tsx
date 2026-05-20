import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, CloudUpload, Lightbulb } from "lucide-react";
import { checkSelectCompleteAnswer, fetchProblemData } from "../../api";
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
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [remoteQuestion, setRemoteQuestion] = useState<Exercise | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    setValues({});
    setSubmitted(false);
    setSavedAt("");
    setIsCorrect(null);
    setSubmitting(false);
    setSubmitError("");
    setRemoteQuestion(null);
    setLoadingQuestion(false);
    setLoadError("");
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

  useEffect(() => {
    if (!q?.id) return;
    let cancelled = false;
    setLoadingQuestion(true);
    setLoadError("");
    fetchProblemData(q.id)
      .then((result) => {
        if (cancelled) return;
        if (result.id === "Error") {
          setLoadError(result.details ?? "题目加载失败");
          setRemoteQuestion(null);
          return;
        }
        setRemoteQuestion(result);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setLoadError(error.message);
        setRemoteQuestion(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestion(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q?.id]);

  const currentQuestion = remoteQuestion ?? q;

  const tokens = useMemo(() => {
    if (!currentQuestion?.fillStem) return [];
    const parts: { type: "text" | "blank"; value: string; id?: number }[] = [];
    const re = /\{\{(\d+)\}\}/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(currentQuestion.fillStem)) !== null) {
      if (match.index > last) {
        parts.push({ type: "text", value: currentQuestion.fillStem.slice(last, match.index) });
      }
      parts.push({ type: "blank", value: "", id: Number(match[1]) });
      last = match.index + match[0].length;
    }
    if (last < currentQuestion.fillStem.length) {
      parts.push({ type: "text", value: currentQuestion.fillStem.slice(last) });
    }
    return parts;
  }, [currentQuestion?.fillStem]);

  if (!currentQuestion || !currentQuestion.blanks?.length) {
    return <p className="oj-empty">暂无填空题</p>;
  }

  const allCorrect = submitted && isCorrect === true;

  async function submitAnswer() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const mergedAnswer = currentQuestion.blanks!
        .map((blank) => (values[blank.id] ?? "").trim())
        .join(";");
      const result = await checkSelectCompleteAnswer(currentQuestion.id, {
        problem_id: currentQuestion.id,
        answer: mergedAnswer
      });
      if (result.id === "Error") {
        setSubmitError(result.details ?? "提交失败");
        return;
      }
      setIsCorrect(Boolean(result.status));
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="oj-question-view">
      <header className="oj-question-header">
        <div className="oj-question-meta">
          <span>{exerciseRoute(currentQuestion)}</span>
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
          <span className="oj-badge oj-badge-outline">{knowledgeName(currentQuestion, nodeById)}</span>
          <span className="oj-badge oj-badge-success">{difficultyLabel[currentQuestion.difficulty]}</span>
        </div>
      </header>

      <article className="oj-card">
        <h3 className="oj-question-title">{currentQuestion.title}</h3>
        {loadingQuestion && <p className="muted">正在加载题目...</p>}
        {loadError && <p className="oj-problem-error">{loadError}</p>}
        <p className="oj-fill-stem">
          {tokens.map((token, i) => {
            if (token.type === "text") {
              return <span key={i}>{token.value}</span>;
            }
            const id = token.id!;
            const value = values[id] ?? "";
            const blank = currentQuestion.blanks!.find((item) => item.id === id)!;
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
            {currentQuestion.blanks.map((blank) => (
              <li key={blank.id}>
                <Check size={16} />
                填空 {blank.id}：<strong>{blank.answer}</strong>
              </li>
            ))}
          </ul>
          {currentQuestion.analysis && (
            <p className="oj-analysis">
              <Lightbulb size={16} />
              {currentQuestion.analysis}
            </p>
          )}
        </article>
      )}

      {submitError && <p className="oj-problem-error">{submitError}</p>}

      <footer className="oj-actions">
        {!submitted ? (
          <button
            type="button"
            className="oj-btn-primary"
            disabled={currentQuestion.blanks.some((blank) => !(values[blank.id] ?? "").trim()) || submitting}
            onClick={submitAnswer}
          >
            {submitting ? "提交中..." : "提交答案"}
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
