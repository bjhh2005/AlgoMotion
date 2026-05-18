import nodes from "../../data/knowledge-graph/nodes.json";
import edges from "../../data/knowledge-graph/edges.json";
import exercises from "../../data/exercises/exercises.json";
import contents from "../../data/learning-content/knowledge-content.json";
import codeExamples from "../../data/learning-content/code-examples.json";
import initialProgress from "../../data/learning-content/initial-progress.json";
import codeAnalysisRules from "../../data/learning-content/code-analysis-rules.json";
import recommendationSeeds from "../../data/learning-content/recommendation-seeds.json";
import type {
  CodeAnalysisRule,
  CodeExample,
  Exercise,
  KnowledgeContent,
  KnowledgeEdge,
  KnowledgeNode,
  OntologyRelation,
  ProgressMap,
  RecommendationSeeds
} from "./types";

export const knowledgeNodes = nodes as KnowledgeNode[];
export const knowledgeEdges = edges as KnowledgeEdge[];
export const exerciseBank = exercises as Exercise[];
export const knowledgeContents = contents as KnowledgeContent[];
export const cppExamples = codeExamples as CodeExample[];
export const seedProgress = initialProgress as ProgressMap;
export const analysisRules = codeAnalysisRules as CodeAnalysisRule[];
export const recommendationConfig = recommendationSeeds as RecommendationSeeds;
export const ontologyRelations: OntologyRelation[] = knowledgeEdges.map((edge) => ({
  subjectId: edge.source,
  predicate: edge.type,
  objectId: edge.target,
  label: edge.label,
  source: "knowledge-graph",
  evidence: "curated"
}));

export const nodeById = Object.fromEntries(knowledgeNodes.map((node) => [node.id, node]));
export const contentByNodeId = Object.fromEntries(knowledgeContents.map((content) => [content.nodeId, content]));
export const examplesByNodeId = cppExamples.reduce<Record<string, CodeExample[]>>((result, example) => {
  result[example.nodeId] = [...(result[example.nodeId] ?? []), example];
  return result;
}, {});
