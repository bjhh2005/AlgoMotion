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
  downloadComprehensiveReport,
  fetchComprehensiveReport,
  fetchWeakKnowledge,
  clearAllLearningData,
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
    const questionAttemptStats: CognitiveMastery["questionAttemptStats"] = {} as CognitiveMastery["questionAttemptStats"];

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
      nodeId: node.id,
      levelMastery,
      questionAttemptStats,
      bloomWeightedMastery,
    };
  });

  // 生成知识传播分析数据
  const weakNodes = nodes.filter(
    (n) => (progress[n.id]?.metrics.mastery ?? 0) < 0.5 || progress[n.id]?.status === "weak"
  );

  const propagationAnalyses: PropagationAnalysis[] = weakNodes.slice(0, 5).map((weakNode) => {
    const weakMastery = progress[weakNode.id]?.metrics.mastery ?? 0;
    const candidates = nodes.filter((n) => n.id !== weakNode.id);

    const affectedNodes = candidates
      .sort(
        (a, b) =>
          (progress[b.id]?.metrics.attemptCount ?? 0) -
          (progress[a.id]?.metrics.attemptCount ?? 0)
      )
      .slice(0, Math.max(1, Math.min(4, Math.round((1 - weakMastery) * 4))))
      .map((n) => {
        const targetMetrics = progress[n.id]?.metrics;
        const targetMastery = targetMetrics?.mastery ?? 0;
        const strength = Math.min(
          1,
          0.35 + (1 - weakMastery) * 0.45 + (1 - targetMastery) * 0.15 +
            Math.min(0.15, (targetMetrics?.attemptCount ?? 0) * 0.02)
        );

        return {
          nodeId: n.id,
          propagationStrength: parseFloat(strength.toFixed(2)),
          pathType: (['prerequisite', 'used_in', 'related'] as const)[
            Math.floor(Math.random() * 3)
          ],
          rootCause: weakMastery < 0.45,
        };
      });

    const weakLinkCount = affectedNodes.filter(
      (item) => (progress[item.nodeId]?.metrics.mastery ?? 0) < 0.6
    ).length;
    const severity = Math.min(1, 0.35 + (1 - weakMastery) * 0.8 + weakLinkCount * 0.08);

    return {
      sourceNodeId: weakNode.id,
      affectedNodes,
      weaknessSeverity: parseFloat(severity.toFixed(2)),
      downstreamRisk:
        severity >= 0.8
          ? 'critical'
          : severity >= 0.6
          ? 'high'
          : severity >= 0.4
          ? 'medium'
          : 'low',
    };
  });

  // 生成行为分析数据
  const behaviorAnalyses: Record<string, BehaviorAnalysis> = {};
  nodes.forEach((node) => {
    const record = progress[node.id];
    const hasAttempts = record && record.metrics.attemptCount > 0;

    behaviorAnalyses[node.id] = {
      nodeId: node.id,
      averageTimePerQuestion: hasAttempts ? Math.random() * 60 + 15 : Math.random() * 30 + 10,
      timeVariance: Math.random() * 200,
      rushRate: hasAttempts ? Math.random() * 0.4 : Math.random() * 0.2,
      hesitationRate: Math.random() * 0.3,
      guessRate: hasAttempts ? Math.random() * 0.25 : Math.random() * 0.15,
      consistency: hasAttempts ? Math.random() * 0.4 + 0.6 : Math.random() * 0.3 + 0.5,
      suspiciousFlag: Math.random() > 0.9,
      suspiciousReason: Math.random() > 0.9 ? "答题时间异常，可能存在蒙猜行为" : undefined,
    };
  });

  // 生成题目区分度数据
  const questionDiscriminations: DiscriminationAnalysis[] = nodes
    .slice(0, 15)
    .map((node) => {
      const metrics = progress[node.id]?.metrics;
      const mastery = metrics?.mastery ?? 0;
      const correctRate = metrics?.correctRate ?? mastery;
      const errorCount = metrics?.errorCount ?? 0;
      const discriminationIndex = parseFloat(
        Math.max(-1, Math.min(1, correctRate * 0.6 + mastery * 0.3 - errorCount * 0.02)).toFixed(3)
      );
      const difficulty = parseFloat(
        Math.max(0.1, Math.min(1, (node.difficulty ?? 5) / 10 * 0.7 + (1 - mastery) * 0.3)).toFixed(3)
      );
      const effectiveness =
        discriminationIndex >= 0.7
          ? 'excellent'
          : discriminationIndex >= 0.55
          ? 'good'
          : discriminationIndex >= 0.4
          ? 'acceptable'
          : 'poor';

      return {
        exerciseId: `EX-${node.id}`,
        discriminationIndex,
        difficulty,
        effectiveness,
      };
    });

  // 生成投入成效分析数据
  const allRecords = Object.values(progress);
  const totalStudyMinutes = allRecords.reduce(
    (sum, record) => sum + (record.metrics?.studyMinutes ?? 0),
    0
  );
  const totalAttempts = allRecords.reduce(
    (sum, record) => sum + (record.metrics?.attemptCount ?? 0),
    0
  );
  const avgMastery =
    allRecords.length > 0
      ? allRecords.reduce((sum, record) => sum + (record.metrics?.mastery ?? 0), 0) / allRecords.length
      : 0;
  const avgCorrectRate =
    allRecords.length > 0
      ? allRecords.reduce((sum, record) => sum + (record.metrics?.correctRate ?? 0), 0) / allRecords.length
      : 0;
  const activeRatio =
    nodes.length > 0
      ? allRecords.filter((record) => (record.metrics?.attemptCount ?? 0) > 0).length / nodes.length
      : 0;
  const efficiencyScore = Math.round(
    Math.min(100, avgMastery * 60 + avgCorrectRate * 25 + Math.min(totalStudyMinutes / 4, 20))
  );
  const investmentEffectiveness: InvestmentEffectivenessAnalysis[] = [
    {
      studentId: "当前学生",
      investment: {
        studentId: "当前学生",
        studyTimeMinutes: totalStudyMinutes,
        practiceTimeMinutes: Math.round(totalAttempts * 2 + totalStudyMinutes * 0.15),
        interactionCount: totalAttempts,
        noteCount: Math.round(totalStudyMinutes / 30),
        doubtRaised: Math.max(
          0,
          Math.round(allRecords.filter((record) => (record.metrics?.confidence ?? 1) < 0.5).length / 2)
        ),
        discussionContribution: Math.round(allRecords.filter((record) => (record.metrics?.streakDays ?? 0) >= 3).length / 2),
        engagementDepth:
          efficiencyScore >= 70 ? "deep" : efficiencyScore >= 50 ? "moderate" : "surface",
      },
      effectiveness: {
        masteryGain: parseFloat(Math.min(1, avgMastery * 0.25 + 0.05).toFixed(3)),
        scoreImprovement: parseFloat((avgMastery * 100 * 0.4).toFixed(1)),
        skillGrowth: parseFloat((avgMastery * 80 * 0.4).toFixed(1)),
      },
      category:
        efficiencyScore >= 70
          ? "efficient"
          : efficiencyScore <= 40
          ? "inefficient"
          : avgMastery >= 0.6 && totalStudyMinutes < 80
          ? "diving"
          : "dormant",
      correlationCoefficient: parseFloat(
        Math.min(1, avgMastery * 0.6 + avgCorrectRate * 0.4).toFixed(3)
      ),
      efficiencyScore,
      flags: {
        suspectedFakeEffort: efficiencyScore < 40 && avgCorrectRate < 0.6,
        potentialMethodIssue: efficiencyScore < 45,
        underUtilized: efficiencyScore < 50,
      },
      recommendations:
        efficiencyScore < 45
          ? ["建议优化学习方法", "加强高质量练习和错题复盘"]
          : efficiencyScore < 60
          ? ["保持稳定投入，关注薄弱点提升"]
          : ["继续保持当前节奏并拓展高阶认知练习"],
    },
  ];

  // 生成动机指数
  const motivationIndex: MotivationIndex = {
    studentId: "当前学生",
    consistencyScore: Math.random() * 40 + 60,
    perseveranceIndex: Math.random() * 50 + 50,
    growthMindsetScore: Math.random() * 30 + 70,
    intrinsicMotivationScore: Math.random() * 40 + 60,
    effortEffectivenessRatio: Math.random() * 0.5 + 0.5,
    fakeEffortSuspicion: Math.random() * 0.3,
  };

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
          nodeId: data.node_id,
          levelMastery: data.level_mastery as CognitiveMastery["levelMastery"],
          questionAttemptStats: Object.fromEntries(
            Object.entries(data.question_attempt_stats).map(([level, stats]) => [
              level,
              {
                total: stats.total,
                correct: stats.correct,
                avgTimeSpent: stats.avg_time_spent,
                guessRate: stats.guess_rate,
              },
            ])
          ) as CognitiveMastery["questionAttemptStats"],
          bloomWeightedMastery: data.bloom_weighted_mastery,
        },
      ])
    ),
    propagationAnalyses: report.propagation_analyses.map((p) => ({
      sourceNodeId: p.source_node_id,
      affectedNodes: p.affected_nodes.map((n) => ({
        nodeId: n.node_id,
        propagationStrength: n.propagation_strength,
        pathType: n.path_type as PropagationAnalysis["affectedNodes"][number]["pathType"],
        rootCause: n.root_cause,
      })),
      weaknessSeverity: p.weakness_severity,
      downstreamRisk: p.downstream_risk as PropagationAnalysis["downstreamRisk"],
    })),
    behaviorAnalyses: Object.fromEntries(
      Object.entries(report.behavior_analyses).map(([nodeId, data]) => [
        nodeId,
        {
          nodeId: data.node_id,
          averageTimePerQuestion: data.average_time_per_question,
          timeVariance: data.time_variance,
          rushRate: data.rush_rate,
          hesitationRate: data.hesitation_rate,
          guessRate: data.guess_rate,
          consistency: data.consistency,
          suspiciousFlag: data.suspicious_flag,
          suspiciousReason: data.suspicious_reason,
        },
      ])
    ),
    questionDiscriminations: report.question_discriminations.map((disc) => ({
      exerciseId: disc.exercise_id,
      discriminationIndex: disc.discrimination_index,
      difficulty: disc.difficulty,
      effectiveness: disc.effectiveness,
    })),
    investmentEffectiveness: report.investment_effectiveness.map((item) => ({
      studentId: item.student_id,
      investment: {
        studentId: item.investment.student_id,
        nodeId: item.investment.node_id ?? undefined,
        studyTimeMinutes: item.investment.study_time_minutes,
        interactionCount: item.investment.interaction_count,
        practiceTimeMinutes: item.investment.practice_time_minutes,
        noteCount: item.investment.note_count,
        doubtRaised: item.investment.doubt_raised,
        discussionContribution: item.investment.discussion_contribution,
        engagementDepth: item.investment.engagement_depth as InvestmentEffectivenessAnalysis["investment"]["engagementDepth"],
      },
      effectiveness: {
        masteryGain: item.effectiveness.mastery_gain,
        scoreImprovement: item.effectiveness.score_improvement,
        skillGrowth: item.effectiveness.skill_growth,
      },
      category: item.category as InvestmentEffectivenessAnalysis["category"],
      correlationCoefficient: item.correlation_coefficient,
      efficiencyScore: item.efficiency_score,
      flags: {
        suspectedFakeEffort: item.flags.suspected_fake_effort,
        potentialMethodIssue: item.flags.potential_method_issue,
        underUtilized: item.flags.under_utilized,
      },
      recommendations: item.recommendations,
    })),
    motivationIndex: {
      studentId: report.motivation_index.student_id,
      consistencyScore: report.motivation_index.consistency_score,
      perseveranceIndex: report.motivation_index.perseverance_index,
      growthMindsetScore: report.motivation_index.growth_mindset_score,
      intrinsicMotivationScore: report.motivation_index.intrinsic_motivation_score,
      effortEffectivenessRatio: report.motivation_index.effort_effectiveness_ratio,
      fakeEffortSuspicion: report.motivation_index.fake_effort_suspicion,
    },
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

  // 导出报告状态
  const [exportingReport, setExportingReport] = useState(false);

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
            const reason = reportResponse.status === "rejected" ? reportResponse.reason?.message || "服务器错误" : "接口未返回有效数据";
            setApiError(`Failed to fetch: ${reason}，显示示例数据`);
            setAdvancedData(generateDefaultAdvancedData(nodes, progress));
          }

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

  const handleExportReport = async (format: "json" | "markdown" | "html" = "json") => {
    setExportingReport(true);
    setApiError(null);

    try {
      const blob = await downloadComprehensiveReport(format);
      if (format === "html") {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      } else {
        const fileUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = fileUrl;
        const ext = format === "markdown" ? "md" : format;
        link.download = `learning-report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.${ext}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(fileUrl);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "导出报告失败";
      setApiError(message);
      console.error("Export report failed:", err);
    } finally {
      setExportingReport(false);
    }
  };

  const handleClearData = async () => {
    if (!window.confirm("确定要清空所有学习数据吗？此操作不可撤销。")) return;
    try {
      await clearAllLearningData();
      window.location.reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "清空数据失败";
      setApiError(message);
    }
  };

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
          <div className="title-buttons">
            <div className="export-dropdown-wrapper">
              <button
                className="secondary-button"
                disabled={exportingReport}
              >
                {exportingReport ? "导出中..." : "导出报告 ▾"}
              </button>
              <div className="export-dropdown-menu">
                <button onClick={() => handleExportReport("json")} disabled={exportingReport}>
                  导出 JSON
                </button>
                <button onClick={() => handleExportReport("markdown")} disabled={exportingReport}>
                  导出 Markdown
                </button>
                <button onClick={() => handleExportReport("html")} disabled={exportingReport}>
                  导出 HTML
                </button>
              </div>
            </div>
            <button
              className="danger-ghost-btn"
              onClick={handleClearData}
            >
              清空数据
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
                <div><strong>{weakCount}</strong><span>薄弱节点</span></div>
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
                    <button key={node.id} onClick={() => onSelect(node.id)}>
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
                    <button key={node.id} onClick={() => onSelect(node.id)}>
                      {node.name}
                      <span>难度 {node.difficulty}</span>
                    </button>
                  )) : <div className="empty-state">暂无推荐路径</div>}
                </div>
              )}
            </div>
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
            progress={progress}
          />
        </>
      )}
    </section>
  );
}
