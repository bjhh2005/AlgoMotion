import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { fetchBootstrap } from "../api";
import { BlankView } from "./oj/BlankView";
import { ChoiceView } from "./oj/ChoiceView";
import { CodeView } from "./oj/CodeView";
import { ProblemList } from "./oj/ProblemList";
import {
  applyRecommendations,
  catalogItemToExercise,
  fetchProblemCatalog,
  type OjCatalogItem
} from "./oj/oj-catalog";
import { mergeProgrammingExercise } from "./oj/programming-1001";
import type { CodeAnalysisRule, KnowledgeContent, KnowledgeNode, ProgressMap, ProgressRecord } from "../types";
import { typeLabel } from "./oj/oj-utils";

interface Props {
  selectedExerciseId: string;
  onSelectExercise: (exerciseId: string) => void;
  onOpenKnowledge: (nodeId: string) => void;
  onJudgeComplete?: (nodeId: string, accepted: boolean, previous?: ProgressRecord) => void;
  nodeById: Record<string, KnowledgeNode>;
  contentByNodeId: Record<string, KnowledgeContent>;
  analysisRules: CodeAnalysisRule[];
}

function indexInList(list: OjCatalogItem[], id: string) {
  const index = list.findIndex((item) => item.id === id);
  return index >= 0 ? index : 0;
}

export function ExerciseOjPage({
  selectedExerciseId,
  onSelectExercise,
  onOpenKnowledge,
  onJudgeComplete,
  nodeById,
  contentByNodeId,
  analysisRules
}: Props) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [catalog, setCatalog] = useState<OjCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetchBootstrap()
      .then((payload) => setProgress(payload.progress))
      .catch(() => setProgress({}));
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const items = await fetchProblemCatalog(nodeById, progress);
      setCatalog(items);
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "题库加载失败");
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [nodeById, progress]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!selectedExerciseId || catalog.length === 0) return;
    const exists = catalog.some((item) => item.id === selectedExerciseId);
    if (exists) setActiveId(selectedExerciseId);
  }, [selectedExerciseId, catalog]);

  const activeItem = useMemo(
    () => catalog.find((item) => item.id === activeId) ?? null,
    [catalog, activeId]
  );

  const siblings = useMemo(() => {
    if (!activeItem?.type) return activeItem ? [activeItem] : [];
    return catalog.filter((item) => item.type === activeItem.type);
  }, [catalog, activeItem]);

  const siblingIndex = activeItem ? indexInList(siblings, activeItem.id) : 0;

  const activeProgrammingExercise = useMemo(() => {
    if (!activeItem) return null;
    const type = activeItem.type ?? "programming";
    if (type !== "programming") return null;
    return mergeProgrammingExercise(catalogItemToExercise({ ...activeItem, type }));
  }, [activeItem]);

  function openProblem(item: OjCatalogItem) {
    setActiveId(item.id);
    onSelectExercise(item.id);
  }

  function backToList() {
    setActiveId(null);
  }

  function handleSiblingChange(index: number) {
    const next = siblings[index];
    if (next) openProblem(next);
  }

  function refreshRecommendations() {
    setCatalog((current) => applyRecommendations(current, progress, nodeById));
  }

  const typeName = activeItem?.type ? typeLabel[activeItem.type] : "题目";

  return (
    <section className="oj-shell">
      <header className="oj-topbar">
        <nav className="oj-breadcrumb">
          <button type="button" className="oj-crumb-btn" onClick={backToList}>
            OJ 练习
          </button>
          {activeItem && (
            <>
              <ChevronRight size={14} />
              <button type="button" className="oj-crumb-btn" onClick={backToList}>
                题库
              </button>
              <ChevronRight size={14} />
              <span>{typeName}</span>
              <ChevronRight size={14} />
              <span className="oj-crumb-current">{activeItem.id}</span>
            </>
          )}
          {!activeItem && <span className="oj-crumb-current">题库 · 按标签 / ID 检索</span>}
        </nav>
        {activeItem && (
          <button type="button" className="oj-btn-outline oj-back-btn" onClick={backToList}>
            <ArrowLeft size={14} />
            返回题库
          </button>
        )}
      </header>

      {!activeItem ? (
        <ProblemList
          items={catalog}
          loading={catalogLoading}
          error={catalogError}
          nodeById={nodeById}
          onOpen={openProblem}
          onRefreshRecommendations={refreshRecommendations}
        />
      ) : activeItem.type === "choice" ? (
        <div className="oj-mode-body">
          <ChoiceView
            questions={siblings.map(catalogItemToExercise)}
            index={siblingIndex}
            onIndexChange={handleSiblingChange}
            nodeById={nodeById}
          />
        </div>
      ) : activeItem.type === "fill" ? (
        <div className="oj-mode-body">
          <BlankView
            questions={siblings.map(catalogItemToExercise)}
            index={siblingIndex}
            onIndexChange={handleSiblingChange}
            nodeById={nodeById}
          />
        </div>
      ) : (
        <div className="oj-mode-body code">
          <CodeView
            question={activeProgrammingExercise}
            nodeById={nodeById}
            contentByNodeId={contentByNodeId}
            analysisRules={analysisRules}
            onOpenKnowledge={onOpenKnowledge}
            onJudgeComplete={onJudgeComplete}
          />
        </div>
      )}
    </section>
  );
}
