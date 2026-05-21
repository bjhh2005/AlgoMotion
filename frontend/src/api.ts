import type {
  CodeAnalysisRule,
  CodeExample,
  Exercise,
  KnowledgeContent,
  KnowledgeEdge,
  KnowledgeNode,
  ProgressMap,
  ProgressRecord,
  RecommendationSeeds,
  AiChatMessage,
  AiLearningBundle
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

export interface ChatResponse extends AiLearningBundle {
  answer: string;
  message: AiChatMessage;
}

export interface CodeAnalysisResponse extends AiLearningBundle {
  summary: string;
  suggestions: string[];
}

export interface StudyArtifactsResponse extends AiLearningBundle {
  title: string;
  summary: string;
}

export interface CodeGenerationResponse extends AiLearningBundle {
  code: string;
  language: "cpp";
  explanation: string;
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
    const detail = await response.text().catch(() => "");
    const suffix = detail ? `: ${detail.slice(0, 240)}` : "";
    throw new Error(`${response.status} ${response.statusText}${suffix}`);
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

export function askAi(message: string, nodeId: string, history: AiChatMessage[] = []) {
  return requestJson<ChatResponse>("/api/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      nodeId,
      history: history.map(({ role, content }) => ({ role, content }))
    })
  });
}

export function analyzeCode(code: string, problem?: string) {
  return requestJson<CodeAnalysisResponse>("/api/ai/code-analysis", {
    method: "POST",
    body: JSON.stringify({ code, problem })
  });
}

export function generateStudyArtifacts(sourceText: string, title: string, nodeId?: string) {
  return requestJson<StudyArtifactsResponse>("/api/ai/study-artifacts", {
    method: "POST",
    body: JSON.stringify({ sourceText, title, nodeId })
  });
}

export function generateCode(prompt: string, nodeId: string, history: AiChatMessage[] = []) {
  return requestJson<CodeGenerationResponse>("/api/ai/code-generation", {
    method: "POST",
    body: JSON.stringify({
      prompt,
      nodeId,
      history: history.map(({ role, content }) => ({ role, content }))
    })
  });
}
