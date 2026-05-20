import { useState, useMemo, useEffect } from "react";
import type {
  KnowledgeNode,
  ProgressMap,
  ProgressRecord,
  ProgressStatus,
  CognitiveLevel,
  CognitiveMastery,
  PropagationAnalysis,
  BehaviorAnalysis,
  DiscriminationAnalysis,
  InvestmentEffectivenessAnalysis,
  MotivationIndex,
  KnowledgeEdge,
} from "../types";
import { AdvancedAnalyticsDashboard } from "./AdvancedAnalyticsDashboard";
import { KnowledgeHeatmap } from "./KnowledgeHeatmap";
import { LearningTrendChart } from "./LearningTrendChart";
import { ProgressDistributionChart } from "./ProgressDistributionChart";
import { EfficiencyGauge } from "./EfficiencyGauge";
import {
  fetchComprehensiveReport,
  fetchWeakKnowledge,
  type ComprehensiveReport,
  type WeakKnowledgePoint,
} from "../api";

interface Props {
  nodes: KnowledgeNode[];
  edges?: KnowledgeEdge[];
  progress: ProgressMap;
  recommendations: KnowledgeNode[];
  onSelect: (nodeId: string) => void;
}

const statusText: Record<ProgressStatus, string> = {
  not_started: "未学习",
  learning: "学习中",
  mastered: "已掌握",
  weak: "需巩固",
};

function fallbackRecord(status: ProgressStatus = "not_started", score = 0): ProgressRecord {
  return {
    status,
    score,
    metrics: {
      mastery: score / 100,
      confidence: 0,
      studyMinutes: 0,
      attemptCount: 0,
      correctRate: 0,
      errorCount: 0,
      streakDays: 0,
    },
  };
}

