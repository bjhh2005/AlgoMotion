import type { Exercise } from "../../types";
import { normalizeCodeString } from "./code-editor-utils";

/** OJ 1001：两整数求和（非高精度），对接 POST /api/judge problem_id=1001 */
export const PROGRAMMING_1001_STARTER = normalizeCodeString(`#include <iostream>
using namespace std;

int main() {
    int x, y;
    cin >> x >> y;
    cout << x + y;
    return 0;
}`);

const programming1001Content: Omit<Exercise, "id" | "nodeId" | "linkedNodeIds"> = {
  type: "programming",
  difficulty: "basic",
  ojProblemId: "1001",
  title: "A + B（两整数求和）",
  answer: "读入 x、y 后输出 x+y",
  ojRoute: "/oj/1001",
  description:
    "给定两个整数 x 和 y（|x|, |y| ≤ 10^9，非高精度），计算并输出 x + y。\n\n从标准输入读入两个整数，向标准输出打印它们的和。",
  examples: [
    {
      input: "1 2",
      output: "3",
      explanation: "1 + 2 = 3"
    },
    {
      input: "10 10",
      output: "20",
      explanation: "10 + 10 = 20"
    }
  ],
  /** 与 data/oj-data/1001 中测例一致，供控制台在判题响应缺字段时回退展示 */
  ojSampleCases: [
    { input: "1 2", expected: "3" },
    { input: "10 10", expected: "20" }
  ],
  constraints: ["|x|, |y| ≤ 10^9", "使用 C++ 提交"],
  hints: [
    "使用 std::cin 读入两个 int，std::cout 输出它们的和。",
    "判题时 problem_id 为 1001，时间限制 2s，内存限制 256MB。"
  ],
  starterCode: PROGRAMMING_1001_STARTER
};

/** 将后端返回的编程题替换为 1001 题面（仅影响 OJ 练习前端展示与判题参数） */
export function applyProgramming1001Override(exercise: Exercise): Exercise {
  if (exercise.type !== "programming") {
    return exercise;
  }

  return {
    ...exercise,
    ...programming1001Content,
    id: exercise.id,
    nodeId: exercise.nodeId,
    linkedNodeIds: exercise.linkedNodeIds ?? ["linear-list", "array"]
  };
}

export function buildProgrammingQuestions(exercises: Exercise[]): Exercise[] {
  const fromApi = exercises.filter((item) => item.type === "programming");
  if (fromApi.length === 0) {
    return [
      applyProgramming1001Override({
        id: "ex-1001-001",
        nodeId: "linear-list",
        type: "programming",
        difficulty: "basic",
        title: "",
        answer: ""
      })
    ];
  }
  return fromApi.map(applyProgramming1001Override);
}
