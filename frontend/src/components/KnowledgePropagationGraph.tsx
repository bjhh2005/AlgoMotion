import { useMemo, useState } from "react";
import type { KnowledgeNode, KnowledgeEdge, PropagationAnalysis, ProgressMap } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  propagationAnalyses: PropagationAnalysis[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  progress?: ProgressMap;
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
  progress,
  width = 1100,
  height: _height = 600,
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

  // 根据最大节点列数自适应高度
  const nodeSpacing = 42;
  const verticalPadding = 50;
  const maxNodesInCategory = Math.max(
    ...Object.values(categoryGroups).map((g) => g.length),
    1
  );
  const height = Math.max(400, verticalPadding * 2 + (maxNodesInCategory - 1) * nodeSpacing + 40);
  
  // 计算节点位置（基于类别分组布局）
  const nodePositions = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {};
    const categories = Object.keys(categoryGroups);
    const categoryWidth = width / (categories.length + 1);
    
    categories.forEach((category, catIdx) => {
      const nodesInCategory = categoryGroups[category];
      const availableHeight = height - verticalPadding * 2;
      const totalHeight = (nodesInCategory.length - 1) * nodeSpacing;
      const startY = verticalPadding + (availableHeight - totalHeight) / 2;
      
      nodesInCategory.forEach((node, nodeIdx) => {
        positions[node.id] = {
          x: categoryWidth * (catIdx + 1),
          y: startY + nodeSpacing * nodeIdx,
        };
      });
    });
    
    return positions;
  }, [categoryGroups, width, height]);
  
  // 获取节点颜色（基于传播分析）
  const getNodeColor = (nodeId: string): { fill: string; stroke: string; opacity: number } => {
    const isWeak = propagationAnalyses.some((p) => p.sourceNodeId === nodeId);
    
    if (isWeak) {
      const analysis = propagationAnalyses.find((p) => p.sourceNodeId === nodeId);
      const severity = analysis?.weaknessSeverity ?? 0.5;
      
      if (severity >= 0.8) return { fill: "#ef4444", stroke: "#dc2626", opacity: 1 };
      if (severity >= 0.6) return { fill: "#f97316", stroke: "#ea580c", opacity: 1 };
      if (severity >= 0.4) return { fill: "#f59e0b", stroke: "#d97706", opacity: 1 };
      return { fill: "#eab308", stroke: "#ca8a04", opacity: 1 };
    }
    
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
    
    const nodeProgress = progress?.[nodeId];
    const mastery = nodeProgress?.metrics?.mastery ?? 0;
    const nodeStatus = nodeProgress?.status;
    
    if (nodeStatus === "mastered" || mastery >= 0.8) {
      return { fill: "#bbf7d0", stroke: "#22c55e", opacity: 1 };
    }
    if (nodeStatus === "learning" || mastery >= 0.4) {
      return { fill: "#bfdbfe", stroke: "#3b82f6", opacity: 1 };
    }
    
    return { fill: "#e2e8f0", stroke: "#94a3b8", opacity: 1 };
  };
  
  // 获取边的颜色和样式
  const getEdgeStyle = (
    sourceId: string,
    targetId: string
  ): { stroke: string; strokeDasharray: string; opacity: number; strokeWidth: number } => {
    const isPropagationPath = propagationAnalyses.some((p) =>
      p.affectedNodes.some((n) => n.nodeId === targetId && p.sourceNodeId === sourceId)
    );

    const isConnectedToSelected = selectedNodeId === sourceId || selectedNodeId === targetId;

    if (selectedNodeId && isConnectedToSelected) {
      if (isPropagationPath) {
        const affected = propagationAnalyses
          .find((p) => p.affectedNodes.some((n) => n.nodeId === targetId && p.sourceNodeId === sourceId))
          ?.affectedNodes.find((n) => n.nodeId === targetId);
        return {
          stroke: "#ef4444",
          strokeDasharray: "8,4",
          opacity: 1,
          strokeWidth: 2.5,
        };
      }
      const isOutgoing = selectedNodeId === sourceId;
      return {
        stroke: isOutgoing ? "#6366f1" : "#3b82f6",
        strokeDasharray: "",
        opacity: 0.9,
        strokeWidth: 2,
      };
    }

    if (isPropagationPath) {
      const affected = propagationAnalyses
        .find((p) => p.affectedNodes.some((n) => n.nodeId === targetId && p.sourceNodeId === sourceId))
        ?.affectedNodes.find((n) => n.nodeId === targetId);
      const strength = affected?.propagationStrength ?? 0.5;
      return {
        stroke: "#ef4444",
        strokeDasharray: "8,4",
        opacity: selectedNodeId ? 0.15 : strength * 0.6,
        strokeWidth: 1.5,
      };
    }

    return {
      stroke: "#cbd5e1",
      strokeDasharray: "",
      opacity: selectedNodeId ? 0.12 : 0.4,
      strokeWidth: 1,
    };
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
        <div className="propagation-title-row">
          <h5>知识传播影响图</h5>
          {selectedNodeId && (
            <button className="reset-view-btn" onClick={() => onNodeClick("")}>
              查看整体
            </button>
          )}
        </div>
        <p className="propagation-explanation">
          展示知识点之间的依赖与影响关系。红色节点为薄弱点，其掌握不足会沿依赖链传播影响下游知识；
          黄色节点为受影响节点。点击任意节点可查看其学习状态和传播详情。
        </p>
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
            <span className="dot normal" />未开始
          </span>
          <span className="legend-item">
            <span className="dot" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#bfdbfe", border: "1.5px solid #3b82f6" }} />学习中
          </span>
          <span className="legend-item">
            <span className="dot" style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#bbf7d0", border: "1.5px solid #22c55e" }} />已掌握
          </span>
        </div>
      </div>
      
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
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
          const minX = Math.min(...positions.map((p) => p.x)) - 50;
          const maxX = Math.max(...positions.map((p) => p.x)) + 50;
          const minY = Math.min(...positions.map((p) => p.y)) - 28;
          const maxY = Math.max(...positions.map((p) => p.y)) + 28;
          
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
            const isConnectedToSelected = selectedNodeId === edge.source || selectedNodeId === edge.target;
            
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
                strokeWidth={edgeStyle.strokeWidth}
                strokeDasharray={edgeStyle.strokeDasharray}
                opacity={edgeStyle.opacity}
                markerEnd={isConnectedToSelected ? marker : undefined}
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
            const isNeighbor = selectedNodeId ? edges.some(
              (e) => (e.source === selectedNodeId && e.target === node.id) ||
                     (e.target === selectedNodeId && e.source === node.id)
            ) : false;
            const isDimmed = selectedNodeId && !isSelected && !isNeighbor;
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
                style={{ cursor: "pointer", opacity: isDimmed ? 0.25 : 1, transition: "opacity 0.2s" }}
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
                  y={nodeRadius + 14}
                  textAnchor="middle"
                  fill="#475569"
                  fontSize="9"
                  fontWeight="500"
                >
                  {node.name.length > 6 ? node.name.slice(0, 6) + ".." : node.name}
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
      
      {/* 节点详情 */}
      {selectedNodeId && (
        <div className="propagation-details">
          {(() => {
            const node = nodes.find((n) => n.id === selectedNodeId);
            if (!node) return null;

            const analysis = propagationAnalyses.find((p) => p.sourceNodeId === selectedNodeId);
            const nodeProgress = progress?.[selectedNodeId];
            const mastery = nodeProgress?.metrics?.mastery ?? 0;
            const status = nodeProgress?.status ?? "not_started";
            const attemptCount = nodeProgress?.metrics?.attemptCount ?? 0;
            const studyMinutes = nodeProgress?.metrics?.studyMinutes ?? 0;
            const isAffected = propagationAnalyses.some((p) =>
              p.affectedNodes.some((n) => n.nodeId === selectedNodeId)
            );
            const affectingAnalyses = propagationAnalyses.filter((p) =>
              p.affectedNodes.some((n) => n.nodeId === selectedNodeId)
            );

            const statusLabels: Record<string, string> = {
              mastered: "已掌握",
              learning: "学习中",
              weak: "需巩固",
              not_started: "未开始",
            };
            const statusColors: Record<string, string> = {
              mastered: "#27ae60",
              learning: "#3498db",
              weak: "#e67e22",
              not_started: "#95a5a6",
            };

            return (
              <>
                <div className="detail-header">
                  <h6>{node.name}</h6>
                  <span className={`risk-badge risk-${analysis?.downstreamRisk ?? "none"}`}
                    style={!analysis ? { background: statusColors[status] || "#95a5a6", color: "#fff" } : undefined}>
                    {analysis
                      ? (analysis.downstreamRisk === "critical" ? "严重风险" :
                         analysis.downstreamRisk === "high" ? "高风险" :
                         analysis.downstreamRisk === "medium" ? "中风险" : "低风险")
                      : statusLabels[status] || status}
                  </span>
                </div>
                <div className="detail-stats">
                  <div className="stat">
                    <span className="stat-label">掌握度</span>
                    <span className="stat-value">{Math.round(mastery * 100)}%</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">练习次数</span>
                    <span className="stat-value">{attemptCount}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">学习时长</span>
                    <span className="stat-value">{studyMinutes}min</span>
                  </div>
                  {analysis && (
                    <div className="stat">
                      <span className="stat-label">薄弱严重度</span>
                      <span className="stat-value">{Math.round(analysis.weaknessSeverity * 100)}%</span>
                    </div>
                  )}
                </div>

                {analysis && analysis.affectedNodes.length > 0 && (
                  <div className="affected-list">
                    <p className="list-title">该薄弱点影响的下游知识点：</p>
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

                {isAffected && affectingAnalyses.length > 0 && (
                  <div className="affected-list">
                    <p className="list-title">受以下薄弱点影响：</p>
                    {affectingAnalyses.map((pa) => {
                      const srcNode = nodes.find((n) => n.id === pa.sourceNodeId);
                      const affectedEntry = pa.affectedNodes.find((n) => n.nodeId === selectedNodeId);
                      return (
                        <div key={pa.sourceNodeId} className="affected-item">
                          <span className="affected-name">{srcNode?.name || pa.sourceNodeId}</span>
                          <span className="path-type">
                            传播强度 {Math.round((affectedEntry?.propagationStrength ?? 0) * 100)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!analysis && !isAffected && (
                  <p className="hint" style={{ color: "#7f8c8d", fontSize: "12px", marginTop: "8px" }}>
                    该节点状态正常，无传播风险
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
