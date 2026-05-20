import { useCallback, useEffect, useMemo, type MouseEvent } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useViewport,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { KnowledgeEdge, KnowledgeNode, ProgressMap, ProgressStatus } from "../types";

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
  not_started: "#dce2eb",
  learning: "#f2b84b",
  mastered: "#39a86b",
  weak: "#e45b5b"
};

const statusRingColor: Record<ProgressStatus, string> = {
  not_started: "#c4ccd9",
  learning: "#e29b13",
  mastered: "#2a8a55",
  weak: "#c44848"
};

const edgeColor = {
  contains: "#b8c2d4",
  prerequisite: "#5677d8",
  related: "#7d6ccf",
  used_in: "#2d9c8f",
  error_caused_by: "#d75c5c"
};

const overviewRootId = "data-structure";

const zoomMode = {
  overviewMax: 0.62,
  focusMax: 1.05
};

const categoryTheme: Record<string, { base: string; soft: string; text: string; pale: string }> = {
  root: { base: "#263547", soft: "#eef2f7", text: "#182231", pale: "#f8fafc" },
  basic: { base: "#2f80c0", soft: "#d9ecfb", text: "#16496f", pale: "#f4f9fd" },
  linear: { base: "#209b8c", soft: "#d8f1ee", text: "#126055", pale: "#f2fbfa" },
  tree: { base: "#34a853", soft: "#dcf3e3", text: "#1f6934", pale: "#f4fbf6" },
  graph: { base: "#7b61d1", soft: "#e7e0fb", text: "#493586", pale: "#f7f4ff" },
  search: { base: "#3d7bd9", soft: "#deebff", text: "#25508f", pale: "#f5f8ff" },
  sorting: { base: "#d8832d", soft: "#f8e7d2", text: "#8a4d16", pale: "#fff8f0" },
  "algorithm-thinking": { base: "#d75c73", soft: "#f8dde3", text: "#873347", pale: "#fff5f7" }
};

type ViewMode = "overview" | "focus" | "detail";

type GraphNodeLevel = "root" | "overview" | "topic" | "detail";

type CategoryTheme = (typeof categoryTheme)[string];

const NODE_CONTAINER_WIDTH = 160;

const dotSizeByLevel: Record<GraphNodeLevel, number> = {
  root: 78,
  overview: 56,
  topic: 30,
  detail: 16
};

function getNodeOffset(level: GraphNodeLevel) {
  return { x: NODE_CONTAINER_WIDTH / 2, y: dotSizeByLevel[level] / 2 };
}

type GraphNodeData = {
  node: KnowledgeNode;
  status: ProgressStatus;
  inSearch: boolean;
  related: boolean;
  dimmed: boolean;
  level: GraphNodeLevel;
  viewMode: ViewMode;
  theme: CategoryTheme;
  childCount: number;
};

type GraphFlowNode = Node<GraphNodeData, "knowledge">;
type GraphFlowEdge = Edge<{ relation: KnowledgeEdge }>;

function KnowledgeGraphNode({ data, selected }: NodeProps<GraphFlowNode>) {
  const { node, status, inSearch, related, dimmed, level, viewMode, childCount } = data;
  const dotSize = dotSizeByLevel[level];
  const ringWidth = level === "root" ? 3 : level === "overview" ? 2 : 2;

  const dotBackground = statusColor[status];
  const dotBorder = statusRingColor[status];

  let boxShadow = `inset 0 0 0 1px ${dotBorder}`;
  if (selected) {
    boxShadow = `0 0 0 ${ringWidth + 2}px rgba(24, 34, 49, 0.85), 0 0 0 ${ringWidth + 4}px rgba(24, 34, 49, 0.15)`;
  } else if (related) {
    boxShadow = `0 0 0 ${ringWidth}px rgba(24, 34, 49, 0.55)`;
  }

  const dotStyle = {
    width: `${dotSize}px`,
    height: `${dotSize}px`,
    background: dotBackground,
    boxShadow
  };

  let opacity = 1;
  if (!inSearch) opacity = 0.1;
  else if (dimmed) opacity = 0.22;

  return (
    <div
      className={`graph-flow-node graph-flow-node-${level} graph-view-${viewMode} ${selected ? "active" : ""} ${
        related ? "related" : ""
      } ${dimmed ? "dimmed" : ""}`}
      style={{ opacity, width: `${NODE_CONTAINER_WIDTH}px` }}
      role="button"
      tabIndex={-1}
    >
      <Handle type="target" position={Position.Top} className="graph-handle" />
      <span className="graph-node-dot" style={dotStyle} aria-hidden />
      <span className="graph-node-label">
        <span className="graph-node-title">{node.name}</span>
        <span className="graph-node-meta">
          {level === "overview" ? `${childCount} 个知识点` : `难度 ${node.difficulty}`}
        </span>
      </span>
      <Handle type="source" position={Position.Bottom} className="graph-handle" />
    </div>
  );
}

