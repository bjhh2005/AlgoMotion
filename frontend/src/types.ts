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

export interface Exercise {
  id: string;
  nodeId: string;
  type: "choice" | "fill" | "programming";
  difficulty: "basic" | "postgraduate" | "interview";
  title: string;
  options?: string[];
  answer: string;
  ojRoute?: string;
  linkedNodeIds?: string[];
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
