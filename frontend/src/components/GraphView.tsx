import type { KnowledgeEdge, KnowledgeNode, ProgressMap } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  filteredIds: Set<string>;
  selectedId: string;
  progress: ProgressMap;
  onSelect: (nodeId: string) => void;
}

const categoryPosition: Record<string, { x: number; y: number }> = {
  root: { x: 480, y: 80 },
  basic: { x: 120, y: 190 },
  linear: { x: 270, y: 270 },
  tree: { x: 500, y: 265 },
  graph: { x: 730, y: 270 },
  search: { x: 370, y: 485 },
  sorting: { x: 640, y: 500 },
  "algorithm-thinking": { x: 130, y: 500 }
};

const statusColor = {
  not_started: "#d6dde7",
  learning: "#f2b84b",
  mastered: "#39a86b",
  weak: "#e45b5b"
};

const edgeColor = {
  contains: "#b8c2d4",
  prerequisite: "#5677d8",
  related: "#7d6ccf",
  used_in: "#2d9c8f",
  error_caused_by: "#d75c5c"
};

export function GraphView({ nodes, edges, filteredIds, selectedId, progress, onSelect }: Props) {
  const nodeIndexByCategory: Record<string, number> = {};
  const positioned = nodes.map((node) => {
    const index = nodeIndexByCategory[node.category] ?? 0;
    nodeIndexByCategory[node.category] = index + 1;
    const base = categoryPosition[node.category] ?? { x: 480, y: 320 };
    const angle = index * 0.9;
    const radius = node.category === "root" ? 0 : 74 + (index % 3) * 12;
    return {
      ...node,
      x: base.x + Math.cos(angle) * radius,
      y: base.y + Math.sin(angle) * radius
    };
  });
  const positionById = Object.fromEntries(positioned.map((node) => [node.id, node]));

  return (
    <svg className="graph-canvas" viewBox="0 0 960 640" role="img" aria-label="数据结构知识图谱">
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#8b96a8" />
        </marker>
      </defs>

      {edges.map((edge) => {
        const source = positionById[edge.source];
        const target = positionById[edge.target];
        if (!source || !target) return null;
        const highlighted = selectedId === edge.source || selectedId === edge.target;
        return (
          <g key={`${edge.source}-${edge.target}-${edge.type}`} className={highlighted ? "edge active" : "edge"}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={edgeColor[edge.type]}
              strokeWidth={highlighted ? 2.8 : 1.4}
              markerEnd="url(#arrow)"
            />
          </g>
        );
      })}

      {positioned.map((node) => {
        const status = progress[node.id]?.status ?? "not_started";
        const inSearch = filteredIds.has(node.id);
        return (
          <g
            key={node.id}
            className={selectedId === node.id ? "graph-node active" : "graph-node"}
            transform={`translate(${node.x}, ${node.y})`}
            opacity={inSearch ? 1 : 0.2}
            onClick={() => onSelect(node.id)}
          >
            <circle r={selectedId === node.id ? 34 : 28} fill={statusColor[status]} />
            <text textAnchor="middle" y="5">{node.name}</text>
          </g>
        );
      })}
    </svg>
  );
}

