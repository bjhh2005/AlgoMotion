import { Crosshair, MapPin, Navigation, Search } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { KnowledgeNode, ProgressMap, RecommendationItem } from "../types";
import { getPathReason, getStatusLabel } from "../utils/pathGuide";

import { getSplitGridColumns } from "../utils/splitLayout";

interface Props {
  query: string;
  searchResults: KnowledgeNode[];
  pathItems: RecommendationItem[];
  recommendationItems: RecommendationItem[];
  progress: ProgressMap;
  selectedId: string;
  selectedNodeName: string;
  activePathStep: number | null;
  splitRatio: number;
  onQueryChange: (value: string) => void;
  onSearchKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSelectPathStep: (stepIndex: number, nodeId: string) => void;
  onLocate: (nodeId: string) => void;
}

export function PathGuidePanel({
  query,
  searchResults,
  pathItems,
  recommendationItems,
  progress,
  selectedId,
  selectedNodeName,
  activePathStep,
  splitRatio,
  onQueryChange,
  onSearchKeyDown,
  onSelectPathStep,
  onLocate
}: Props) {
  const keyword = query.trim();
  const showSearch = keyword.length > 0;

  return (
    <section
      className="path-guide-panel"
      aria-label="路径指导与搜索定位"
      style={{ gridTemplateColumns: getSplitGridColumns(splitRatio) }}
    >
      <div className="path-guide-section path-guide-section--path">
        <div className="path-guide-header">
          <div className="path-guide-title">
            <Navigation size={18} />
            <div>
              <h3>路径指导</h3>
              <span className="path-guide-context">当前：{selectedNodeName}</span>
            </div>
          </div>
        </div>

        <div className="path-guide-path-scroll">
          <div className="path-guide-track" role="list" aria-label="主线路径">
            {pathItems.length === 0 ? (
              <p className="path-guide-empty">暂无主线路径，请检查后端推荐配置</p>
            ) : (
              pathItems.map((item, index) => {
                const status = progress[item.id]?.status ?? "not_started";
                const isActive = activePathStep === index || selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={`path-step ${isActive ? "active" : ""} ${status}`}
                    onClick={() => onSelectPathStep(index, item.id)}
                    title={item.reason || getPathReason(item.id, progress, pathItems.map((step) => step.id))}
                  >
                    <span className="path-step__index">{index + 1}</span>
                    <span className="path-step__body">
                      <strong>{item.name}</strong>
                      <em>{getStatusLabel(status)}</em>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {recommendationItems.length > 0 && (
            <div className="path-guide-recommend">
              <span className="path-guide-recommend__label">推荐下一步（基于「{selectedNodeName}」）</span>
              <div className="path-guide-recommend__list">
                {recommendationItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`path-recommend-chip ${selectedId === item.id ? "active" : ""}`}
                    title={item.reason}
                    onClick={() => onLocate(item.id)}
                  >
                    <span>{item.name}</span>
                    {item.reason ? <em>{item.reason}</em> : null}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="path-guide-split-gap" aria-hidden="true" />

      <div className="path-guide-section path-guide-section--search">
        <div className="path-guide-header">
          <div className="path-guide-title">
            <Search size={18} />
            <h3>搜索定位</h3>
          </div>
          {showSearch && (
            <span className="path-guide-count">匹配 {searchResults.length} 个知识点</span>
          )}
        </div>

        <label className="path-guide-search-box">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="搜索知识点 / 标签 / 定义"
            aria-label="搜索知识点"
          />
        </label>

        <div className="path-guide-search-scroll">
          {!showSearch ? (
            <p className="path-guide-hint">
              输入关键词后，此处显示匹配结果并支持一键定位到图谱；按 Enter 可定位首个匹配。
            </p>
          ) : searchResults.length === 0 ? (
            <p className="path-guide-empty">未找到匹配「{keyword}」的知识点</p>
          ) : (
            <>
              <ul className="path-search-results">
                {searchResults.map((node) => {
                  const status = progress[node.id]?.status ?? "not_started";
                  const isSelected = selectedId === node.id;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        className={`path-search-item ${isSelected ? "active" : ""}`}
                        onClick={() => onLocate(node.id)}
                      >
                        <span className="path-search-item__main">
                          <strong>{node.name}</strong>
                          <em>{node.category} · {getStatusLabel(status)}</em>
                        </span>
                        <span className="path-search-item__locate">
                          <Crosshair size={14} />
                          定位
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="path-guide-locate-first"
                onClick={() => onLocate(searchResults[0].id)}
              >
                <MapPin size={15} />
                定位首个匹配：{searchResults[0].name}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
