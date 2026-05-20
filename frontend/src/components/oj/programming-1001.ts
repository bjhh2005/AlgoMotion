import type { Exercise } from "../../types";
import { normalizeCodeString } from "./code-editor-utils";

/** 补充判题所需字段，题面与样例由 path 指向的 Markdown 加载 */
export function applyProgrammingMeta(exercise: Exercise): Exercise {
  if (exercise.type !== "programming") {
    return exercise;
  }

  return {
    ...exercise,
    ojProblemId: exercise.ojProblemId ?? "1001",
    starterCode: exercise.starterCode
      ? normalizeCodeString(exercise.starterCode)
      : undefined
  };
}

export function buildProgrammingQuestions(exercises: Exercise[]): Exercise[] {
  const fromApi = exercises.filter((item) => item.type === "programming");
  return fromApi.map(applyProgrammingMeta);
}
