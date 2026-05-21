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

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  linkedNodeIds?: string[];
}

export interface AiNodeCard {
  nodeId: string;
  title: string;
  description: string;
  category: string;
  difficulty: number;
  tags: string[];
  reason: string;
  source: "knowledge-graph" | "oj-error" | "ai-analysis";
}

export interface AiGraphRelation {
  subjectId: string;
  subjectName: string;
  predicate: KnowledgeEdgeType;
  objectId: string;
  objectName: string;
  label: string;
  source: "knowledge-graph" | "oj-error" | "ai-analysis";
  evidence: "curated" | "exercise-attempt" | "rule-match";
}

export interface AiQuizItem {
  id: string;
  type: "choice" | "fill" | "short";
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  linkedNodeIds: string[];
}

export interface AiKnowledgeCard {
  nodeId: string;
  front: string;
  back: string;
  bullets: string[];
  mistake: string;
}

export interface AiRecommendedExercise {
  exerciseId: string;
  nodeId: string;
  title: string;
  type: Exercise["type"];
  difficulty: Exercise["difficulty"];
  reason: string;
}

export interface AiLearningAction {
  type: "review" | "compare" | "practice";
  label: string;
  nodeId: string;
  description: string;
}

export interface AiLearningLoop {
  stage: string;
  problem: string;
  explainNodeId?: string;
  practiceCount: number;
  recommendation: string;
}

export interface AiLearningBundle {
  linkedNodes: string[];
  nodeCards: AiNodeCard[];
  graphRelations: AiGraphRelation[];
  quiz?: AiQuizItem[];
  knowledgeCards?: AiKnowledgeCard[];
  recommendedExercises?: AiRecommendedExercise[];
  learningActions?: AiLearningAction[];
  loop?: AiLearningLoop;
}
