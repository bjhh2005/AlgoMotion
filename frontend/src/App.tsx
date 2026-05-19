import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpen, Bot, ClipboardList, Code2, Database, GitFork, LayoutList, Search, ShieldCheck } from "lucide-react";
import { fetchBootstrap, updateProgress as postProgress } from "./api";
import {
  contentByNodeId,
  examplesByNodeId,
  exerciseBank,
  knowledgeContents,
  knowledgeEdges,
  knowledgeNodes,
  nodeById,
  recommendationConfig,
  seedProgress,
  analysisRules as localAnalysisRules
} from "./data";
import type {
  CodeAnalysisRule,
  CodeExample,
  Exercise,
  KnowledgeContent,
  KnowledgeEdge,
  KnowledgeNode,
  ProgressMap,
  ProgressRecord,
  ProgressStatus,
  RecommendationSeeds
} from "./types";
import { DirectoryView } from "./components/DirectoryView";
import { GraphView } from "./components/GraphView";
import { KnowledgeDetail } from "./components/KnowledgeDetail";
import { AiPanel } from "./components/AiPanel";
import { ExerciseOjPage } from "./components/ExerciseOjPage";
import { LearningAnalyticsPage } from "./components/LearningAnalyticsPage";

const statusScore: Record<ProgressStatus, number> = {
  not_started: 0,
  learning: 45,
  weak: 35,
  mastered: 90
};

const statusLabel: Record<ProgressStatus, string> = {
  not_started: "未学习",
  learning: "学习中",
  mastered: "已掌握",
  weak: "需巩固"
};

type AppPage = "knowledge" | "oj" | "analytics" | "ai";
type ApiStatus = "checking" | "connected" | "fallback" | "error";

function createProgressRecord(status: ProgressStatus, score: number, previous?: ProgressRecord): ProgressRecord {
  return {
    status,
    score,
    metrics: {
      mastery: score / 100,
      confidence: previous?.metrics.confidence ?? (status === "mastered" ? 0.8 : 0.45),
      studyMinutes: previous?.metrics.studyMinutes ?? 0,
      attemptCount: previous?.metrics.attemptCount ?? 0,
      correctRate: previous?.metrics.correctRate ?? 0,
      errorCount: previous?.metrics.errorCount ?? 0,
      streakDays: previous?.metrics.streakDays ?? 0,
      lastActivityAt: new Date().toISOString(),
      reviewDueAt: previous?.metrics.reviewDueAt
    }
  };
}

