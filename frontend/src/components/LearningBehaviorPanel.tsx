import type { KnowledgeNode, BehaviorAnalysis, DiscriminationAnalysis } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  behaviorAnalyses: Record<string, BehaviorAnalysis>;
  questionDiscriminations: DiscriminationAnalysis[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

// 学习行为分析面板组件 - 维度二：学习质量深度
export function LearningBehaviorPanel({
  nodes,
  behaviorAnalyses,
  questionDiscriminations,
  selectedNodeId,
  onSelectNode,
}: Props) {
  // 获取行为评分
  const getBehaviorScore = (behavior: BehaviorAnalysis): { score: number; label: string; color: string } => {
    const score = Math.round(
      behavior.consistency * 0.3 +
      (1 - behavior.rushRate) * 0.2 +
      (1 - behavior.hesitationRate) * 0.15 +
      (1 - behavior.guessRate) * 0.2 +
      0.15 * 100
    );
    
    if (score >= 80) return { score, label: "优秀", color: "#10b981" };
    if (score >= 60) return { score, label: "良好", color: "#3b82f6" };
    if (score >= 40) return { score, label: "一般", color: "#f59e0b" };
    return { score, label: "需关注", color: "#ef4444" };
  };
  
  // 获取题目区分度评级
  const getDiscriminationRating = (disc: DiscriminationAnalysis): { label: string; color: string } => {
    switch (disc.effectiveness) {
      case "excellent":
        return { label: "优秀", color: "#10b981" };
      case "good":
        return { label: "良好", color: "#3b82f6" };
      case "acceptable":
        return { label: "一般", color: "#f59e0b" };
      case "poor":
        return { label: "较差", color: "#ef4444" };
    }
  };
  
  // 统计概览
  const overallStats = {
    totalBehaviors: Object.keys(behaviorAnalyses).length,
    suspiciousCount: Object.values(behaviorAnalyses).filter((b) => b.suspiciousFlag).length,
    avgConsistency: Object.values(behaviorAnalyses).length > 0
      ? Math.round(
          Object.values(behaviorAnalyses).reduce((sum, b) => sum + b.consistency, 0) /
          Object.values(behaviorAnalyses).length * 100
        )
      : 0,
    avgRushRate: Object.values(behaviorAnalyses).length > 0
      ? Math.round(
          Object.values(behaviorAnalyses).reduce((sum, b) => sum + b.rushRate, 0) /
          Object.values(behaviorAnalyses).length * 100
        )
      : 0,
  };
  
  return (
    <div className="learning-behavior-panel">
      <div className="behavior-header">
        <h5>学习行为与题目分析</h5>
        <div className="behavior-stats">
          <span className="stat">
            <span className="stat-value">{overallStats.totalBehaviors}</span>
            <span className="stat-label">知识点</span>
          </span>
          <span className="stat">
            <span className="stat-value warning">{overallStats.suspiciousCount}</span>
            <span className="stat-label">可疑</span>
          </span>
          <span className="stat">
            <span className="stat-value">{overallStats.avgConsistency}%</span>
            <span className="stat-label">一致性</span>
          </span>
        </div>
      </div>
      
      <div className="behavior-content">
        {/* 行为分析列表 */}
        <div className="behavior-list">
          <h6>答题行为分析</h6>
          <div className="behavior-items">
            {Object.entries(behaviorAnalyses).map(([nodeId, behavior]) => {
              const node = nodes.find((n) => n.id === nodeId);
              const rating = getBehaviorScore(behavior);
              
              return (
                <div
                  key={nodeId}
                  className={`behavior-item ${selectedNodeId === nodeId ? "selected" : ""} ${behavior.suspiciousFlag ? "suspicious" : ""}`}
                  onClick={() => onSelectNode(nodeId)}
                >
                  <div className="item-header">
                    <span className="node-name">{node?.name || nodeId}</span>
                    <span className="behavior-score" style={{ color: rating.color }}>
                      {rating.score}分
                    </span>
                  </div>
                  
                  <div className="behavior-metrics">
                    <div className="metric">
                      <span className="metric-label">平均耗时</span>
                      <span className="metric-value">{Math.round(behavior.averageTimePerQuestion)}s</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">仓促率</span>
                      <span className={`metric-value ${behavior.rushRate > 0.3 ? "warning" : ""}`}>
                        {Math.round(behavior.rushRate * 100)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">蒙猜率</span>
                      <span className={`metric-value ${behavior.guessRate > 0.3 ? "warning" : ""}`}>
                        {Math.round(behavior.guessRate * 100)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">一致性</span>
                      <span className="metric-value">{Math.round(behavior.consistency * 100)}%</span>
                    </div>
                  </div>
                  
                  {behavior.suspiciousFlag && (
                    <div className="suspicious-badge">
                      <span className="badge-icon">!</span>
                      <span className="badge-text">{behavior.suspiciousReason || "可疑学习行为"}</span>
                    </div>
                  )}
                </div>
              );
            })}
            
            {Object.keys(behaviorAnalyses).length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <p>暂无行为分析数据</p>
                <p className="empty-hint">开始学习后将自动生成分析</p>
              </div>
            )}
          </div>
        </div>
        
        {/* 题目区分度分析 */}
        <div className="discrimination-list">
          <h6>题目区分度分析</h6>
          <div className="discrimination-items">
            {questionDiscriminations.slice(0, 10).map((disc) => {
              const rating = getDiscriminationRating(disc);
              const barWidth = Math.abs(disc.discriminationIndex) * 100;
              
              return (
                <div key={disc.exerciseId} className="discrimination-item">
                  <div className="item-header">
                    <span className="exercise-id">{disc.exerciseId}</span>
                    <span className="disc-badge" style={{ backgroundColor: rating.color }}>
                      {rating.label}
                    </span>
                  </div>
                  
                  <div className="disc-details">
                    <div className="detail-row">
                      <span className="detail-label">区分度</span>
                      <div className="disc-bar">
                        <div
                          className={`disc-fill ${disc.discriminationIndex < 0 ? "negative" : ""}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="detail-value">
                        {disc.discriminationIndex > 0 ? "+" : ""}{disc.discriminationIndex.toFixed(2)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">难度</span>
                      <div className="difficulty-bar">
                        <div
                          className="difficulty-fill"
                          style={{ width: `${disc.difficulty * 100}%` }}
                        />
                      </div>
                      <span className="detail-value">{Math.round(disc.difficulty * 100)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {questionDiscriminations.length === 0 && (
              <div className="empty-state">
                <p>暂无题目区分度数据</p>
              </div>
            )}
          </div>
          
          {/* 区分度说明 */}
          <div className="discrimination-guide">
            <h6>区分度解读</h6>
            <div className="guide-items">
              <div className="guide-item">
                <span className="guide-dot" style={{ backgroundColor: "#10b981" }} />
                <span>优秀 (≥0.4): 能有效区分学霸和学渣</span>
              </div>
              <div className="guide-item">
                <span className="guide-dot" style={{ backgroundColor: "#3b82f6" }} />
                <span>良好 (0.3-0.4): 区分效果较好</span>
              </div>
              <div className="guide-item">
                <span className="guide-dot" style={{ backgroundColor: "#f59e0b" }} />
                <span>一般 (0.2-0.3): 区分效果有限</span>
              </div>
              <div className="guide-item">
                <span className="guide-dot" style={{ backgroundColor: "#ef4444" }} />
                <span>较差 (&lt;0.2): 需改进或替换</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