const nodeTypes = {
  knowledge: KnowledgeGraphNode
} satisfies NodeTypes;

function getViewMode(zoom: number): ViewMode {
  if (zoom < zoomMode.overviewMax) return "overview";
  if (zoom < zoomMode.focusMax) return "focus";
  return "detail";
}

function getCategoryTheme(category: string) {
  return categoryTheme[category] ?? categoryTheme.basic;
}

function buildContainmentMaps(edges: KnowledgeEdge[]) {
  const parentById = new Map<string, string>();
  const childCountById = new Map<string, number>();

  edges.forEach((edge) => {
    if (edge.type !== "contains") return;
    parentById.set(edge.target, edge.source);
    childCountById.set(edge.source, (childCountById.get(edge.source) ?? 0) + 1);
  });

  return { parentById, childCountById };
}

function getOverviewAncestorId(nodeId: string, parentById: Map<string, string>) {
  let current = nodeId;
  let parent = parentById.get(current);

  while (parent && parent !== overviewRootId) {
    current = parent;
    parent = parentById.get(current);
  }

  return parent === overviewRootId ? current : nodeId;
}

function getNodeLevel(nodeId: string, parentById: Map<string, string>): GraphNodeLevel {
  if (nodeId === overviewRootId) return "root";
  const parent = parentById.get(nodeId);
  if (parent === overviewRootId) return "overview";
  const grandParent = parent ? parentById.get(parent) : undefined;
  if (grandParent === overviewRootId) return "topic";
  return "detail";
}

function shouldShowNode(level: GraphNodeLevel, viewMode: ViewMode, selected: boolean, related: boolean) {
  if (selected || related) return true;
  if (viewMode === "overview") return level === "root" || level === "overview";
  if (viewMode === "focus") return level !== "detail";
  return true;
}

function layoutNodes(nodes: KnowledgeNode[], edges: KnowledgeEdge[]) {
  const { parentById } = buildContainmentMaps(edges);
  const nodeIndexByCategory: Record<string, number> = {};

  return nodes.map((node) => {
    const level = getNodeLevel(node.id, parentById);
    const index = nodeIndexByCategory[node.category] ?? 0;
    nodeIndexByCategory[node.category] = index + 1;
    const base = categoryPosition[node.category] ?? { x: 480, y: 320 };
    const angle = index * 0.78;
    const radiusByLevel = {
      root: 0,
      overview: node.category === "basic" ? 130 : 0,
      topic: 168 + (index % 2) * 28,
      detail: 252 + (index % 3) * 30
    };
    const categoryOffset = {
      x: Math.cos(angle) * radiusByLevel[level],
      y: Math.sin(angle) * radiusByLevel[level]
    };

    return {
      ...node,
      x: base.x + categoryOffset.x,
      y: base.y + categoryOffset.y,
      level
    };
  });
}

export function GraphView({ nodes, edges, filteredIds, selectedId, progress, onSelect }: Props) {
  return (
    <ReactFlowProvider>
      <GraphFlow
        nodes={nodes}
        edges={edges}
        filteredIds={filteredIds}
        selectedId={selectedId}
        progress={progress}
        onSelect={onSelect}
      />
    </ReactFlowProvider>
  );
}