// 生成默认高级分析数据（API 不可用时）
function generateDefaultAdvancedData(nodes: KnowledgeNode[], progress: ProgressMap) {
  const cognitiveLevels: CognitiveLevel[] = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

  // 生成认知掌握度数据
  const cognitiveMastery: Record<string, CognitiveMastery> = {};
  nodes.forEach((node) => {
    const record = progress[node.id];
    const mastery = record?.metrics.mastery ?? Math.random() * 0.5 + 0.3;

    const levelMastery: Record<CognitiveLevel, number> = {} as Record<CognitiveLevel, number>;
    const questionAttemptStats: Record<string, { total: number; correct: number; avgTimeSpent: number; guessRate: number }> = {};

    cognitiveLevels.forEach((level, idx) => {
      const levelFactor = 1 - idx * 0.12;
      levelMastery[level] = Math.min(1, mastery * levelFactor + Math.random() * 0.2);

      const total = Math.floor(Math.random() * 10) + 3;
      const correct = Math.floor(total * levelMastery[level]);
      questionAttemptStats[level] = {
        total,
        correct,
        avgTimeSpent: Math.random() * 60 + 20,
        guessRate: Math.random() * 0.3,
      };
    });

    const weights = [0.1, 0.15, 0.25, 0.25, 0.15, 0.1];
    const bloomWeightedMastery = cognitiveLevels.reduce(
      (sum, level, idx) => sum + levelMastery[level] * weights[idx],
      0
    );

    cognitiveMastery[node.id] = {
      node_id: node.id,
      level_mastery: levelMastery,
      question_attempt_stats: questionAttemptStats,
      bloom_weighted_mastery: bloomWeightedMastery,
    } as unknown as CognitiveMastery;
  });

  // 生成知识传播分析数据
  const weakNodes = nodes.filter(
    (n) => (progress[n.id]?.metrics.mastery ?? 0) < 0.5 || progress[n.id]?.status === "weak"
  );

  const propagationAnalyses: PropagationAnalysis[] = weakNodes.slice(0, 5).map((weakNode) => {
    const affectedNodes = nodes
      .filter((n) => n.id !== weakNode.id && Math.random() > 0.6)
      .slice(0, Math.floor(Math.random() * 4) + 1)
      .map((n) => ({
        node_id: n.id,
        propagation_strength: Math.random() * 0.5 + 0.3,
        path_type: (["prerequisite", "used_in", "related"] as const)[Math.floor(Math.random() * 3)],
        root_cause: Math.random() > 0.7,
      }));

    return {
      source_node_id: weakNode.id,
      affected_nodes: affectedNodes,
      weakness_severity: Math.random() * 0.5 + 0.4,
      downstream_risk: (["low", "medium", "high", "critical"] as const)[Math.floor(Math.random() * 4)],
    } as unknown as PropagationAnalysis;
  });

  // 生成行为分析数据
  const behaviorAnalyses: Record<string, BehaviorAnalysis> = {};
  nodes.forEach((node) => {
    const record = progress[node.id];
    const hasAttempts = record && record.metrics.attemptCount > 0;

    behaviorAnalyses[node.id] = {
      node_id: node.id,
      average_time_per_question: hasAttempts ? Math.random() * 60 + 15 : Math.random() * 30 + 10,
      time_variance: Math.random() * 200,
      rush_rate: hasAttempts ? Math.random() * 0.4 : Math.random() * 0.2,
      hesitation_rate: Math.random() * 0.3,
      guess_rate: hasAttempts ? Math.random() * 0.25 : Math.random() * 0.15,
      consistency: hasAttempts ? Math.random() * 0.4 + 0.6 : Math.random() * 0.3 + 0.5,
      suspicious_flag: Math.random() > 0.9,
      suspicious_reason: Math.random() > 0.9 ? "答题时间异常，可能存在蒙猜行为" : undefined,
    } as unknown as BehaviorAnalysis;
  });

  // 生成题目区分度数据
  const questionDiscriminations: DiscriminationAnalysis[] = Array.from({ length: 15 }, (_, i) => ({
    exerciseId: `EX${String(i + 1).padStart(3, "0")}`,
    discriminationIndex: Math.random() * 0.6 + 0.1,
    difficulty: Math.random() * 0.6 + 0.2,
    effectiveness: (["excellent", "good", "acceptable", "poor"] as const)[
      Math.floor(Math.random() * 4)
    ],
  }));

  // 生成投入成效分析数据
  const studentIds = ["学生A", "学生B", "学生C", "学生D", "学生E", "学生F", "学生G", "学生H"];
  const investmentEffectiveness: InvestmentEffectivenessAnalysis[] = studentIds.map((studentId) => {
    const studyTime = Math.random() * 300 + 50;
    const practiceTime = Math.random() * 200 + 30;
    const masteryGain = Math.random() * 0.4;

    const isHighInvestment = studyTime + practiceTime > 250;
    const isHighEffectiveness = masteryGain > 0.2;
    let category: "efficient" | "inefficient" | "diving" | "dormant";
    if (isHighInvestment && isHighEffectiveness) category = "efficient";
    else if (isHighInvestment && !isHighEffectiveness) category = "inefficient";
    else if (!isHighInvestment && isHighEffectiveness) category = "diving";
    else category = "dormant";

    const efficiencyScore = Math.round(
      (isHighInvestment ? 50 : 30) + (isHighEffectiveness ? 50 : 30) + Math.random() * 20
    );

    return {
      studentId,
      investment: {
        studentId,
        studyTimeMinutes: Math.round(studyTime),
        practiceTimeMinutes: Math.round(practiceTime),
        interactionCount: Math.floor(Math.random() * 20),
        noteCount: Math.floor(Math.random() * 10),
        doubtRaised: Math.floor(Math.random() * 5),
        discussionContribution: Math.floor(Math.random() * 10),
        engagementDepth: efficiencyScore > 70 ? "deep" : efficiencyScore > 50 ? "moderate" : "surface",
      },
      effectiveness: {
        masteryGain,
        scoreImprovement: masteryGain * 100,
        skillGrowth: masteryGain * 80,
      },
      category,
      correlationCoefficient: Math.random() * 0.6 + 0.2,
      efficiencyScore,
      flags: {
        suspectedFakeEffort: category === "inefficient" && Math.random() > 0.5,
        potentialMethodIssue: category === "inefficient",
        underUtilized: category === "dormant",
      },
      recommendations:
        category === "inefficient"
          ? ["建议优化学习方法", "增加针对性练习"]
          : category === "dormant"
          ? ["需要更多学习投入", "激活学习动力"]
          : [],
    } as unknown as InvestmentEffectivenessAnalysis;
  });

  // 生成动机指数
  const motivationIndex: MotivationIndex = {
    studentId: "当前学生",
    consistencyScore: Math.random() * 40 + 60,
    perseveranceIndex: Math.random() * 50 + 50,
    growthMindsetScore: Math.random() * 30 + 70,
    intrinsicMotivationScore: Math.random() * 40 + 60,
    effortEffectivenessRatio: Math.random() * 0.5 + 0.5,
    fakeEffortSuspicion: Math.random() * 0.3,
  } as unknown as MotivationIndex;

  return {
    cognitiveMastery,
    propagationAnalyses,
    behaviorAnalyses,
    questionDiscriminations,
    investmentEffectiveness,
    motivationIndex,
  };
}

