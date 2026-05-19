import { useState, useMemo } from "react";
import type { KnowledgeNode, ProgressMap, ProgressStatus } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  edges: { source: string; target: string }[];
  progress: ProgressMap;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}

// 获取掌握度颜色
function getMasteryColor(mastery: number): string {
  if (mastery >= 0.8) return "#10b981"; // 绿 - 掌握
  if (mastery >= 0.6) return "#3b82f6"; // 蓝 - 良好
  if (mastery >= 0.4) return "#f59e0b"; // 黄 - 一般
  if (mastery >= 0.2) return "#f97316"; // 橙 - 薄弱
  return "#ef4444"; // 红 - 危险
}

// 获取状态标签
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    mastered: "已掌握",
    learning: "学习中",
    weak: "需巩固",
    not_started: "未开始",
  };
  return labels[status] || status;
}

// 获取分类颜色
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    mastered: "#10b981",
    learning: "#3b82f6",
    weak: "#f59e0b",
    not_started: "#94a3b8",
  };
  return colors[category] || "#94a3b8";
}

// 知识掌握热力图 - 按掌握情况分类
export function KnowledgeHeatmap({ nodes, edges, progress, selectedNodeId, onSelect }: Props) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"mastery" | "name" | "difficulty">("mastery");
  
  // 构建依赖关系
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  
  // 计算每个节点的入度和出度
  const nodeConnections = useMemo(() => {
    const map = new Map<string, { prerequisites: number; dependents: number }>();
    nodes.forEach((n) => {
      const prerequisites = edges.filter((e) => e.target === n.id).length;
      const dependents = edges.filter((e) => e.source === n.id).length;
      map.set(n.id, { prerequisites, dependents });
    });
    return map;
  }, [nodes, edges]);
  
  // 按掌握情况分组
  const categorizedNodes = useMemo(() => {
    const categories = {
      mastered: [] as typeof nodes,
      learning: [] as typeof nodes,
      weak: [] as typeof nodes,
      not_started: [] as typeof nodes,
    };
    
    nodes.forEach((node) => {
      const status = progress[node.id]?.status || "not_started";
      categories[status].push(node);
    });
    
    return categories;
  }, [nodes, progress]);
  
  // 过滤和排序节点
  const filteredNodes = useMemo(() => {
    let result = nodes;
    
    // 按分类过滤
    if (filterCategory !== "all") {
      result = nodes.filter((node) => {
        const status = progress[node.id]?.status || "not_started";
        return status === filterCategory;
      });
    }
    
    // 排序
    result = [...result].sort((a, b) => {
      if (sortBy === "mastery") {
        const masteryA = progress[a.id]?.metrics.mastery ?? 0;
        const masteryB = progress[b.id]?.metrics.mastery ?? 0;
        return masteryB - masteryA;
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else {
        return a.difficulty - b.difficulty;
      }
    });
    
    return result;
  }, [nodes, progress, filterCategory, sortBy]);
  
  // 获取下游知识点
  const getDownstreamNodes = (nodeId: string) => {
    return edges.filter((e) => e.source === nodeId).map((e) => nodeMap.get(e.target)).filter(Boolean);
  };
  
  // 获取上游知识点
  const getUpstreamNodes = (nodeId: string) => {
    return edges.filter((e) => e.target === nodeId).map((e) => nodeMap.get(e.source)).filter(Boolean);
  };
  
  const categories = [
    { id: "all", label: "全部", count: nodes.length, color: "#64748b" },
    { id: "mastered", label: "已掌握", count: categorizedNodes.mastered.length, color: "#10b981" },
    { id: "learning", label: "学习中", count: categorizedNodes.learning.length, color: "#3b82f6" },
    { id: "weak", label: "需巩固", count: categorizedNodes.weak.length, color: "#f59e0b" },
    { id: "not_started", label: "未开始", count: categorizedNodes.not_started.length, color: "#94a3b8" },
  ];
  
  return (
    <div className="knowledge-heatmap">
      <div className="heatmap-header">
        <h5>📊 知识掌握热力图</h5>
        <div className="heatmap-controls">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as "mastery" | "name" | "difficulty")}
            className="heatmap-sort-select"
          >
            <option value="mastery">按掌握度</option>
            <option value="name">按名称</option>
            <option value="difficulty">按难度</option>
          </select>
        </div>
      </div>
      
      {/* 分类筛选器 */}
      <div className="heatmap-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-tab ${filterCategory === cat.id ? "active" : ""}`}
            style={{
              borderColor: filterCategory === cat.id ? cat.color : "transparent",
              color: filterCategory === cat.id ? cat.color : "#64748b",
            }}
            onClick={() => setFilterCategory(cat.id)}
          >
            <span className="tab-dot" style={{ backgroundColor: cat.color }} />
            {cat.label}
            <span className="tab-count">{cat.count}</span>
          </button>
        ))}
      </div>
      
      {/* 分类统计 */}
      <div className="heatmap-stats">
        <div className="stat-bar">
          <div 
            className="stat-segment mastered" 
            style={{ width: `${(categorizedNodes.mastered.length / nodes.length) * 100}%` }}
            title={`已掌握: ${categorizedNodes.mastered.length}`}
          />
          <div 
            className="stat-segment learning" 
            style={{ width: `${(categorizedNodes.learning.length / nodes.length) * 100}%` }}
            title={`学习中: ${categorizedNodes.learning.length}`}
          />
          <div 
            className="stat-segment weak" 
            style={{ width: `${(categorizedNodes.weak.length / nodes.length) * 100}%` }}
            title={`需巩固: ${categorizedNodes.weak.length}`}
          />
          <div 
            className="stat-segment not_started" 
            style={{ width: `${(categorizedNodes.not_started.length / nodes.length) * 100}%` }}
            title={`未开始: ${categorizedNodes.not_started.length}`}
          />
        </div>
      </div>
      
      {/* 热力图网格 */}
      <div className="heatmap-grid">
        {filteredNodes.map((node) => {
          const record = progress[node.id];
          const mastery = record?.metrics.mastery ?? 0;
          const status = record?.status ?? "not_started";
          const color = getMasteryColor(mastery);
          const connections = nodeConnections.get(node.id);
          const isSelected = selectedNodeId === node.id;
          
          return (
            <div
              key={node.id}
              className={`heatmap-cell ${isSelected ? "selected" : ""}`}
              style={{ 
                borderLeft: `4px solid ${color}`,
                backgroundColor: isSelected ? `${color}15` : undefined,
              }}
              onClick={() => onSelect(node.id)}
              title={`${node.name}\n掌握度: ${Math.round(mastery * 100)}%\n前置: ${connections?.prerequisites || 0} | 依赖: ${connections?.dependents || 0}`}
            >
              <div className="cell-name">{node.name}</div>
              <div className="cell-mastery">
                <div className="mastery-bar">
                  <div className="mastery-fill" style={{ width: `${mastery * 100}%`, backgroundColor: color }} />
                </div>
                <span className="mastery-value" style={{ color }}>{Math.round(mastery * 100)}%</span>
              </div>
              <div className="cell-meta">
                <span className="status-badge" style={{ backgroundColor: `${color}20`, color }}>{getStatusLabel(status)}</span>
                <span className="connections">↑{connections?.prerequisites || 0} ↓{connections?.dependents || 0}</span>
              </div>
            </div>
          );
        })}
        {filteredNodes.length === 0 && (
          <div className="heatmap-empty">该分类下暂无知识点</div>
        )}
      </div>
      
      {/* 底部图例 */}
      <div className="heatmap-legend">
        <span className="legend-item"><span className="dot" style={{ background: "#10b981" }} /> 已掌握 (≥80%)</span>
        <span className="legend-item"><span className="dot" style={{ background: "#3b82f6" }} /> 良好 (60-80%)</span>
        <span className="legend-item"><span className="dot" style={{ background: "#f59e0b" }} /> 一般 (40-60%)</span>
        <span className="legend-item"><span className="dot" style={{ background: "#f97316" }} /> 薄弱 (20-40%)</span>
        <span className="legend-item"><span className="dot" style={{ background: "#ef4444" }} /> 危险 (&lt;20%)</span>
      </div>
      
      {/* 选中节点详情 */}
      {selectedNodeId && nodeMap.get(selectedNodeId) && (
        <div className="heatmap-detail">
          {(() => {
            const node = nodeMap.get(selectedNodeId)!;
            const record = progress[selectedNodeId];
            const upstream = getUpstreamNodes(selectedNodeId);
            const downstream = getDownstreamNodes(selectedNodeId);
            
            return (
              <>
                <div className="detail-section">
                  <h6>前置知识 ({upstream.length})</h6>
                  <div className="detail-tags">
                    {upstream.length > 0 ? upstream.map((n) => {
                      const pRecord = progress[n!.id];
                      const pMastery = pRecord?.metrics.mastery ?? 0;
                      return (
                        <span key={n!.id} className="tag" style={{ borderColor: getMasteryColor(pMastery) }}>
                          {n!.name} ({Math.round(pMastery * 100)}%)
                        </span>
                      );
                    }) : <span className="no-data">无前置依赖</span>}
                  </div>
                </div>
                <div className="detail-section">
                  <h6>下游知识 ({downstream.length})</h6>
                  <div className="detail-tags">
                    {downstream.length > 0 ? downstream.map((n) => {
                      const dRecord = progress[n!.id];
                      const dMastery = dRecord?.metrics.mastery ?? 0;
                      return (
                        <span key={n!.id} className="tag" style={{ borderColor: getMasteryColor(dMastery) }}>
                          {n!.name} ({Math.round(dMastery * 100)}%)
                        </span>
                      );
                    }) : <span className="no-data">无下游依赖</span>}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
