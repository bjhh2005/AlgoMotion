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

export interface JudgeCaseDetail {
  status: string;
  time: number;
  input?: string;
  expected?: string;
  actual?: string;
}

export interface JudgeResponse {
  status: string;
  total_cases: number;
  passed_cases: number;
  details: JudgeCaseDetail[];
  error_log?: string;
  compile_log?: string;
  message?: string;
}

export function normalizeJudgeResponse(raw: Partial<JudgeResponse> | null | undefined): JudgeResponse {
  const details = Array.isArray(raw?.details)
    ? raw!.details.map((item) => ({
        status: item?.status ?? "Unknown",
        time: Number(item?.time ?? 0) || 0,
        input: item?.input ?? "",
        expected: item?.expected ?? "",
        actual: item?.actual ?? ""
      }))
    : [];

  const passed_cases = Number(
    raw?.passed_cases ?? details.filter((item) => item.status === "Accepted").length
  );
  const total_cases = Number(raw?.total_cases ?? details.length);

  return {
    status: raw?.status ?? "System Error",
    total_cases,
    passed_cases,
    details,
    error_log: raw?.error_log,
    compile_log: raw?.compile_log,
    message: raw?.message
  };
}

export interface JudgeRequestPayload {
  submission_id: string;
  problem_id: string;
  code: string;
  time_limit: number;
  mem_limit: number;
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

export function submitJudge(payload: JudgeRequestPayload) {
  return requestJson<JudgeResponse>("/api/judge", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchExercises() {
  return requestJson<Exercise[]>("/api/exercises");
}
