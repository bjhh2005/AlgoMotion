import {
  fetchGitTags,
  fetchProblemData,
  isProblemApiError,
  searchProblemsByTag,
  type TagProblemIndex
} from "../../api";
import type { Exercise, KnowledgeNode, ProgressMap, ProgressStatus } from "../../types";

export type OjPracticeStatus = "未尝试" | "尝试中" | "已通过";

export interface OjCatalogItem extends TagProblemIndex {
  type?: Exercise["type"];
  difficulty?: Exercise["difficulty"];
  nodeId?: string;
  ojRoute?: string;
  ojProblemId?: string;
  status?: OjPracticeStatus;
  knowledge?: string;
}

function progressToStatus(status?: ProgressStatus): OjPracticeStatus {
  if (status === "mastered") return "已通过";
  if (status === "learning") return "尝试中";
  return "未尝试";
}

export function tagLabel(slug: string, nodeById: Record<string, KnowledgeNode>) {
  return nodeById[slug]?.name ?? slug;
}

export function allTagLabels(tagSlugs: string[], nodeById: Record<string, KnowledgeNode>) {
  return tagSlugs.map((slug) => ({
    slug,
    label: tagLabel(slug, nodeById)
  }));
}

/** 从 GET /api/git_tag 拉取并去重排序 */
export async function fetchCatalogTags(): Promise<string[]> {
  const raw = await fetchGitTags();
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((tag) => typeof tag === "string" && tag.trim()))].sort();
}

export async function fetchProblemCatalog(
  nodeById: Record<string, KnowledgeNode>,
  progress: ProgressMap,
  tagSlugs: string[]
): Promise<OjCatalogItem[]> {
  if (tagSlugs.length === 0) return [];

  const responses = await Promise.all(
    tagSlugs.map((slug) => searchProblemsByTag(slug).catch(() => ({ problems: [] })))
  );

  const indexMap = new Map<string, TagProblemIndex>();
  for (const response of responses) {
    for (const item of response.problems ?? []) {
      indexMap.set(item.id, item);
    }
  }

  const enriched = await Promise.all(
    Array.from(indexMap.values()).map(async (item) => {
      const meta = await fetchProblemData(item.id).catch(() => null);
      const nodeId = meta && !isProblemApiError(meta) ? meta.nodeId : item.tag[0];
      const progressStatus = nodeId ? progress[nodeId]?.status : undefined;

      return {
        ...item,
        type: meta && !isProblemApiError(meta) ? meta.type : "programming",
        difficulty: meta && !isProblemApiError(meta) ? meta.difficulty : undefined,
        nodeId,
        ojRoute: meta && !isProblemApiError(meta) ? meta.ojRoute : `/oj/${item.id}`,
        ojProblemId: meta && !isProblemApiError(meta) ? meta.ojProblemId : undefined,
        status: progressToStatus(progressStatus),
        knowledge: nodeId ? tagLabel(nodeId, nodeById) : tagLabel(item.tag[0] ?? "", nodeById)
      } satisfies OjCatalogItem;
    })
  );

  return enriched;
}

export function filterCatalog(
  items: OjCatalogItem[],
  filters: {
    keyword: string;
    type: "all" | Exercise["type"];
    difficulty: "all" | Exercise["difficulty"];
    status: "all" | OjPracticeStatus;
    tags: string[];
  }
) {
  const kw = filters.keyword.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.difficulty !== "all" && item.difficulty !== filters.difficulty) return false;
    if (filters.status !== "all" && (item.status ?? "未尝试") !== filters.status) return false;
    if (filters.tags.length && !filters.tags.every((tag) => item.tag.includes(tag))) return false;

    if (kw) {
      const haystack = [
        item.id,
        item.title,
        item.knowledge ?? "",
        ...item.tag
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(kw)) return false;
    }

    return true;
  });
}

export function catalogItemToExercise(item: OjCatalogItem): Exercise {
  return {
    id: item.id,
    nodeId: item.nodeId ?? item.tag[0] ?? "",
    type: item.type ?? "programming",
    difficulty: item.difficulty ?? "interview",
    title: item.title,
    answer: "",
    ojRoute: item.ojRoute,
    ojProblemId: item.ojProblemId,
    path: item.path
  };
}
