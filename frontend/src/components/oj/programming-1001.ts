import type { Exercise } from "../../types";

/** 合并题库索引与 get_problem_data 返回的编程题字段（不使用 starterCode） */
export function mergeProgrammingExercise(index: Exercise, remote?: Exercise | null): Exercise {
  const merged = remote ? { ...index, ...remote } : index;
  const { starterCode: _starterCode, ...rest } = merged;
  return {
    ...rest,
    type: "programming",
    ojProblemId: merged.ojProblemId ?? merged.id
  };
}
