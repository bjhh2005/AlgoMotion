import type { KnowledgeEdge, KnowledgeNode, ProgressMap } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selectedId: string;
  progress: ProgressMap;
  onSelect: (nodeId: string) => void;
  expanded?: boolean;
}

const statusText = {
  not_started: "未学",
  learning: "学习",
  mastered: "掌握",
  weak: "巩固"
};

export function DirectoryView({ nodes, edges, selectedId, progress, onSelect, expanded = false }: Props) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const childrenByParent = edges
    .filter((edge) => edge.type === "contains" && nodeIds.has(edge.target))
    .reduce<Record<string, string[]>>((result, edge) => {
      result[edge.source] = [...(result[edge.source] ?? []), edge.target];
      return result;
    }, {});

  const rootIds = expanded ? nodes.map((node) => node.id) : ["data-structure"];
  const nodeById = Object.fromEntries(nodes.map((node) => [node.id, node]));

  function renderNode(nodeId: string, depth = 0) {
    const node = nodeById[nodeId];
    if (!node) return null;
    const status = progress[nodeId]?.status ?? "not_started";

    return (
      <li key={`${nodeId}-${depth}`}>
        <button className={selectedId === nodeId ? "tree-item active" : "tree-item"} onClick={() => onSelect(nodeId)}>
          <span className={`status-dot ${status}`} />
          <span>{node.name}</span>
          <em>{statusText[status]}</em>
        </button>
        {(childrenByParent[nodeId] ?? []).length > 0 && (
          <ul>{childrenByParent[nodeId].map((childId) => renderNode(childId, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return <ul className="directory-tree">{rootIds.map((nodeId) => renderNode(nodeId))}</ul>;
}
