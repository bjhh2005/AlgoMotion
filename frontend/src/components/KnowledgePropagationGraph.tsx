import { useMemo, useState } from "react";
import type { KnowledgeNode, KnowledgeEdge, PropagationAnalysis } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  propagationAnalyses: PropagationAnalysis[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  width?: number;
  height?: number;
}

// 知识图谱动态传播图组件 - 维度一：知识关联结构
export function KnowledgePropagationGraph({
  nodes,
  edges,
  propagationAnalyses,
  selectedNodeId,
  onNodeClick,
  width = 600,
  height = 400,
}: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  
  // 按类别分组节点
  const categoryGroups = useMemo(() => {
    const groups: Record<string, KnowledgeNode[]> = {};
    nodes.forEach((node) => {
      if (!groups[node.category]) {
        groups[node.category] = [];
      }
      groups[node.category].push(node);
    });
    return groups;
  }, [nodes]);
  
  // 计算节点位置（基于类别分组布局）
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const categories = Object.keys(categoryGroups);
    const categoryWidth = width / (categories.length + 1);
    const padding = 40;
    
    categories.forEach((category, catIdx) => {
      const nodesInCategory = categoryGroups[category];
      const categoryHeight = (height - padding * 2) / (nodesInCategory.length + 1);
      
      nodesInCategory.forEach((node, nodeIdx) => {
        positions[node.id] = {
          x: categoryWidth * (catIdx + 1),
          y: padding + categoryHeight * (nodeIdx + 1),
        };
      });
    });
    
    return positions;
  }, [categoryGroups, width, height]);
  
  // 获取节点颜色（基于传播分析）
  const getNodeColor = (nodeId: string): { fill: string; stroke: string; opacity: number } => {
    // 检查是否是薄弱节点
    const isWeak = propagationAnalyses.some((p) => p.sourceNodeId === nodeId);
    
    if (isWeak) {
      const analysis = propagationAnalyses.find((p) => p.sourceNodeId === nodeId);
      const severity = analysis?.weaknessSeverity ?? 0.5;
      
      if (severity >= 0.8) return { fill: "#ef4444", stroke: "#dc2626", opacity: 1 };
      if (severity >= 0.6) return { fill: "#f97316", stroke: "#ea580c", opacity: 1 };
      if (severity >= 0.4) return { fill: "#f59e0b", stroke: "#d97706", opacity: 1 };
      return { fill: "#eab308", stroke: "#ca8a04", opacity: 1 };
    }
    
    // 检查是否受其他薄弱节点影响
    const isAffected = propagationAnalyses.some((p) =>
      p.affectedNodes.some((n) => n.nodeId === nodeId)
    );
    
    if (isAffected) {
      const strength = propagationAnalyses.reduce((max, p) => {
        const affected = p.affectedNodes.find((n) => n.nodeId === nodeId);
        return affected ? Math.max(max, affected.propagationStrength) : max;
      }, 0);
      
      return {
        fill: "#fef3c7",
        stroke: "#f59e0b",
        opacity: 0.4 + strength * 0.6,
      };
    }
    
    // 正常状态
    return { fill: "#e2e8f0", stroke: "#94a3b8", opacity: 1 };
  };
  
  // 获取边的颜色和样式
  const getEdgeStyle = (
    sourceId: string,
    targetId: string
  ): { stroke: string; strokeDasharray: string; opacity: number } => {
    const isPropagationPath = propagationAnalyses.some((p) =>
      p.affectedNodes.some((n) => n.nodeId === targetId && p.sourceNodeId === sourceId)
    );
    
    if (isPropagationPath) {
      const analysis = propagationAnalyses.find((p) =>
        p.affectedNodes.some((n) => n.nodeId === targetId && p.sourceNodeId === sourceId)
      );
      const affected = analysis?.affectedNodes.find((n) => n.nodeId === targetId);
      const strength = affected?.propagationStrength ?? 0.5;
      
      return {
        stroke: "#ef4444",
        strokeDasharray: "8,4",
        opacity: strength,
      };
    }
    
    return { stroke: "#cbd5e1", strokeDasharray: "", opacity: 0.6 };
  };
  
  // 类别颜色映射
  const categoryColors: Record<string, string> = {
    root: "#7c3aed",
    basic: "#3b82f6",
    linear: "#10b981",
    tree: "#f59e0b",
    graph: "#ef4444",
    search: "#8b5cf6",
    sorting: "#06b6d4",
  };
  
  const categoryNames: Record<string, string> = {
    root: "根节点",
    basic: "基础",
    linear: "线性结构",
    tree: "树形结构",
    graph: "图结构",
    search: "查找算法",
    sorting: "排序算法",
  };
  
  return (
    <div className="knowledge-propagation-graph">
      <div className="propagation-header">
        <h5>知识传播影响图</h5>
        <div className="propagation-legend">
          <span className="legend-item">
            <span className="dot weak-critical" />严重
          </span>
          <span className="legend-item">
            <span className="dot weak-high" />较高
          </span>
          <span className="legend-item">
            <span className="dot weak-medium" />中等
          </span>
          <span className="legend-item">
            <span className="dot affected" />受影响
          </span>
          <span className="legend-item">
            <span className="dot normal" />正常
          </span>
        </div>
      </div>
      
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* 发光效果 */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* 箭头标记 */}
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
          
          <marker
            id="arrowhead-warning"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
          </marker>
        </defs>
        
        {/* 类别背景 */}
        {Object.entries(categoryGroups).map(([category, catNodes], catIdx) => {
          const positions = catNodes.map((n) => nodePositions[n.id]);
          const minX = Math.min(...positions.map((p) => p.x)) - 40;
          const maxX = Math.max(...positions.map((p) => p.x)) + 40;
          const minY = Math.min(...positions.map((p) => p.y)) - 20;
          const maxY = Math.max(...positions.map((p) => p.y)) + 20;
          
          return (
            <g key={category}>
              <rect
                x={minX}
                y={minY}
                width={maxX - minX}
                height={maxY - minY}
                fill={categoryColors[category] || "#94a3b8"}
                fillOpacity={0.05}
                rx={8}
              />
              <text
                x={minX + 10}
                y={minY + 16}
                fill={categoryColors[category] || "#94a3b8"}
                fontSize="11"
                fontWeight="600"
                opacity={0.8}
              >
                {categoryNames[category] || category}
              </text>
            </g>
          );
        })}
        
        {/* 边 */}
        <g className="edges">
          {edges.map((edge, idx) => {
            const sourcePos = nodePositions[edge.source];
            const targetPos = nodePositions[edge.target];
            
            if (!sourcePos || !targetPos) return null;
            
            const edgeStyle = getEdgeStyle(edge.source, edge.target);
            const marker = edgeStyle.stroke === "#ef4444" ? "url(#arrowhead-warning)" : "url(#arrowhead)";
            
            // 计算边的起点和终点（避开节点圆）
            const dx = targetPos.x - sourcePos.x;
            const dy = targetPos.y - sourcePos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const startX = sourcePos.x + (dx / dist) * 20;
            const startY = sourcePos.y + (dy / dist) * 20;
            const endX = targetPos.x - (dx / dist) * 20;
            const endY = targetPos.y - (dy / dist) * 20;
            
            return (
              <line
                key={idx}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                stroke={edgeStyle.stroke}
                strokeWidth={edgeStyle.stroke === "#ef4444" ? 2 : 1.5}
                strokeDasharray={edgeStyle.strokeDasharray}
                opacity={edgeStyle.opacity}
                markerEnd={marker}
              />
            );
          })}
        </g>
        
        {/* 节点 */}
        <g className="nodes">
          {nodes.map((node) => {
            const pos = nodePositions[node.id];
            if (!pos) return null;
            
            const colors = getNodeColor(node.id);
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNode === node.id;
            const nodeRadius = isSelected || isHovered ? 16 : 14;
            
            // 检查是否是传播源
            const isSource = propagationAnalyses.some((p) => p.sourceNodeId === node.id);
            const analysis = propagationAnalyses.find((p) => p.sourceNodeId === node.id);
            
            return (
              <g
                key={node.id}
                className="propagation-node"
                transform={`translate(${pos.x}, ${pos.y})`}
                onClick={() => onNodeClick(node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                {/* 外发光（薄弱节点） */}
                {isSource && (
                  <circle
                    r={nodeRadius + 6}
                    fill="none"
                    stroke={colors.fill}
                    strokeWidth={2}
                    opacity={0.4}
                    filter="url(#glow)"
                  />
                )}
                
                {/* 主体圆 */}
                <circle
                  r={nodeRadius}
                  fill={colors.fill}
                  stroke={isSelected ? "#182231" : colors.stroke}
                  strokeWidth={isSelected ? 3 : 2}
                  opacity={colors.opacity}
                />
                
                {/* 节点标签 */}
                <text
                  y={nodeRadius + 16}
                  textAnchor="middle"
                  fill="#475569"
                  fontSize="10"
                  fontWeight="600"
                >
                  {node.name.length > 8 ? node.name.slice(0, 8) + "..." : node.name}
                </text>
                
                {/* 风险图标 */}
                {isSource && analysis && (
                  <g transform={`translate(${nodeRadius - 4}, ${-nodeRadius + 4})`}>
                    <circle r={8} fill="#ef4444" />
                    <text y={3} textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                      !
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      
      {/* 传播影响详情 */}
      {selectedNodeId && (
        <div className="propagation-details">
          {(() => {
            const analysis = propagationAnalyses.find((p) => p.sourceNodeId === selectedNodeId);
            const node = nodes.find((n) => n.id === selectedNodeId);
            
            if (!analysis || !node) {
              return (
                <div className="detail-info">
                  <p>选择 "{node?.name || selectedNodeId}" 查看传播影响详情</p>
                  <p className="hint">当前节点暂无传播风险分析数据</p>
                </div>
              );
            }
            
            return (
              <>
                <div className="detail-header">
                  <h6>{node.name}</h6>
                  <span className={`risk-badge risk-${analysis.downstreamRisk}`}>
                    {analysis.downstreamRisk === "critical" ? "严重" :
                     analysis.downstreamRisk === "high" ? "高" :
                     analysis.downstreamRisk === "medium" ? "中" : "低"}风险
                  </span>
                </div>
                <div className="detail-stats">
                  <div className="stat">
                    <span className="stat-label">薄弱严重度</span>
                    <span className="stat-value">{Math.round(analysis.weaknessSeverity * 100)}%</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">影响节点数</span>
                    <span className="stat-value">{analysis.affectedNodes.length}</span>
                  </div>
                </div>
                {analysis.affectedNodes.length > 0 && (
                  <div className="affected-list">
                    <p className="list-title">受影响的下游知识点：</p>
                    {analysis.affectedNodes.map((affected) => {
                      const affectedNode = nodes.find((n) => n.id === affected.nodeId);
                      return (
                        <div key={affected.nodeId} className="affected-item">
                          <span className="affected-name">{affectedNode?.name || affected.nodeId}</span>
                          <span className={`path-type ${affected.pathType}`}>
                            {affected.pathType === "prerequisite" ? "前置依赖" :
                             affected.pathType === "used_in" ? "应用关系" : "相关"}
                          </span>
                          {affected.rootCause && (
                            <span className="root-cause-badge">根本原因</span>
                          )}
                          <div className="propagation-bar">
                            <div
                              className="propagation-fill"
                              style={{ width: `${affected.propagationStrength * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
