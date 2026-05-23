export interface ProblemSampleCase {
  input: string;
  expected: string;
}

/** 从题面 Markdown 的「示例」区块解析输入/输出样例（供判题控制台回退） */
export function parseSampleCasesFromMarkdown(markdown: string): ProblemSampleCase[] {
  const cases: ProblemSampleCase[] = [];
  const pattern =
    /\*\*输入\*\*\s*\n+```[^\n]*\n([\s\S]*?)```\s*\n+\*\*输出\*\*\s*\n+```[^\n]*\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    cases.push({
      input: match[1].replace(/\n$/, ""),
      expected: match[2].replace(/\n$/, "")
    });
  }

  return cases;
}