export function App() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>(knowledgeNodes);
  const [edges, setEdges] = useState<KnowledgeEdge[]>(knowledgeEdges);
  const [contents, setContents] = useState<KnowledgeContent[]>(knowledgeContents);
  const [codeExamples, setCodeExamples] = useState<CodeExample[]>(Object.values(examplesByNodeId).flat());
  const [exercises, setExercises] = useState<Exercise[]>(exerciseBank);
  const [analysisRules, setAnalysisRules] = useState<CodeAnalysisRule[]>(localAnalysisRules);
  const [recommendationsConfig, setRecommendationsConfig] = useState<RecommendationSeeds>(recommendationConfig);
  const [selectedId, setSelectedId] = useState("stack");
  const [selectedExerciseId, setSelectedExerciseId] = useState(exerciseBank[0]?.id ?? "");
  const [page, setPage] = useState<AppPage>("knowledge");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"graph" | "directory">("graph");
  const [progress, setProgress] = useState<ProgressMap>(seedProgress);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");
  const [apiMessage, setApiMessage] = useState("正在连接 FastAPI");

  useEffect(() => {
    let active = true;

    fetchBootstrap()
      .then((payload) => {
        if (!active) return;
        setNodes(payload.nodes);
        setEdges(payload.edges);
        setContents(payload.contents);
        setCodeExamples(payload.codeExamples);
        setExercises(payload.exercises);
        setProgress(payload.progress);
        setAnalysisRules(payload.analysisRules);
        setRecommendationsConfig(payload.recommendationConfig);
        setSelectedId((current) => payload.nodes.some((node) => node.id === current) ? current : payload.nodes[0]?.id ?? current);
        setSelectedExerciseId((current) =>
          payload.exercises.some((exercise) => exercise.id === current) ? current : payload.exercises[0]?.id ?? current
        );
        setApiStatus("connected");
        setApiMessage(`FastAPI 已连接，已加载 ${payload.nodes.length} 个知识点和 ${payload.exercises.length} 道题`);
      })
      .catch((error: Error) => {
        if (!active) return;
        setApiStatus("fallback");
        setApiMessage(`后端未连接，当前使用本地 Mock：${error.message}`);
      });

    return () => {
      active = false;
    };
  }, []);

  const currentNodeById = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const currentContentByNodeId = useMemo(
    () => Object.fromEntries(contents.map((content) => [content.nodeId, content])),
    [contents]
  );
  const currentExamplesByNodeId = useMemo(() => {
    return codeExamples.reduce<Record<string, CodeExample[]>>((result, example) => {
      result[example.nodeId] = [...(result[example.nodeId] ?? []), example];
      return result;
    }, {});
  }, [codeExamples]);

  const selectedNode = currentNodeById[selectedId] ?? nodes[0] ?? nodeById[selectedId] ?? knowledgeNodes[0];

  const filteredNodes = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return nodes;
    return nodes.filter((node) => {
      return (
        node.name.toLowerCase().includes(keyword) ||
        node.id.toLowerCase().includes(keyword) ||
        node.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    });
  }, [nodes, query]);

  const recommendations = useMemo(() => {
    const mastered = new Set(
      Object.entries(progress)
        .filter(([, item]) => item.status === "mastered")
        .map(([nodeId]) => nodeId)
    );
    const weak = new Set(
      Object.entries(progress)
        .filter(([, item]) => item.status === "weak")
        .map(([nodeId]) => nodeId)
    );
    const nextIds = edges
      .filter((edge) => mastered.has(edge.source) && !mastered.has(edge.target))
      .map((edge) => edge.target);
    const weakPrerequisites = edges
      .filter((edge) => weak.has(edge.target) && edge.type === "prerequisite")
      .map((edge) => edge.source);

    return Array.from(new Set([...weakPrerequisites, ...nextIds, ...recommendationsConfig.defaultPath]))
      .map((id) => currentNodeById[id])
      .filter(Boolean)
      .slice(0, recommendationsConfig.maxRecommendations) as KnowledgeNode[];
  }, [currentNodeById, edges, progress, recommendationsConfig]);

  function updateStatus(nodeId: string, status: ProgressStatus) {
    const score = statusScore[status];
    const nextRecord = createProgressRecord(status, score, progress[nodeId]);
    setProgress((current) => ({ ...current, [nodeId]: nextRecord }));

    postProgress(nodeId, nextRecord)
      .then(() => {
        setApiStatus("connected");
        setApiMessage(`FastAPI 已同步：${currentNodeById[nodeId]?.name ?? nodeId} -> ${statusLabel[status]}`);
      })
      .catch((error: Error) => {
        setApiStatus("error");
        setApiMessage(`状态已在前端更新，但同步后端失败：${error.message}`);
      });
  }

  function openKnowledge(nodeId: string) {
    setSelectedId(nodeId);
    setPage("knowledge");
  }

  function openExercise(exerciseId: string) {
    setSelectedExerciseId(exerciseId);
    setPage("oj");
  }

  const pageMeta = {
    knowledge: ["知识图谱", "知识图谱、状态跟踪与智能推荐闭环"],
    oj: ["OJ 练习", "练习题、提交入口与错因知识绑定"],
    analytics: ["学习追踪", "专业学习参数与复习风险识别"],
    ai: ["AI 辅助问答", "问答、代码分析与知识点跳转"]
  } satisfies Record<AppPage, string[]>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">AM</div>
          <div>
            <h1>AlgoMotion</h1>
            <p>数据结构智慧学习平台</p>
          </div>
        </div>

        <div className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索知识点 / 标签"
          />
        </div>

        <nav className="primary-nav" aria-label="主功能导航">
          <button className={page === "knowledge" ? "active" : ""} onClick={() => setPage("knowledge")}>
            <BookOpen size={17} />
            知识库
          </button>
          <button className={page === "oj" ? "active" : ""} onClick={() => setPage("oj")}>
            <ClipboardList size={17} />
            OJ 练习
          </button>
          <button className={page === "analytics" ? "active" : ""} onClick={() => setPage("analytics")}>
            <BarChart3 size={17} />
            学习追踪
          </button>
          <button className={page === "ai" ? "active" : ""} onClick={() => setPage("ai")}>
            <Bot size={17} />
            AI 辅助问答
          </button>
        </nav>

        <div className="view-switch" aria-label="视图切换">
          <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}>
            <GitFork size={16} />
            图谱
          </button>
          <button className={view === "directory" ? "active" : ""} onClick={() => setView("directory")}>
            <LayoutList size={16} />
            目录
          </button>
        </div>

        <DirectoryView
          nodes={nodes}
          edges={edges}
          selectedId={selectedId}
          progress={progress}
          onSelect={openKnowledge}
        />
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">{pageMeta[page][0]}</span>
            <h2>{pageMeta[page][1]}</h2>
          </div>
          <div className="topbar-actions">
            <span><ShieldCheck size={16} /> {statusLabel[progress[selectedId]?.status ?? "not_started"]}</span>
            <span><Code2 size={16} /> C++ 代码溯源</span>
            <span className={`api-badge ${apiStatus}`} title={apiMessage}><Database size={16} /> {apiStatus === "connected" ? "FastAPI 已连接" : apiStatus === "checking" ? "连接中" : "本地/异常模式"}</span>
          </div>
        </header>
        <p className={`api-message ${apiStatus}`}>{apiMessage}</p>

        {page === "knowledge" && (
          <div className="main-grid">
            <section className="visual-panel">
              {view === "graph" ? (
                <GraphView
                  nodes={nodes}
                  edges={edges}
                  filteredIds={new Set(filteredNodes.map((node) => node.id))}
                  selectedId={selectedId}
                  progress={progress}
                  onSelect={openKnowledge}
                />
              ) : (
                <DirectoryView
                  nodes={filteredNodes}
                  edges={edges}
                  selectedId={selectedId}
                  progress={progress}
                  onSelect={openKnowledge}
                  expanded
                />
              )}
            </section>

            <KnowledgeDetail
              node={selectedNode}
              content={currentContentByNodeId[selectedId] ?? contentByNodeId[selectedId]}
              codeExamples={currentExamplesByNodeId[selectedId] ?? []}
              edges={edges}
              exercises={exercises.filter((exercise) => exercise.nodeId === selectedId)}
              progress={progress[selectedId]?.status ?? "not_started"}
              onStatusChange={(status) => updateStatus(selectedId, status)}
              onSelect={openKnowledge}
              onOpenExercise={openExercise}
            />
          </div>
        )}

        {page === "oj" && (
          <ExerciseOjPage
            exercises={exercises}
            selectedExerciseId={selectedExerciseId}
            onSelectExercise={setSelectedExerciseId}
            onOpenKnowledge={openKnowledge}
            nodeById={currentNodeById}
            contentByNodeId={currentContentByNodeId}
            analysisRules={analysisRules}
          />
        )}

        {page === "analytics" && (
          <LearningAnalyticsPage
            nodes={nodes}
            progress={progress}
            recommendations={recommendations}
            onSelect={openKnowledge}
          />
        )}

        {page === "ai" && <AiPanel selectedNode={selectedNode} nodeById={currentNodeById} onSelect={openKnowledge} />}
      </section>
    </main>
  );
}
