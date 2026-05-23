import { useState, useEffect, useCallback, useRef } from "react";
import type {
  KnowledgeNode,
  KnowledgeEdge,
  CognitiveMastery,
  PropagationAnalysis,
  BehaviorAnalysis,
  DiscriminationAnalysis,
  InvestmentEffectivenessAnalysis,
  MotivationIndex,
  ProgressMap,
} from "../types";
import { CognitiveRadarChart } from "./CognitiveRadarChart";
import { KnowledgePropagationGraph } from "./KnowledgePropagationGraph";
import { InvestmentEffectivenessScatter } from "./InvestmentEffectivenessScatter";
import { LearningBehaviorPanel } from "./LearningBehaviorPanel";

interface Props {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  cognitiveMastery: Record<string, CognitiveMastery>;
  propagationAnalyses: PropagationAnalysis[];
  behaviorAnalyses: Record<string, BehaviorAnalysis>;
  questionDiscriminations: DiscriminationAnalysis[];
  investmentEffectiveness: InvestmentEffectivenessAnalysis[];
  motivationIndex: MotivationIndex | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  progress?: ProgressMap;
}

// 高级学习分析综合面板 - 整合三个维度的分析
export function AdvancedAnalyticsDashboard({
  nodes,
  edges,
  cognitiveMastery,
  propagationAnalyses,
  behaviorAnalyses,
  questionDiscriminations,
  investmentEffectiveness,
  motivationIndex,
  selectedNodeId,
  onSelectNode,
  progress,
}: Props) {
  const [activeDimension, setActiveDimension] = useState<"structure" | "quality" | "engagement">("structure");
  const initializedRef = useRef(false);

  // 当切换到质量维度时，确保有选中的节点且该节点有 cognitiveMastery 数据
  useEffect(() => {
    if (activeDimension === "quality" && !initializedRef.current) {
      initializedRef.current = true;
      const nodesWithMastery = nodes.filter((n) => cognitiveMastery[n.id]);
      if (nodesWithMastery.length > 0 && (!selectedNodeId || !cognitiveMastery[selectedNodeId])) {
        onSelectNode(nodesWithMastery[0].id);
      }
    }
  }, [activeDimension, nodes, cognitiveMastery, selectedNodeId, onSelectNode]);
  
  // 计算综合评分
  const baseScores = {
    knowledgeStructure: Math.round(
      (propagationAnalyses.length > 0
        ? 1 - propagationAnalyses.reduce((sum, p) => sum + p.weaknessSeverity, 0) / propagationAnalyses.length
        : 1) * 100
    ),
    learningQuality: Object.keys(cognitiveMastery).length > 0
      ? Math.round(
          Object.values(cognitiveMastery).reduce((sum, m) => sum + m.bloomWeightedMastery, 0) /
          Object.values(cognitiveMastery).length * 100
        )
      : 0,
    cognitiveEngagement: investmentEffectiveness.length > 0
      ? Math.round(
          investmentEffectiveness.reduce((sum, a) => sum + a.efficiencyScore, 0) /
          investmentEffectiveness.length
      )
      : 0,
  };
  
  const overallScores = {
    ...baseScores,
    composite: Math.round(
      (baseScores.knowledgeStructure + baseScores.learningQuality + baseScores.cognitiveEngagement) / 3
    ),
  };
  
  const dimensionTabs = [
    { id: "structure" as const, label: "知识关联结构", icon: "🧠" },
    { id: "quality" as const, label: "学习质量深度", icon: "📊" },
    { id: "engagement" as const, label: "认知投入层级", icon: "🎯" },
  ];
  
  return (
    <div className="advanced-analytics-dashboard">
      {/* 维度切换标签 */}
      <div className="dimension-tabs">
        {dimensionTabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeDimension === tab.id ? "active" : ""}`}
            onClick={() => setActiveDimension(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* 综合评分卡片 */}
      <div className="overall-scores">
        <div className="score-card structure">
          <div className="score-header">
            <span className="score-icon">🧠</span>
            <span className="score-title">知识关联</span>
          </div>
          <div className="score-value" style={{ color: overallScores.knowledgeStructure >= 70 ? "#10b981" : "#f59e0b" }}>
            {overallScores.knowledgeStructure}
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${overallScores.knowledgeStructure}%`,
                backgroundColor: overallScores.knowledgeStructure >= 70 ? "#10b981" : "#f59e0b",
              }}
            />
          </div>
        </div>
        
        <div className="score-card quality">
          <div className="score-header">
            <span className="score-icon">📊</span>
            <span className="score-title">学习质量</span>
          </div>
          <div className="score-value" style={{ color: overallScores.learningQuality >= 70 ? "#10b981" : "#f59e0b" }}>
            {overallScores.learningQuality}
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${overallScores.learningQuality}%`,
                backgroundColor: overallScores.learningQuality >= 70 ? "#10b981" : "#f59e0b",
              }}
            />
          </div>
        </div>
        
        <div className="score-card engagement">
          <div className="score-header">
            <span className="score-icon">🎯</span>
            <span className="score-title">认知投入</span>
          </div>
          <div className="score-value" style={{ color: overallScores.cognitiveEngagement >= 70 ? "#10b981" : "#f59e0b" }}>
            {overallScores.cognitiveEngagement}
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${overallScores.cognitiveEngagement}%`,
                backgroundColor: overallScores.cognitiveEngagement >= 70 ? "#10b981" : "#f59e0b",
              }}
            />
          </div>
        </div>
        
        <div className="score-card composite">
          <div className="score-header">
            <span className="score-icon">⭐</span>
            <span className="score-title">综合指数</span>
          </div>
          <div className="score-value" style={{ color: overallScores.composite >= 70 ? "#10b981" : "#f59e0b" }}>
            {overallScores.composite}
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${overallScores.composite}%`,
                backgroundColor: overallScores.composite >= 70 ? "#10b981" : "#f59e0b",
              }}
            />
          </div>
        </div>
      </div>
      
      {/* 维度内容区域 */}
      <div className="dimension-content">
        {activeDimension === "structure" && (
          <div className="dimension-panel structure-panel">
            <div className="panel-intro">
              <h4>维度一：知识关联结构分析</h4>
              <p>
                揭示"懂了，但为何不会做题"的深层原因。通过知识图谱技术分析知识点之间的逻辑关系和学生的认知路径，
                识别薄弱知识点对下游知识的影响传播。
              </p>
            </div>
            
            <div className="structure-content">
              {/* 知识图谱传播图 */}
              <div className="graph-section">
                <KnowledgePropagationGraph
                  nodes={nodes}
                  edges={edges}
                  propagationAnalyses={propagationAnalyses}
                  selectedNodeId={selectedNodeId}
                  onNodeClick={onSelectNode}
                  progress={progress}
                />
              </div>
              
              {/* 传播风险摘要 */}
              {propagationAnalyses.length > 0 && (
                <div className="propagation-summary">
                  <h5>传播风险摘要</h5>
                  <div className="risk-cards">
                    {propagationAnalyses
                      .filter((p) => p.downstreamRisk === "critical" || p.downstreamRisk === "high")
                      .slice(0, 4)
                      .map((analysis) => {
                        const node = nodes.find((n) => n.id === analysis.sourceNodeId);
                        return (
                          <div
                            key={analysis.sourceNodeId}
                            className={`risk-card ${analysis.downstreamRisk}`}
                            onClick={() => onSelectNode(analysis.sourceNodeId)}
                          >
                            <span className="risk-level">
                              {analysis.downstreamRisk === "critical" ? "严重" : "高"}
                            </span>
                            <span className="risk-node">{node?.name || analysis.sourceNodeId}</span>
                            <span className="risk-affected">
                              影响 {analysis.affectedNodes.length} 个下游知识点
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeDimension === "quality" && (
          <div className="dimension-panel quality-panel">
            <div className="panel-intro">
              <h4>维度二：学习质量深度分析</h4>
              <p>
                区分"真懂"与"假努力"。基于布鲁姆认知目标分类学分析学生在不同思维层级的掌握情况，
                并通过答题行为模式识别可疑学习行为。
              </p>
            </div>
            
            <div className="quality-content">
              {/* 认知层级雷达图 - 无需后端数据，始终显示 */}
              <div className="radar-section">
                <CognitiveRadarChart
                  cognitiveMastery={selectedNodeId ? cognitiveMastery[selectedNodeId] : null}
                  nodeName={nodes.find((n) => n.id === selectedNodeId)?.name || "请选择知识点"}
                  width={360}
                  height={360}
                  isEmpty={!selectedNodeId || !cognitiveMastery[selectedNodeId]}
                />
              </div>
              
              {/* 行为分析面板 */}
              <div className="behavior-section">
                <LearningBehaviorPanel
                  nodes={nodes}
                  behaviorAnalyses={behaviorAnalyses}
                  questionDiscriminations={questionDiscriminations}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={onSelectNode}
                />
              </div>
            </div>
          </div>
        )}
        
        {activeDimension === "engagement" && (
          <div className="dimension-panel engagement-panel">
            <div className="panel-intro">
              <h4>维度三：认知投入层级分析</h4>
              <p>
                分析"看懂了，但真的投入了吗"。通过学习投入-成效散点图将学生分为不同类型，
                识别"假努力"嫌疑，评估学习驱动力与毅力指数。
              </p>
            </div>
            
            <div className="engagement-content">
              {/* 投入成效散点图 */}
              <div className="scatter-section">
                <InvestmentEffectivenessScatter
                  analyses={investmentEffectiveness}
                  width={560}
                  height={420}
                />
              </div>
              
              {/* 动机指数面板 */}
              {motivationIndex && (
                <div className="motivation-section">
                  <h5>学习驱动力与毅力指数</h5>
                  <div className="motivation-cards">
                    <div className="motivation-card">
                      <span className="motivation-icon">📈</span>
                      <span className="motivation-label">学习一致性</span>
                      <span className="motivation-value" style={{ color: motivationIndex.consistencyScore >= 70 ? "#10b981" : "#f59e0b" }}>
                        {Math.round(motivationIndex.consistencyScore)}
                      </span>
                    </div>
                    <div className="motivation-card">
                      <span className="motivation-icon">💪</span>
                      <span className="motivation-label">毅力指数</span>
                      <span className="motivation-value" style={{ color: motivationIndex.perseveranceIndex >= 70 ? "#10b981" : "#f59e0b" }}>
                        {Math.round(motivationIndex.perseveranceIndex)}
                      </span>
                    </div>
                    <div className="motivation-card">
                      <span className="motivation-icon">🧠</span>
                      <span className="motivation-label">成长型思维</span>
                      <span className="motivation-value" style={{ color: motivationIndex.growthMindsetScore >= 70 ? "#10b981" : "#f59e0b" }}>
                        {Math.round(motivationIndex.growthMindsetScore)}
                      </span>
                    </div>
                    <div className="motivation-card">
                      <span className="motivation-icon">🔥</span>
                      <span className="motivation-label">内在动机</span>
                      <span className="motivation-value" style={{ color: motivationIndex.intrinsicMotivationScore >= 70 ? "#10b981" : "#f59e0b" }}>
                        {Math.round(motivationIndex.intrinsicMotivationScore)}
                      </span>
                    </div>
                  </div>
                  
                  {/* 假努力嫌疑 */}
                  <div className={`fake-effort-alert ${motivationIndex.fakeEffortSuspicion > 0.5 ? "warning" : ""}`}>
                    <span className="alert-icon">
                      {motivationIndex.fakeEffortSuspicion > 0.5 ? "⚠️" : "✅"}
                    </span>
                    <div className="alert-content">
                      <span className="alert-title">
                        {motivationIndex.fakeEffortSuspicion > 0.5 ? "假努力嫌疑较高" : "学习状态正常"}
                      </span>
                      <span className="alert-desc">
                        {motivationIndex.fakeEffortSuspicion > 0.5
                          ? "建议关注学习方法，尝试更深入的学习策略"
                          : "继续保持当前的学习状态和方法"}
                      </span>
                    </div>
                    <div className="alert-meter">
                      <div
                        className="meter-fill"
                        style={{
                          width: `${motivationIndex.fakeEffortSuspicion * 100}%`,
                          backgroundColor: motivationIndex.fakeEffortSuspicion > 0.5 ? "#ef4444" : "#10b981",
                        }}
                      />
                    </div>
                    <span className="meter-value">
                      {Math.round(motivationIndex.fakeEffortSuspicion * 100)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
