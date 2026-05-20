export type ProgressStatus = "not_started" | "learning" | "mastered" | "weak";
export type KnowledgeEdgeType = "contains" | "prerequisite" | "related" | "used_in" | "error_caused_by";

export interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  description: string;
  difficulty: number;
  tags: string[];
}

export interface KnowledgeEdge {
  source: string;
  target: string;
  type: KnowledgeEdgeType;
  label: string;
}

export interface ChoiceOption {
  key: string;
  text: string;
}

export interface FillBlank {
  id: number;
  answer: string;
}

export interface ProgrammingExample {
  input: string;
  output: string;
  explanation?: string;
}

export interface Exercise {
  id: string;
  nodeId: string;
  type: "choice" | "fill" | "programming";
  difficulty: "basic" | "postgraduate" | "interview";
  title: string;
  answer: string;
  ojRoute?: string;
  /** OJ 判题数据目录 ID，如 1001，对应 data/oj-data/{id} */
  ojProblemId?: string;
  /** 题面 Markdown 文件路径（相对项目根目录） */
  path?: string;
  /** 由 /api/get_problem_data 读取 path 后返回的 Markdown 正文 */
  content?: string;
  linkedNodeIds?: string[];
  /** @deprecated 旧版选择题选项，优先使用 choiceOptions */
  options?: string[];
  stem?: string;
  choiceOptions?: ChoiceOption[];
  choiceAnswer?: string;
  analysis?: string;
  fillStem?: string;
  blanks?: FillBlank[];
  description?: string;
  examples?: ProgrammingExample[];
  constraints?: string[];
  hints?: string[];
  starterCode?: string;
}

export interface LearningMetrics {
  mastery: number;
  confidence: number;
  studyMinutes: number;
  attemptCount: number;
  correctRate: number;
  errorCount: number;
  streakDays: number;
  lastActivityAt?: string;
  reviewDueAt?: string;
}

export interface ProgressRecord {
  status: ProgressStatus;
  score: number;
  metrics: LearningMetrics;
}

export type ProgressMap = Record<string, ProgressRecord>;

export interface OntologyRelation {
  subjectId: string;
  predicate: KnowledgeEdgeType;
  objectId: string;
  label: string;
  source: "knowledge-graph" | "oj-error" | "ai-analysis";
  evidence: "curated" | "exercise-attempt" | "rule-match";
}

export interface KnowledgeContent {
  nodeId: string;
  definition: string;
  properties: string[];
  operationSteps: string[];
  complexity: {
    time: string;
    space: string;
  };
  commonMistakes: string[];
  resourceLinks: string[];
}

export interface CodeExample {
  nodeId: string;
  language: "cpp";
  title: string;
  code: string;
}

export interface CodeAnalysisRule {
  id: string;
  keywords: string[];
  linkedNodes: string[];
  suggestion: string;
}

export interface RecommendationSeeds {
  defaultPath: string[];
  weakPrerequisiteBoost: boolean;
  maxRecommendations: number;
}
