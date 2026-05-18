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
