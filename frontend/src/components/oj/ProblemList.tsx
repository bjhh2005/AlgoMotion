import { useMemo, useState, type ReactNode } from "react";
import { Filter, Search, X } from "lucide-react";
import type { Exercise, KnowledgeNode } from "../../types";
import {
  allTagLabels,
  filterCatalog,
  tagLabel,
  type OjCatalogItem,
  type OjPracticeStatus
} from "./oj-catalog";
import { difficultyLabel, typeLabel } from "./oj-utils";

interface Props {
  items: OjCatalogItem[];
  tagSlugs: string[];
  loading: boolean;
  error: string;
  nodeById: Record<string, KnowledgeNode>;
  onOpen: (item: OjCatalogItem) => void;
}

const typeFilterOptions: { value: "all" | Exercise["type"]; label: string }[] = [
  { value: "all", label: "全部题型" },
  { value: "choice", label: "选择题" },
  { value: "fill", label: "填空题" },
  { value: "programming", label: "编程题" }
];

const diffFilterOptions: { value: "all" | Exercise["difficulty"]; label: string }[] = [
  { value: "all", label: "全部难度" },
  { value: "basic", label: "基础" },
  { value: "interview", label: "进阶" },
  { value: "postgraduate", label: "考研" }
];

const statusOptions: { value: "all" | OjPracticeStatus; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "未尝试", label: "未尝试" },
  { value: "尝试中", label: "尝试中" },
  { value: "已通过", label: "已通过" }
];

const statusDot: Record<OjPracticeStatus, string> = {
  已通过: "passed",
  尝试中: "learning",
  未尝试: "idle"
};

function typeBadgeClass(type?: Exercise["type"]) {
  if (type === "choice") return "choice";
  if (type === "fill") return "fill";
  return "programming";
}

function diffClass(difficulty?: Exercise["difficulty"]) {
  if (difficulty === "basic") return "basic";
  if (difficulty === "postgraduate") return "postgraduate";
  return "interview";
}

export function ProblemList({
  items,
  tagSlugs,
  loading,
  error,
  nodeById,
  onOpen
}: Props) {
  const [keyword, setKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | Exercise["type"]>("all");
  const [diffFilter, setDiffFilter] = useState<"all" | Exercise["difficulty"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | OjPracticeStatus>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tagOptions = useMemo(() => allTagLabels(tagSlugs, nodeById), [tagSlugs, nodeById]);

  const filtered = useMemo(
    () =>
      filterCatalog(items, {
        keyword,
        type: typeFilter,
        difficulty: diffFilter,
        status: statusFilter,
        tags: selectedTags
      }),
    [items, keyword, typeFilter, diffFilter, statusFilter, selectedTags]
  );

  const hasFilter =
    Boolean(keyword) ||
    typeFilter !== "all" ||
    diffFilter !== "all" ||
    statusFilter !== "all" ||
    selectedTags.length > 0;

  function toggleTag(slug: string) {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug]
    );
  }

  function clearFilters() {
    setKeyword("");
    setTypeFilter("all");
    setDiffFilter("all");
    setStatusFilter("all");
    setSelectedTags([]);
  }

  return (
    <div className="oj-bank">
      <div className="oj-bank-inner">
        <div className="oj-bank-card">
          <div className="oj-bank-search-row">
            <div className="oj-bank-search">
              <Search size={16} />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="按题目 ID、标题、章节或标签搜索（如 ex-stack-001 / 二分查找 / 图）"
              />
            </div>
            <div className="oj-bank-selects">
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
                {typeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select value={diffFilter} onChange={(event) => setDiffFilter(event.target.value as typeof diffFilter)}>
                {diffFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="oj-bank-tags">
            <div className="oj-bank-tags-head">
              <Filter size={14} />
              <span>按标签筛选（可多选）</span>
              {selectedTags.length > 0 && (
                <button type="button" className="oj-bank-link" onClick={() => setSelectedTags([])}>
                  清除标签
                </button>
              )}
            </div>
            <div className="oj-bank-tag-cloud">
              {loading && tagOptions.length === 0 && (
                <span className="oj-bank-hint muted">正在加载标签…</span>
              )}
              {!loading && tagOptions.length === 0 && (
                <span className="oj-bank-hint muted">暂无可用标签</span>
              )}
              {tagOptions.map(({ slug, label }) => (
                <button
                  key={slug}
                  type="button"
                  className={`oj-bank-tag ${selectedTags.includes(slug) ? "active" : ""}`}
                  onClick={() => toggleTag(slug)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {hasFilter && (
            <div className="oj-bank-chips">
              <span>当前筛选：</span>
              {keyword && <FilterChip onClear={() => setKeyword("")}>关键词: {keyword}</FilterChip>}
              {typeFilter !== "all" && (
                <FilterChip onClear={() => setTypeFilter("all")}>{typeLabel[typeFilter]}</FilterChip>
              )}
              {diffFilter !== "all" && (
                <FilterChip onClear={() => setDiffFilter("all")}>{difficultyLabel[diffFilter]}</FilterChip>
              )}
              {statusFilter !== "all" && (
                <FilterChip onClear={() => setStatusFilter("all")}>{statusFilter}</FilterChip>
              )}
              {selectedTags.map((slug) => (
                <FilterChip key={slug} onClear={() => toggleTag(slug)}>
                  #{tagLabel(slug, nodeById)}
                </FilterChip>
              ))}
              <button type="button" className="oj-bank-reset" onClick={clearFilters}>
                重置全部
              </button>
            </div>
          )}
        </div>

        {loading && <p className="oj-bank-hint muted">正在从后端加载题库…</p>}
        {error && <p className="oj-problem-error">{error}</p>}

        <section className="oj-bank-section">
          <div className="oj-bank-section-head">
            <h3>题库列表</h3>
            <span className="muted">共 {filtered.length} 道题</span>
          </div>

          <div className="oj-bank-table">
            <div className="oj-bank-table-head">
              <span />
              <span>题目 ID</span>
              <span>标题 · 标签</span>
              <span>章节</span>
              <span>题型</span>
              <span>难度</span>
              <span>状态</span>
            </div>

            {filtered.length === 0 && !loading && (
              <p className="oj-bank-empty">没有匹配的题目，试试清除部分筛选条件</p>
            )}

            {filtered.map((item) => (
              <button key={item.id} type="button" className="oj-bank-row" onClick={() => onOpen(item)}>
                <span className={`oj-status-dot ${statusDot[item.status ?? "未尝试"]}`} title={item.status} />
                <span className="oj-bank-id">{item.id}</span>
                <span className="oj-bank-title-col">
                  <strong>{item.title}</strong>
                  <span className="oj-bank-inline-tags">
                    {item.tag.map((slug) => (
                      <em
                        key={slug}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleTag(slug);
                        }}
                      >
                        #{tagLabel(slug, nodeById)}
                      </em>
                    ))}
                  </span>
                </span>
                <span>{item.knowledge ?? "—"}</span>
                <span className={`oj-type-pill ${typeBadgeClass(item.type)}`}>
                  {item.type ? typeLabel[item.type] : "—"}
                </span>
                <span className={`oj-diff-text ${diffClass(item.difficulty)}`}>
                  {item.difficulty ? difficultyLabel[item.difficulty] : "—"}
                </span>
                <span className="oj-bank-status-text">{item.status ?? "未尝试"}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="oj-bank-chip">
      {children}
      <button type="button" onClick={onClear} aria-label="清除">
        <X size={12} />
      </button>
    </span>
  );
}
