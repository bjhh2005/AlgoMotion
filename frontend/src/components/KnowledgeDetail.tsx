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
      <div className="detail-heading">
        <div>
          <span className="eyebrow">{node.category}</span>
          <h3>{node.name}</h3>
        </div>
        <span className={`status-pill ${progress}`}>{progress}</span>
      </div>

      <p>{content?.definition ?? node.description}</p>

      <div className="tag-row">
        {node.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>

      <div className="status-actions">
        <button onClick={() => onStatusChange("learning")}>学习中</button>
        <button onClick={() => onStatusChange("mastered")}>已掌握</button>
        <button onClick={() => onStatusChange("weak")}>需巩固</button>
      </div>

      <section>
        <h4>操作与复杂度</h4>
        {content ? (
          <>
            <ul className="content-list">
              {content.operationSteps.map((step) => <li key={step}>{step}</li>)}
            </ul>
            <div className="complexity-box">
              <span>{content.complexity.time}</span>
              <span>{content.complexity.space}</span>
            </div>
          </>
        ) : (
          <p className="muted">暂无详细讲解，内容组可在 data/learning-content/knowledge-content.json 中补充。</p>
        )}
      </section>

      <section>
        <h4>常见错误</h4>
        {content?.commonMistakes.length ? (
          <ul className="content-list">
            {content.commonMistakes.map((mistake) => <li key={mistake}>{mistake}</li>)}
          </ul>
        ) : (
          <p className="muted">暂无常见错误记录。</p>
        )}
      </section>

      <section>
        <h4>关联知识点</h4>
        <div className="relation-list">
          {relations.map((edge) => {
            const targetId = edge.source === node.id ? edge.target : edge.source;
            const target = nodeById[targetId];
            if (!target) return null;
            return (
              <button key={`${edge.source}-${edge.target}-${edge.type}`} onClick={() => onSelect(targetId)}>
                {edge.label}: {target.name}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h4>C++ 代码</h4>
        {codeExamples.length === 0 ? (
          <pre><code>{`// ${node.name} 的 C++ 示例代码占位
// 内容组可在 data/learning-content/code-examples.json 中补充。`}</code></pre>
        ) : (
          codeExamples.map((example) => (
            <div className="code-example" key={`${example.nodeId}-${example.title}`}>
              <strong>{example.title}</strong>
              <pre><code>{example.code}</code></pre>
            </div>
          ))
        )}
      </section>

      <section>
        <h4>练习题</h4>
        {exercises.length === 0 ? (
          <p className="muted">暂无题目，内容组可在 data/exercises 中补充。</p>
        ) : (
          <div className="exercise-list exercise-link-list">
            {exercises.map((exercise) => (
              <button key={exercise.id} onClick={() => onOpenExercise(exercise.id)}>
                <span>
                  <strong>{exercise.title}</strong>
                  <em>{exercise.type} / {exercise.difficulty}</em>
                </span>
                <b>进入 OJ</b>
              </button>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
