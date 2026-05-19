import type {
  CodeAnalysisRule,
  CodeExample,
  Exercise,
  KnowledgeContent,
  KnowledgeEdge,
  KnowledgeNode,
  ProgressMap,
  ProgressRecord,
  RecommendationSeeds
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

export interface BootstrapPayload {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  contents: KnowledgeContent[];
  codeExamples: CodeExample[];
  exercises: Exercise[];
  progress: ProgressMap;
  analysisRules: CodeAnalysisRule[];
  recommendationConfig: RecommendationSeeds;
}

export interface ChatResponse {
  answer: string;
  linkedNodes: string[];
}

export interface CodeAnalysisResponse {
  summary: string;
  linkedNodes: string[];
  suggestions: string[];
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function fetchBootstrap() {
  return requestJson<BootstrapPayload>("/api/bootstrap");
}

export function updateProgress(nodeId: string, record: ProgressRecord) {
  return requestJson<{ ok: boolean; progress: ProgressRecord }>("/api/progress/update", {
    method: "POST",
    body: JSON.stringify({ nodeId, ...record })
  });
}

export function askAi(message: string, nodeId: string) {
  return requestJson<ChatResponse>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({ message, nodeId })
  });
}

export function analyzeCode(code: string, problem?: string) {
  return requestJson<CodeAnalysisResponse>("/api/ai/code-analysis", {
    method: "POST",
    body: JSON.stringify({ code, problem })
  });
}

// ============================================
// 学习分析 API
// ============================================

// 学习趋势数据
export interface TrendPoint {
  date: string;
  mastery: number;
  study_minutes: number;
}

export interface TrendSummary {
  avg_mastery: number;
  total_study_minutes: number;
  peak_date: string;
}

export interface LearningTrend {
  days: number;
  trend: TrendPoint[];
  summary: TrendSummary;
}

export function fetchLearningTrend(days: number = 7, nodeId?: string) {
  const params = new URLSearchParams({ days: String(days) });
  if (nodeId) params.append("node_id", nodeId);
  return requestJson<{ success: boolean; data: LearningTrend }>(`/api/analytics/trend?${params}`);
}

// 薄弱知识点
export interface WeakKnowledgePoint {
  node_id: string;
  name: string;
  mastery: number;
  status: string;
  review_due_at?: string;
  affected_nodes: string[];
}

export function fetchWeakKnowledge(threshold: number = 0.5) {
  return requestJson<{ success: boolean; data: WeakKnowledgePoint[] }>(
    `/api/analytics/weak?threshold=${threshold}`
  );
}

// 认知层级分析
export interface QuestionAttemptStats {
  total: number;
  correct: number;
  avg_time_spent: number;
  guess_rate: number;
}

export interface CognitiveMastery {
  node_id: string;
  level_mastery: Record<string, number>;
  question_attempt_stats: Record<string, QuestionAttemptStats>;
  bloom_weighted_mastery: number;
}

export function fetchCognitiveAnalysis(nodeId: string) {
  return requestJson<{ success: boolean; data: CognitiveMastery }>(
    `/api/analytics/cognitive/${nodeId}`
  );
}

// 综合学习报告
export interface LearningOverview {
  total_nodes: number;
  mastered: number;
  learning: number;
  weak: number;
  not_started: number;
  avg_mastery: number;
  total_study_minutes: number;
  total_attempts: number;
  total_errors: number;
}

export interface PropagationNode {
  node_id: string;
  propagation_strength: number;
  path_type: string;
  root_cause: boolean;
}

export interface PropagationAnalysis {
  source_node_id: string;
  affected_nodes: PropagationNode[];
  weakness_severity: number;
  downstream_risk: string;
}

export interface BehaviorAnalysis {
  node_id: string;
  average_time_per_question: number;
  time_variance: number;
  rush_rate: number;
  hesitation_rate: number;
  guess_rate: number;
  consistency: number;
  suspicious_flag: boolean;
  suspicious_reason?: string;
}

export interface MotivationIndex {
  student_id: string;
  consistency_score: number;
  perseverance_index: number;
  growth_mindset_score: number;
  intrinsic_motivation_score: number;
  effort_effectiveness_ratio: number;
  fake_effort_suspicion: number;
}

export interface ComprehensiveReport {
  student_id: string;
  timestamp: string;
  overview: LearningOverview;
  cognitive_mastery: Record<string, CognitiveMastery>;
  propagation_analyses: PropagationAnalysis[];
  behavior_analyses: Record<string, BehaviorAnalysis>;
  motivation_index: MotivationIndex;
}

export function fetchComprehensiveReport() {
  return requestJson<{ success: boolean; data: ComprehensiveReport }>(
    "/api/analytics/report"
  );
}

// 掌握度详细分析
export interface DecayInfo {
  base_decay_rate: number;
  stability_factor: number;
  retention_rate: number;
}

export interface MasteryAnalysis {
  node_id: string;
  node_name: string;
  current_mastery: number;
  mastery_after_decay: number;
  days_since_last_study: number;
  optimal_review_intervals: number[];
  status: string;
  score: number;
  metrics: Record<string, unknown>;
  decay_info: DecayInfo;
  recommendations: string[];
}

export function fetchMasteryAnalysis(nodeId: string) {
  return requestJson<{ success: boolean; data: MasteryAnalysis }>(
    `/api/progress/analysis/${nodeId}`
  );
}

// 练习提交
export interface ExerciseResult {
  correct: boolean;
  difficulty: number;
  time_spent: number;
  cognitive_level: string;
  guess?: boolean;
}

export interface MasteryBreakdown {
  base_score: number;
  correct_rate: number;
  correct_rate_weighted: number;
  stability_score: number;
  time_score: number;
  error_count: number;
}

export interface ExerciseSubmissionResponse {
  node_id: string;
  previous_mastery: number;
  new_mastery: number;
  status: string;
  review_due_at: string;
  breakdown: MasteryBreakdown;
  message: string;
  weighted_stats?: Record<string, unknown>;
}

export function submitExercises(
  nodeId: string,
  score: number,
  exercises: ExerciseResult[]
) {
  return requestJson<{ success: boolean; data: ExerciseSubmissionResponse }>(
    "/api/progress/submit",
    {
      method: "POST",
      body: JSON.stringify({ node_id: nodeId, score, exercises })
    }
  );
}

// ============================================
// 统一请求封装（支持默认状态）
// ============================================

export interface ApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export async function fetchWithFallback<T>(
  fetcher: () => Promise<{ success: boolean; data: T }>,
  fallbackData: T
): Promise<ApiResult<T>> {
  try {
    const response = await fetcher();
    if (response.success && response.data) {
      return { data: response.data, loading: false, error: null };
    }
    return { data: fallbackData, loading: false, error: "No data returned" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`API fallback triggered: ${message}`);
    return { data: fallbackData, loading: false, error: message };
  }
}