// 将 API 响应转换为内部格式
function transformComprehensiveReport(report: ComprehensiveReport) {
  return {
    cognitiveMastery: Object.fromEntries(
      Object.entries(report.cognitive_mastery).map(([nodeId, data]) => [
        nodeId,
        {
          node_id: data.node_id,
          level_mastery: data.level_mastery,
          question_attempt_stats: data.question_attempt_stats,
          bloom_weighted_mastery: data.bloom_weighted_mastery,
        } as unknown as CognitiveMastery,
      ])
    ),
    propagationAnalyses: report.propagation_analyses.map((p) => ({
      source_node_id: p.source_node_id,
      affected_nodes: p.affected_nodes.map((n) => ({
        node_id: n.node_id,
        propagation_strength: n.propagation_strength,
        path_type: n.path_type,
        root_cause: n.root_cause,
      })),
      weakness_severity: p.weakness_severity,
      downstream_risk: p.downstream_risk,
    })) as unknown as PropagationAnalysis[],
    behaviorAnalyses: Object.fromEntries(
      Object.entries(report.behavior_analyses).map(([nodeId, data]) => [
        nodeId,
        {
          node_id: data.node_id,
          average_time_per_question: data.average_time_per_question,
          time_variance: data.time_variance,
          rush_rate: data.rush_rate,
          hesitation_rate: data.hesitation_rate,
          guess_rate: data.guess_rate,
          consistency: data.consistency,
          suspicious_flag: data.suspicious_flag,
          suspicious_reason: data.suspicious_reason,
        } as unknown as BehaviorAnalysis,
      ])
    ),
    questionDiscriminations: [],
    investmentEffectiveness: [],
    motivationIndex: {
      studentId: report.motivation_index.student_id,
      consistencyScore: report.motivation_index.consistency_score,
      perseveranceIndex: report.motivation_index.perseverance_index,
      growthMindsetScore: report.motivation_index.growth_mindset_score,
      intrinsicMotivationScore: report.motivation_index.intrinsic_motivation_score,
      effortEffectivenessRatio: report.motivation_index.effort_effectiveness_ratio,
      fakeEffortSuspicion: report.motivation_index.fake_effort_suspicion,
    } as unknown as MotivationIndex,
  };
}

