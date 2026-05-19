import type { KnowledgeNode, ProgressMap, ProgressRecord, ProgressStatus } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  progress: ProgressMap;
  recommendations: KnowledgeNode[];
  onSelect: (nodeId: string) => void;
}

const statusText: Record<ProgressStatus, string> = {
  not_started: "未学习",
  learning: "学习中",
  mastered: "已掌握",
  weak: "需巩固"
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
      streakDays: 0
    }
  };
}

export function LearningAnalyticsPage({ nodes, progress, recommendations, onSelect }: Props) {
  const records = nodes.map((node) => ({
    node,
    record: progress[node.id] ?? fallbackRecord()
  }));
  const mastered = records.filter(({ record }) => record.status === "mastered").length;
  const learning = records.filter(({ record }) => record.status === "learning").length;
  const weak = records.filter(({ record }) => record.status === "weak").length;
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

  return (
    <section className="page-panel analytics-page">
      <div className="panel-title">
        <div>
          <span className="eyebrow">Learning Analytics</span>
          <h3>学习追踪参数</h3>
        </div>
        <strong>{averageMastery}%</strong>
      </div>

      <div className="metric-grid metric-grid-wide">
        <div><strong>{mastered}</strong><span>已掌握节点</span></div>
        <div><strong>{learning}</strong><span>学习中节点</span></div>
        <div><strong>{weak}</strong><span>薄弱节点</span></div>
        <div><strong>{totalMinutes}</strong><span>有效学习分钟</span></div>
        <div><strong>{attempts}</strong><span>OJ 尝试次数</span></div>
        <div><strong>{errors}</strong><span>累计错因数</span></div>
      </div>

      <div className="analytics-grid">
        <section>
          <h4>薄弱知识雷达</h4>
          <div className="record-list">
            {riskItems.map(({ node, record }) => (
              <button key={node.id} onClick={() => onSelect(node.id)}>
                <span>
                  <strong>{node.name}</strong>
                  <em>{statusText[record.status]} / 复习 {record.metrics.reviewDueAt ?? "待安排"}</em>
                </span>
                <b>{Math.round(record.metrics.mastery * 100)}%</b>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4>推荐路径</h4>
          <div className="recommend-list">
            {recommendations.map((node) => (
              <button key={node.id} onClick={() => onSelect(node.id)}>
                {node.name}
                <span>难度 {node.difficulty}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section>
        <h4>指标兼容层</h4>
        <div className="schema-grid">
          <span>status: 是否学习与阶段</span>
          <span>mastery: 知识掌握度</span>
          <span>confidence: 自评置信度</span>
          <span>studyMinutes: 有效学习时长</span>
          <span>attemptCount: OJ 尝试次数</span>
          <span>correctRate: 练习正确率</span>
          <span>errorCount: 绑定错因数量</span>
          <span>reviewDueAt: 间隔复习时间</span>
        </div>
      </section>
    </section>
  );
}
