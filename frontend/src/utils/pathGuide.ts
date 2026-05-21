import type { KnowledgeContent, KnowledgeEdge, KnowledgeNode, ProgressMap, ProgressStatus, RecommendationItem, RecommendationSeeds } from "../types";

export function searchKnowledgeNodes(
  nodes: KnowledgeNode[],
  contentsByNodeId: Record<string, KnowledgeContent | undefined>,
  query: string
): KnowledgeNode[] {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return nodes;

  return nodes.filter((node) => {
    const content = contentsByNodeId[node.id];
    const haystack = [
      node.name,
      node.id,
      node.description,
      node.category,
      ...node.tags,
      content?.definition,
      ...(content?.properties ?? []),
      ...(content?.operationSteps ?? []),
      ...(content?.commonMistakes ?? [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(keyword);
  });
}

export function buildPathEdgeKeys(pathIds: string[], edges: KnowledgeEdge[]): Set<string> {
  const pathSet = new Set(pathIds);
  const edgeKeys = new Set<string>();

  for (let index = 0; index < pathIds.length - 1; index += 1) {
    const source = pathIds[index];
    const target = pathIds[index + 1];
    edges.forEach((edge) => {
      if (
        (edge.source === source && edge.target === target) ||
        (edge.source === target && edge.target === source)
      ) {
        edgeKeys.add(`${edge.source}-${edge.target}-${edge.type}`);
      }
    });
  }

  edges.forEach((edge) => {
    if (edge.type === "prerequisite" && pathSet.has(edge.source) && pathSet.has(edge.target)) {
      edgeKeys.add(`${edge.source}-${edge.target}-${edge.type}`);
    }
  });

  return edgeKeys;
}

export function getPathReason(
  nodeId: string,
  progress: ProgressMap,
  defaultPath: string[]
): string {
  const status = progress[nodeId]?.status ?? "not_started";
  const index = defaultPath.indexOf(nodeId);

  if (status === "weak") return "需巩固";
  if (status === "mastered") return "已掌握";
  if (index === 0) return "主线起点";
  if (index > 0) return `主线第 ${index + 1} 步`;
  return "推荐学习";
}

export function getStatusLabel(status: ProgressStatus): string {
  const labels: Record<ProgressStatus, string> = {
    not_started: "未学习",
    learning: "学习中",
    mastered: "已掌握",
    weak: "需巩固"
  };
  return labels[status];
}

export function computeLocalRecommendations(
  edges: KnowledgeEdge[],
  progress: ProgressMap,
  config: RecommendationSeeds,
  nodeById: Record<string, KnowledgeNode>,
  selectedId?: string
): RecommendationItem[] {
  const mastered = new Set(
    Object.entries(progress)
      .filter(([, item]) => item.status === "mastered")
      .map(([nodeId]) => nodeId)
  );

  if (selectedId && nodeById[selectedId]) {
    const selectedName = nodeById[selectedId].name;
    const seen = new Set<string>();
    const localCandidates: RecommendationItem[] = [];

    edges.forEach((edge) => {
      if (edge.source !== selectedId || seen.has(edge.target)) return;
      if (!nodeById[edge.target] || mastered.has(edge.target)) return;
      seen.add(edge.target);
      localCandidates.push({
        id: edge.target,
        name: nodeById[edge.target].name,
        difficulty: nodeById[edge.target].difficulty,
        reason: `「${selectedName}」的${edge.label}`,
        priority: localCandidates.length + 1
      });
    });

    if (localCandidates.length > 0) {
      return localCandidates.slice(0, config.maxRecommendations);
    }
  }

  const weak = new Set(
    Object.entries(progress)
      .filter(([, item]) => item.status === "weak")
      .map(([nodeId]) => nodeId)
  );

  const candidates: string[] = [];

  if (config.weakPrerequisiteBoost) {
    edges
      .filter((edge) => edge.type === "prerequisite" && weak.has(edge.target))
      .forEach((edge) => candidates.push(edge.source));
  }

  edges.forEach((edge) => {
    if (edge.type !== "contains" && edge.type !== "prerequisite") return;
    if (mastered.has(edge.source) && !mastered.has(edge.target)) {
      candidates.push(edge.target);
    }
  });

  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter((nodeId) => {
    if (seen.has(nodeId) || !nodeById[nodeId]) return false;
    seen.add(nodeId);
    return true;
  });

  let recommendations = uniqueCandidates.slice(0, config.maxRecommendations).map((nodeId, index) => ({
    id: nodeId,
    name: nodeById[nodeId].name,
    difficulty: nodeById[nodeId].difficulty,
    reason: "基于当前进度推荐的下一个学习节点",
    priority: index + 1
  }));

  if (recommendations.length === 0) {
    recommendations = config.defaultPath
      .slice(0, config.maxRecommendations)
      .filter((nodeId) => nodeById[nodeId])
      .map((nodeId, index) => ({
        id: nodeId,
        name: nodeById[nodeId].name,
        difficulty: nodeById[nodeId].difficulty,
        reason: "基于学习路径的推荐",
        priority: index + 1
      }));
  }

  return recommendations;
}

export function computeLocalPathItems(
  config: RecommendationSeeds,
  nodeById: Record<string, KnowledgeNode>,
  edges: KnowledgeEdge[],
  selectedId?: string
): RecommendationItem[] {
  const defaultPath = config.defaultPath.filter((nodeId) => nodeById[nodeId]);

  if (selectedId && defaultPath.includes(selectedId)) {
    const selectedIndex = defaultPath.indexOf(selectedId);
    return defaultPath.map((nodeId, index) => ({
      id: nodeId,
      name: nodeById[nodeId].name,
      difficulty: nodeById[nodeId].difficulty,
      reason:
        nodeId === selectedId
          ? "当前知识点"
          : index < selectedIndex
            ? "前置主线"
            : "主线路径后续",
      priority: index + 1
    }));
  }

  if (selectedId && nodeById[selectedId]) {
    const items: RecommendationItem[] = [];
    const seen = new Set<string>();

    let current = selectedId;
    const visited = new Set([selectedId]);
    for (let depth = 0; depth < 5; depth += 1) {
      const parent = edges.find(
        (edge) =>
          edge.target === current &&
          (edge.type === "prerequisite" || edge.type === "contains") &&
          nodeById[edge.source] &&
          !visited.has(edge.source)
      );
      if (!parent) break;
      visited.add(parent.source);
      current = parent.source;
      items.unshift({
        id: parent.source,
        name: nodeById[parent.source].name,
        difficulty: nodeById[parent.source].difficulty,
        reason: "建议先掌握",
        priority: 0
      });
    }

    seen.add(selectedId);
    items.push({
      id: selectedId,
      name: nodeById[selectedId].name,
      difficulty: nodeById[selectedId].difficulty,
      reason: "当前知识点",
      priority: items.length + 1
    });

    edges.forEach((edge) => {
      if (edge.source !== selectedId || seen.has(edge.target)) return;
      if (!["contains", "prerequisite", "used_in", "related"].includes(edge.type)) return;
      if (!nodeById[edge.target]) return;
      seen.add(edge.target);
      items.push({
        id: edge.target,
        name: nodeById[edge.target].name,
        difficulty: nodeById[edge.target].difficulty,
        reason: edge.label || "关联推荐",
        priority: items.length + 1
      });
    });

    defaultPath.forEach((nodeId) => {
      if (seen.has(nodeId)) return;
      seen.add(nodeId);
      items.push({
        id: nodeId,
        name: nodeById[nodeId].name,
        difficulty: nodeById[nodeId].difficulty,
        reason: "回归主线路径",
        priority: items.length + 1
      });
    });

    return items.map((item, index) => ({ ...item, priority: index + 1 }));
  }

  return defaultPath.map((nodeId, index) => ({
    id: nodeId,
    name: nodeById[nodeId].name,
    difficulty: nodeById[nodeId].difficulty,
    reason: "主线路径",
    priority: index + 1
  }));
}