export function LearningAnalyticsPage({ nodes, edges = [], progress, recommendations, onSelect }: Props) {
  const [viewMode, setViewMode] = useState<"basic" | "advanced">("basic");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // API 数据状态
  const [advancedData, setAdvancedData] = useState<ReturnType<typeof generateDefaultAdvancedData> | null>(null);
  const [weakKnowledge, setWeakKnowledge] = useState<WeakKnowledgePoint[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 基础视图折叠状态
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    overview: false,      // 概览指标
    charts: false,        // 可视化图表
    weakKnowledge: false,  // 薄弱知识
    recommendPath: false,  // 推荐路径
    schema: false,         // 指标说明
  });

  // 切换折叠状态
  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 加载分析数据
  useEffect(() => {
    let cancelled = false;

    async function loadAnalytics() {
      setApiLoading(true);
      setApiError(null);

      try {
        // 并行加载综合报告和薄弱知识点
        const [reportResponse, weakResponse] = await Promise.allSettled([
          fetchComprehensiveReport(),
          fetchWeakKnowledge(0.5),
        ]);

        if (!cancelled) {
          // 处理综合报告
          if (reportResponse.status === "fulfilled" && reportResponse.value.success) {
            setAdvancedData(transformComprehensiveReport(reportResponse.value.data));
          } else {
            // 使用默认数据
            setAdvancedData(generateDefaultAdvancedData(nodes, progress));
          }

          // 处理薄弱知识点
          if (weakResponse.status === "fulfilled" && weakResponse.value.success) {
            setWeakKnowledge(weakResponse.value.data);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "加载分析数据失败";
          setApiError(message);
          console.warn(`Analytics API fallback: ${message}`);
          // 使用默认数据
          setAdvancedData(generateDefaultAdvancedData(nodes, progress));
        }
      } finally {
        if (!cancelled) {
          setApiLoading(false);
        }
      }
    }

    loadAnalytics();
    return () => { cancelled = true; };
  }, [nodes.length, Object.keys(progress).length]);

  // 默认选中第一个节点
  useEffect(() => {
    if (nodes.length > 0 && selectedNodeId === null) {
      setSelectedNodeId(nodes[0].id);
    }
  }, [nodes.length]);
  
  const records = nodes.map((node) => ({
    node,
    record: progress[node.id] ?? fallbackRecord(),
  }));
  const mastered = records.filter(({ record }) => record.status === "mastered").length;
  const learning = records.filter(({ record }) => record.status === "learning").length;
  const weakCount = records.filter(({ record }) => record.status === "weak").length;
  const totalMinutes = records.reduce((sum, item) => sum + item.record.metrics.studyMinutes, 0);
  const attempts = records.reduce((sum, item) => sum + item.record.metrics.attemptCount, 0);
  const errors = records.reduce((sum, item) => sum + item.record.metrics.errorCount, 0);
  const averageMastery = Math.round(
    (records.reduce((sum, item) => sum + item.record.metrics.mastery, 0) / nodes.length) * 100
  );
  const riskItems = records
    .filter(({ record }) => record.status === "weak" || record.metrics.errorCount >= 2 || record.metrics.mastery < 0.45)
    .sort((a, b) => a.record.metrics.mastery - b.record.metrics.mastery)
    .slice(0, 6);

  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
  };
  
  return (
    <section className="page-panel analytics-page">
      <div className="panel-title">
        <div>
          <span className="eyebrow">Learning Analytics</span>
          <h3>学习追踪分析</h3>
        </div>
        <div className="title-actions">
          <div className="view-toggle">
            <button
              className={viewMode === "basic" ? "active" : ""}
              onClick={() => setViewMode("basic")}
            >
              基础视图
            </button>
            <button
              className={viewMode === "advanced" ? "active" : ""}
              onClick={() => setViewMode("advanced")}
            >
              高级分析
            </button>
          </div>
          <strong>{averageMastery}%</strong>
        </div>
      </div>
      
      {viewMode === "basic" ? (
        <>
          {/* 概览指标 - 可折叠 */}
          <div className="collapsible-section">
            <div className="section-header" onClick={() => toggleSection("overview")}>
              <h4>📈 学习概览</h4>
              <button className="collapse-btn">
                {collapsedSections.overview ? "展开" : "收起"}
              </button>
            </div>
            {!collapsedSections.overview && (
              <div className="metric-grid metric-grid-wide">
                <div><strong>{mastered}</strong><span>已掌握节点</span></div>
                <div><strong>{learning}</strong><span>学习中节点</span></div>
                <div><strong>{weak}</strong><span>薄弱节点</span></div>
                <div><strong>{totalMinutes}</strong><span>有效学习分钟</span></div>
                <div><strong>{attempts}</strong><span>OJ 尝试次数</span></div>
                <div><strong>{errors}</strong><span>累计错因数</span></div>
              </div>
            )}
          </div>
          
          {/* 可视化图表区域 - 可折叠 */}
          <div className="collapsible-section">
            <div className="section-header" onClick={() => toggleSection("charts")}>
              <h4>📊 可视化分析</h4>
              <button className="collapse-btn">
                {collapsedSections.charts ? "展开" : "收起"}
              </button>
            </div>
            {!collapsedSections.charts && (
              <div className="analytics-charts-grid">
                {/* 知识掌握热力图 */}
                <div className="chart-card chart-card-wide">
                  <KnowledgeHeatmap
                    nodes={nodes}
                    edges={edges.map((e) => ({ source: e.source, target: e.target }))}
                    progress={progress}
                    selectedNodeId={selectedNodeId}
                    onSelect={handleNodeSelect}
                  />
                </div>
                
                {/* 学习趋势图 */}
                <div className="chart-card">
                  <LearningTrendChart />
                </div>
                
                {/* 进度分布图 */}
                <div className="chart-card">
                  <ProgressDistributionChart
                    statusCounts={[
                      { status: "mastered", count: mastered, label: "已掌握", color: "#10b981" },
                      { status: "learning", count: learning, label: "学习中", color: "#3b82f6" },
                      { status: "weak", count: weakCount, label: "需巩固", color: "#f59e0b" },
                      { status: "not_started", count: nodes.length - mastered - learning - weakCount, label: "未开始", color: "#94a3b8" },
                    ]}
                  />
                </div>
                
                {/* 效率仪表盘 */}
                <div className="chart-card">
                  <EfficiencyGauge
                    gauges={[
                      { label: "正确率", value: records.reduce((s, r) => s + r.record.metrics.correctRate, 0) / (nodes.length || 1) * 100, max: 100, unit: "%", color: "#10b981", thresholds: { warning: 70, danger: 50 } },
                      { label: "学习效率", value: attempts > 0 ? ((mastered / nodes.length) / (totalMinutes / 60)) * 100 : 0, max: 100, unit: "分/时", color: "#3b82f6", thresholds: { warning: 50, danger: 30 } },
                      { label: "日均时长", value: totalMinutes / 7, max: 120, unit: "分钟", color: "#8b5cf6", thresholds: { warning: 30, danger: 15 } },
                      { label: "连续学习", value: Math.max(...records.map((r) => r.record.metrics.streakDays), 0), max: 30, unit: "天", color: "#f59e0b", thresholds: { warning: 3, danger: 1 } },
                    ]}
                  />
                </div>
              </div>
            )}
          </div>
          
          {/* 薄弱知识和推荐路径 */}
          <div className="analytics-grid">
            {/* 薄弱知识雷达 - 可折叠 */}
            <div className="collapsible-section">
              <div className="section-header" onClick={() => toggleSection("weakKnowledge")}>
                <h4>🎯 薄弱知识 ({riskItems.length})</h4>
                <button className="collapse-btn">
                  {collapsedSections.weakKnowledge ? "展开" : "收起"}
                </button>
              </div>
              {!collapsedSections.weakKnowledge && (
                <div className="record-list">
                  {riskItems.length > 0 ? riskItems.map(({ node, record }) => (
                    <button key={node.id} onClick={() => handleNodeSelect(node.id)}>
                      <span>
                        <strong>{node.name}</strong>
                        <em>{statusText[record.status]} / 复习 {record.metrics.reviewDueAt ?? "待安排"}</em>
                      </span>
                      <b>{Math.round(record.metrics.mastery * 100)}%</b>
                    </button>
                  )) : <div className="empty-state">暂无薄弱知识点</div>}
                </div>
              )}
            </div>
            
            {/* 推荐路径 - 可折叠 */}
            <div className="collapsible-section">
              <div className="section-header" onClick={() => toggleSection("recommendPath")}>
                <h4>🧭 推荐路径 ({recommendations.length})</h4>
                <button className="collapse-btn">
                  {collapsedSections.recommendPath ? "展开" : "收起"}
                </button>
              </div>
              {!collapsedSections.recommendPath && (
                <div className="recommend-list">
                  {recommendations.length > 0 ? recommendations.map((node) => (
                    <button key={node.id} onClick={() => handleNodeSelect(node.id)}>
                      {node.name}
                      <span>难度 {node.difficulty}</span>
                    </button>
                  )) : <div className="empty-state">暂无推荐路径</div>}
                </div>
              )}
            </div>
          </div>
          
          {/* 指标说明 - 可折叠 */}
          <div className="collapsible-section">
            <div className="section-header" onClick={() => toggleSection("schema")}>
              <h4>📋 指标说明</h4>
              <button className="collapse-btn">
                {collapsedSections.schema ? "展开" : "收起"}
              </button>
            </div>
            {!collapsedSections.schema && (
              <section>
                <div className="schema-grid">
                  <span>status: 学习状态</span>
                  <span>mastery: 知识掌握度</span>
                  <span>confidence: 自评置信度</span>
                  <span>studyMinutes: 有效学习时长</span>
                  <span>attemptCount: OJ 尝试次数</span>
                  <span>correctRate: 练习正确率</span>
                  <span>errorCount: 绑定错因数量</span>
                  <span>reviewDueAt: 间隔复习时间</span>
                </div>
              </section>
            )}
          </div>
        </>
      ) : (
        <>
          {/* API 状态提示 */}
          {(apiLoading || apiError || !advancedData) && (
            <div className="api-status-banner">
              {apiLoading && <span className="loading">🔄 正在加载分析数据...</span>}
              {apiError && <span className="error">⚠️ {apiError}，显示示例数据</span>}
              {!apiLoading && !apiError && !advancedData && (
                <span className="loading">📊 加载分析数据...</span>
              )}
            </div>
          )}
          <AdvancedAnalyticsDashboard
            nodes={nodes}
            edges={edges}
            cognitiveMastery={advancedData?.cognitiveMastery ?? {}}
            propagationAnalyses={advancedData?.propagationAnalyses ?? []}
            behaviorAnalyses={advancedData?.behaviorAnalyses ?? {}}
            questionDiscriminations={advancedData?.questionDiscriminations ?? []}
            investmentEffectiveness={advancedData?.investmentEffectiveness ?? []}
            motivationIndex={advancedData?.motivationIndex ?? {
              studentId: "当前学生",
              consistencyScore: 0,
              perseveranceIndex: 0,
              growthMindsetScore: 0,
              intrinsicMotivationScore: 0,
              effortEffectivenessRatio: 0,
              fakeEffortSuspicion: 0,
            }}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleNodeSelect}
          />
        </>
      )}
    </section>
  );
}
