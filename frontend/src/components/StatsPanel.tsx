import type { KnowledgeNode, ProgressMap } from "../types";

interface Props {
  nodes: KnowledgeNode[];
  progress: ProgressMap;
  recommendations: KnowledgeNode[];
  onSelect: (nodeId: string) => void;
}

export function StatsPanel({ nodes, progress, recommendations, onSelect }: Props) {
  const total = nodes.length;
  const mastered = Object.values(progress).filter((item) => item.status === "mastered").length;
  const learning = Object.values(progress).filter((item) => item.status === "learning").length;
  const weak = Object.values(progress).filter((item) => item.status === "weak").length;
  const completion = Math.round((mastered / total) * 100);

  return (
    <section className="stats-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">Learning Analytics</span>
          <h3>学习跟踪</h3>
        </div>
        <strong>{completion}%</strong>
      </div>

      <div className="metric-grid">
        <div><strong>{mastered}</strong><span>已掌握</span></div>
        <div><strong>{learning}</strong><span>学习中</span></div>
        <div><strong>{weak}</strong><span>需巩固</span></div>
      </div>

      <div className="progress-bar">
        <span style={{ width: `${completion}%` }} />
      </div>

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
  );
}

