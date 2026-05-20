import { useEffect, useMemo, useState } from "react";
import { BlankView } from "./oj/BlankView";
import { ChoiceView } from "./oj/ChoiceView";
import { CodeView } from "./oj/CodeView";
import { buildProgrammingQuestions } from "./oj/programming-1001";
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

type OjMode = "choice" | "fill" | "programming";

const modeTabs: { key: OjMode; label: string }[] = [
  { key: "choice", label: "选择题" },
  { key: "fill", label: "填空题" },
  { key: "programming", label: "编程题" }
];

function modeForExercise(exercise: Exercise | undefined): OjMode {
  return exercise?.type ?? "choice";
}

function indexForExercise(list: Exercise[], exerciseId: string) {
  const index = list.findIndex((item) => item.id === exerciseId);
  return index >= 0 ? index : 0;
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
  const choiceQuestions = useMemo(
    () => exercises.filter((exercise) => exercise.type === "choice"),
    [exercises]
  );
  const fillQuestions = useMemo(
    () => exercises.filter((exercise) => exercise.type === "fill"),
    [exercises]
  );
  const programmingQuestions = useMemo(
    () => buildProgrammingQuestions(exercises),
    [exercises]
  );

  const initialSelected = exercises.find((exercise) => exercise.id === selectedExerciseId) ?? exercises[0];

  const [mode, setMode] = useState<OjMode>(() => modeForExercise(initialSelected));
  const [choiceIndex, setChoiceIndex] = useState(() =>
    indexForExercise(
      exercises.filter((exercise) => exercise.type === "choice"),
      selectedExerciseId
    )
  );
  const [fillIndex, setFillIndex] = useState(() =>
    indexForExercise(
      exercises.filter((exercise) => exercise.type === "fill"),
      selectedExerciseId
    )
  );

  // 仅在外部变更 selectedExerciseId 时同步（如从知识库跳转），避免与 Tab/翻题双向打架
  useEffect(() => {
    const selected = exercises.find((exercise) => exercise.id === selectedExerciseId);
    if (!selected) return;

    const nextMode = modeForExercise(selected);
    setMode(nextMode);
    if (nextMode === "choice") {
      setChoiceIndex(indexForExercise(choiceQuestions, selected.id));
    } else if (nextMode === "fill") {
      setFillIndex(indexForExercise(fillQuestions, selected.id));
    }
  }, [selectedExerciseId, exercises, choiceQuestions, fillQuestions]);

  function selectInMode(nextMode: OjMode, index: number) {
    setMode(nextMode);
    const list =
      nextMode === "choice"
        ? choiceQuestions
        : nextMode === "fill"
          ? fillQuestions
          : programmingQuestions;

    const safeIndex = list.length > 0 ? Math.min(index, list.length - 1) : 0;
    if (nextMode === "choice") setChoiceIndex(safeIndex);
    if (nextMode === "fill") setFillIndex(safeIndex);

    const current = list[safeIndex];
    if (current) onSelectExercise(current.id);
  }

  function handleModeChange(nextMode: OjMode) {
    const index =
      nextMode === "choice" ? choiceIndex : nextMode === "fill" ? fillIndex : 0;
    selectInMode(nextMode, index);
  }

  function handleChoiceIndexChange(index: number) {
    setChoiceIndex(index);
    const current = choiceQuestions[index];
    if (current) onSelectExercise(current.id);
  }

  function handleFillIndexChange(index: number) {
    setFillIndex(index);
    const current = fillQuestions[index];
    if (current) onSelectExercise(current.id);
  }

  if (exercises.length === 0) {
    return (
      <section className="oj-shell">
        <p className="oj-empty">暂无题目，后端或题库数据未返回练习记录。</p>
      </section>
    );
  }

  const counts: Record<OjMode, number> = {
    choice: choiceQuestions.length,
    fill: fillQuestions.length,
    programming: programmingQuestions.length
  };

  return (
    <section className="oj-shell">
      <div className="oj-mode-tabs">
        {modeTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={mode === tab.key ? "active" : ""}
            onClick={() => handleModeChange(tab.key)}
          >
            {tab.label}
            <span>{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className={`oj-mode-body ${mode === "programming" ? "code" : ""}`}>
        {mode === "choice" && (
          <ChoiceView
            questions={choiceQuestions}
            index={choiceIndex}
            onIndexChange={handleChoiceIndexChange}
            nodeById={nodeById}
          />
        )}
        {mode === "fill" && (
          <BlankView
            questions={fillQuestions}
            index={fillIndex}
            onIndexChange={handleFillIndexChange}
            nodeById={nodeById}
          />
        )}
        {mode === "programming" && (
          <CodeView
            questions={programmingQuestions}
            nodeById={nodeById}
            contentByNodeId={contentByNodeId}
            analysisRules={analysisRules}
            onOpenKnowledge={onOpenKnowledge}
            onJudgeComplete={onJudgeComplete}
          />
        )}
      </div>
    </section>
  );
}