function GraphFlow({ nodes, edges, filteredIds, selectedId, progress, onSelect }: Props) {
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<GraphFlowNode>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<GraphFlowEdge>([]);
  const { getNode, setCenter } = useReactFlow<GraphFlowNode, GraphFlowEdge>();
  const { zoom } = useViewport();
  const viewMode = getViewMode(zoom);
  const { parentById, childCountById } = useMemo(() => buildContainmentMaps(edges), [edges]);

  const relatedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    edges.forEach((edge) => {
      if (edge.source === selectedId) ids.add(edge.target);
      if (edge.target === selectedId) ids.add(edge.source);
    });
    return ids;
  }, [edges, selectedId]);

  const nodeMetaById = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    return new Map(
      nodes.map((node) => {
        const overviewAncestorId = getOverviewAncestorId(node.id, parentById);
        const overviewAncestor = nodeById.get(overviewAncestorId) ?? node;
        const level = getNodeLevel(node.id, parentById);

        return [
          node.id,
          {
            level,
            theme: getCategoryTheme(level === "root" ? "root" : overviewAncestor.category),
            childCount: childCountById.get(node.id) ?? 0
          }
        ];
      })
    );
  }, [childCountById, nodes, parentById]);

  const positioned = useMemo(() => layoutNodes(nodes, edges), [edges, nodes]);

  useEffect(() => {
    setFlowNodes((previousNodes) => {
      const previousPositionById = new Map(previousNodes.map((node) => [node.id, node.position]));

      return positioned.map((node) => {
        const meta = nodeMetaById.get(node.id) ?? {
          level: "detail" as GraphNodeLevel,
          theme: getCategoryTheme(node.category),
          childCount: 0
        };
        const selected = node.id === selectedId;
        const related = relatedNodeIds.has(node.id);
        const visible = shouldShowNode(meta.level, viewMode, selected, related);
        const dimmed = Boolean(selectedId) && !selected && !related;
        const offset = getNodeOffset(meta.level);
        const position = previousPositionById.get(node.id) ?? {
          x: node.x - offset.x,
          y: node.y - offset.y
        };

        return {
          id: node.id,
          type: "knowledge",
          position,
          selected,
          hidden: !visible,
          data: {
            node,
            status: progress[node.id]?.status ?? "not_started",
            inSearch: filteredIds.has(node.id),
            related,
            dimmed,
            level: meta.level,
            viewMode,
            theme: meta.theme,
            childCount: meta.childCount
          }
        };
      });
    });
  }, [filteredIds, nodeMetaById, positioned, progress, relatedNodeIds, selectedId, setFlowNodes, viewMode]);

  useEffect(() => {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const visibleNodeIds = new Set(
      nodes
        .filter((node) => {
          const meta = nodeMetaById.get(node.id);
          return shouldShowNode(meta?.level ?? "detail", viewMode, node.id === selectedId, relatedNodeIds.has(node.id));
        })
        .map((node) => node.id)
    );

    setFlowEdges(
      edges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge) => {
          const highlighted = selectedId === edge.source || selectedId === edge.target;
          const color = edgeColor[edge.type];
          const inSearch = filteredIds.has(edge.source) || filteredIds.has(edge.target);
          const sourceVisible = visibleNodeIds.has(edge.source);
          const targetVisible = visibleNodeIds.has(edge.target);
          const overviewEdge = edge.source === overviewRootId || edge.target === overviewRootId;
          const showLabel = highlighted;

          return {
            id: `${edge.source}-${edge.target}-${edge.type}`,
            source: edge.source,
            target: edge.target,
            type: "straight",
            label: showLabel ? edge.label : "",
            hidden: !sourceVisible || !targetVisible || (viewMode === "overview" && !overviewEdge && !highlighted),
            animated: highlighted,
            data: { relation: edge },
            markerEnd: highlighted
              ? {
                  type: MarkerType.ArrowClosed,
                  color,
                  width: 14,
                  height: 14
                }
              : undefined,
            style: {
              stroke: highlighted ? color : "#94a3b8",
              strokeWidth: highlighted ? 2.4 : 1,
              opacity: highlighted
                ? 1
                : selectedId
                ? 0.05
                : inSearch
                ? viewMode === "overview"
                  ? 0.42
                  : 0.55
                : 0.08
            },
            labelStyle: {
              fill: "#5f6d7e",
              fontSize: 11,
              fontWeight: highlighted ? 700 : 500
            }
          };
        })
    );
  }, [edges, filteredIds, nodeMetaById, nodes, relatedNodeIds, selectedId, setFlowEdges, viewMode]);

  useEffect(() => {
    const selectedFlowNode = getNode(selectedId);
    if (selectedFlowNode) {
      const offset = getNodeOffset(selectedFlowNode.data.level);
      setCenter(selectedFlowNode.position.x + offset.x, selectedFlowNode.position.y + offset.y, {
        duration: 500,
        zoom: 1.15
      });
      return;
    }

    const selectedLayoutNode = positioned.find((node) => node.id === selectedId);
    if (selectedLayoutNode) {
      setCenter(selectedLayoutNode.x, selectedLayoutNode.y, { duration: 500, zoom: 1.15 });
    }
  }, [getNode, positioned, selectedId, setCenter]);

  const handleNodeClick = useCallback(
    (_event: MouseEvent, node: GraphFlowNode) => {
      onSelect(node.id);
    },
    [onSelect]
  );

  return (
    <div className="graph-canvas" role="img" aria-label="数据结构知识图谱">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.28}
        maxZoom={1.8}
        nodesDraggable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
      >
        <Background color="#d8e0ec" gap={20} />
        <MiniMap
          nodeColor={(node) => statusColor[(node as GraphFlowNode).data.status]}
          nodeStrokeWidth={3}
          pannable
          zoomable
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

