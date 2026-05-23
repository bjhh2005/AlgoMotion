import type { Exercise, KnowledgeNode } from "../../types";

export const typeLabel = {
  choice: "选择题",
  fill: "填空题",
  programming: "编程题"
} as const;

export const difficultyLabel = {
  basic: "基础",
  postgraduate: "考研",
  interview: "进阶"
} as const;

export function exerciseRoute(exercise: Exercise) {
  return exercise.ojRoute ?? `/oj/${exercise.id}`;
}

export function knowledgeName(exercise: Exercise, nodeById: Record<string, KnowledgeNode>) {
  return nodeById[exercise.nodeId]?.name ?? exercise.nodeId;
}

export function resolveOjProblemId(exercise: Exercise) {
  if (exercise.type === "programming") {
    return exercise.ojProblemId ?? "1001";
  }
  return exercise.ojProblemId ?? exercise.id;
}
