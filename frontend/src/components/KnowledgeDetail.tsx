import type { ReactNode } from "react";
import {
  AlertTriangle,
  Braces,
  Clock,
  Link2,
  ListChecks,
  Sparkles,
  Target
} from "lucide-react";
import { nodeById } from "../data";
import type { CodeExample, Exercise, KnowledgeContent, KnowledgeEdge, KnowledgeNode, ProgressStatus } from "../types";

interface Props {
  node: KnowledgeNode;
  content?: KnowledgeContent;
  codeExamples: CodeExample[];
  edges: KnowledgeEdge[];
  exercises: Exercise[];
  progress: ProgressStatus;
  onStatusChange: (status: ProgressStatus) => void;
  onSelect: (nodeId: string) => void;
  onOpenExercise: (exerciseId: string) => void;
}

const statusLabel: Record<ProgressStatus, string> = {
  not_started: "未学习",
  learning: "学习中",
  mastered: "已掌握",
  weak: "需巩固"
};

function SectionCard({
  title,
  icon,
  children,
  className = ""
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`detail-card ${className}`.trim()}>
      <h4 className="detail-card__title">
        <span className="detail-card__icon" aria-hidden="true">{icon}</span>
        {title}
      </h4>
      <div className="detail-card__body">{children}</div>
    </section>
  );
}

export function KnowledgeDetail({
  node,
  content,
  codeExamples,
  edges,
  exercises,
  progress,
  onStatusChange,
  onSelect,
  onOpenExercise
}: Props) {
  const relations = edges.filter((edge) => edge.source === node.id || edge.target === node.id);

  return (
    <article className="detail-panel">
      <header className="detail-card detail-card--hero">
        <div className="detail-heading">
          <div>
            <span className="eyebrow detail-eyebrow">{node.category}</span>
            <h3 className="detail-title">{node.name}</h3>
          </div>
          <span className={`status-pill status-pill--lg ${progress}`}>{statusLabel[progress]}</span>
        </div>

        <p className="detail-lead">{content?.definition ?? node.description}</p>

        {node.tags.length > 0 && (
          <div className="tag-row detail-tags">
            {node.tags.map((tag) => (
              <span key={tag} className="detail-tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="status-actions" role="group" aria-label="学习状态">
          {(["learning", "mastered", "weak"] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={progress === status ? "active" : ""}
              aria-pressed={progress === status}
              onClick={() => onStatusChange(status)}
            >
              {statusLabel[status]}
            </button>
          ))}
        </div>
      </header>

      <SectionCard title="操作与复杂度" icon={<ListChecks size={17} />}>
        {content ? (
          <>
            <ul className="content-list detail-list">
              {content.operationSteps.map((step) => <li key={step}>{step}</li>)}
            </ul>
            <div className="complexity-box">
              <div className="complexity-item">
                <Sparkles size={15} />
                <span>{content.complexity.time}</span>
              </div>
              <div className="complexity-item">
                <Sparkles size={15} />
                <span>{content.complexity.space}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="muted detail-empty">暂无详细讲解，内容组可在 data/learning-content/knowledge-content.json 中补充。</p>
        )}
      </SectionCard>

      <SectionCard title="常见错误" icon={<AlertTriangle size={17} />} className="detail-card--warn">
        {content?.commonMistakes.length ? (
          <ul className="content-list detail-list detail-list--mistakes">
            {content.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
          </ul>
        ) : (
          <p className="muted detail-empty">暂无常见错误记录。</p>
        )}
      </SectionCard>

      <SectionCard title="关联知识点" icon={<Link2 size={17} />}>
        {relations.length > 0 ? (
          <div className="relation-list">
            {relations.map((edge) => {
              const targetId = edge.source === node.id ? edge.target : edge.source;
              const target = nodeById[targetId];
              if (!target) return null;
              return (
                <button
                  key={`${edge.source}-${edge.target}-${edge.type}`}
                  type="button"
                  className="relation-chip"
                  onClick={() => onSelect(targetId)}
                >
                  <span className="relation-chip__type">{edge.label}</span>
                  <span className="relation-chip__name">{target.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="muted detail-empty">暂无关联知识点。</p>
        )}
      </SectionCard>

      <SectionCard title="C++ 代码" icon={<Braces size={17} />} className="detail-card--code">
        {codeExamples.length === 0 ? (
          <pre className="detail-code-block"><code>{`// ${node.name} 的 C++ 示例代码占位
// 内容组可在 data/learning-content/code-examples.json 中补充。`}</code></pre>
        ) : (
          codeExamples.map((example) => (
            <div className="code-example" key={`${example.nodeId}-${example.title}`}>
              <strong>{example.title}</strong>
              <pre className="detail-code-block"><code>{example.code}</code></pre>
            </div>
          ))
        )}
      </SectionCard>

      <SectionCard title="练习题" icon={<Target size={17} />}>
        {exercises.length === 0 ? (
          <p className="muted detail-empty">暂无题目，内容组可在 data/exercises 中补充。</p>
        ) : (
          <div className="exercise-link-list detail-exercise-list">
            {exercises.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                className="detail-exercise-btn"
                onClick={() => onOpenExercise(exercise.id)}
              >
                <span>
                  <strong>{exercise.title}</strong>
                  <em>{exercise.type} / {exercise.difficulty}</em>
                </span>
                <b>进入 OJ</b>
              </button>
            ))}
          </div>
        )}
      </SectionCard>
    </article>
  );
}
