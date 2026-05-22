"""
推荐相关路由
"""
from fastapi import APIRouter, HTTPException, Query

from ..schemas import RecommendationItem
from ..response import success_response

router = APIRouter(prefix="/api/recommendations", tags=["推荐"])


def get_nodes_data():
    """获取知识点数据"""
    from ..storage import nodes
    return nodes()


def get_edges_data():
    """获取边数据"""
    from ..storage import edges
    return edges()


def get_progress_store():
    """获取进度存储"""
    from ..storage import progress_store
    return progress_store


def get_recommendation_config():
    """获取推荐配置"""
    from ..storage import recommendation_seeds
    return recommendation_seeds()


def _collect_prerequisite_chain(
    node_id: str,
    edges: list[dict],
    node_by_id: dict,
    max_depth: int = 2,
) -> list[str]:
    chain: list[str] = []
    current = node_id
    visited = {node_id}

    for _ in range(max_depth):
        parent = None
        for edge in edges:
            if edge.get("target") != current:
                continue
            if edge.get("type") not in {"prerequisite", "contains"}:
                continue
            source = edge.get("source")
            if source and source in node_by_id and source not in visited:
                parent = source
                break
        if not parent:
            break
        chain.insert(0, parent)
        visited.add(parent)
        current = parent

    return chain


def build_path_for_node(
    default_path: list[str],
    node_id: str | None,
    edges: list[dict],
    node_by_id: dict,
    limit: int,
    full: bool = False,
) -> list[tuple[str, str]]:
    """根据当前选中节点生成路径窗口：(node_id, reason)"""
    if node_id and node_id in default_path:
        if full:
            selected_index = default_path.index(node_id)
            return [
                (
                    path_node_id,
                    "当前知识点"
                    if path_node_id == node_id
                    else "前置主线"
                    if default_path.index(path_node_id) < selected_index
                    else "主线路径后续"
                )
                for path_node_id in default_path
                if path_node_id in node_by_id
            ]

        selected_index = default_path.index(node_id)
        segment = default_path[selected_index:selected_index + limit]
        return [
            (path_node_id, "当前知识点" if index == 0 else "主线路径后续")
            for index, path_node_id in enumerate(segment)
            if path_node_id in node_by_id
        ]

    if node_id and node_id in node_by_id:
        items: list[tuple[str, str]] = []
        seen: set[str] = set()
        max_depth = 5 if full else 2

        for prereq_id in _collect_prerequisite_chain(node_id, edges, node_by_id, max_depth=max_depth):
            if prereq_id in seen:
                continue
            seen.add(prereq_id)
            items.append((prereq_id, "建议先掌握"))

        if node_id not in seen:
            seen.add(node_id)
            items.append((node_id, "当前知识点"))

        for edge in edges:
            if edge.get("source") != node_id:
                continue
            if edge.get("type") not in {"contains", "prerequisite", "used_in", "related"}:
                continue
            target = edge.get("target")
            if not target or target not in node_by_id or target in seen:
                continue
            seen.add(target)
            label = edge.get("label") or "关联推荐"
            items.append((target, label))
            if not full and len(items) >= limit:
                return items[:limit]

        for path_node_id in default_path:
            if path_node_id in seen or path_node_id not in node_by_id:
                continue
            seen.add(path_node_id)
            items.append((path_node_id, "回归主线路径"))
            if not full and len(items) >= limit:
                break

        return items if full else items[:limit]

    return [(path_node_id, "主线路径") for path_node_id in default_path[:limit] if path_node_id in node_by_id]


def build_next_for_node(
    node_id: str | None,
    edges: list[dict],
    node_by_id: dict,
    mastered: set[str],
    limit: int,
) -> list[tuple[str, str]]:
    """根据当前选中节点生成下一步推荐：(node_id, reason)"""
    if node_id and node_id in node_by_id:
        selected_name = node_by_id[node_id].get("name", node_id)
        candidates: list[tuple[str, str]] = []
        seen: set[str] = set()

        for edge in edges:
            if edge.get("source") != node_id:
                continue
            target = edge.get("target")
            if not target or target not in node_by_id or target in seen:
                continue
            if target in mastered:
                continue
            seen.add(target)
            label = edge.get("label") or edge.get("type") or "关联"
            candidates.append((target, f"「{selected_name}」的{label}"))

        if candidates:
            return candidates[:limit]

    global_candidates: list[tuple[str, str]] = []
    seen = set()
    for edge in edges:
        if edge.get("type") not in {"contains", "prerequisite"}:
            continue
        source = edge.get("source")
        target = edge.get("target")
        if source in mastered and target not in mastered and target in node_by_id and target not in seen:
            seen.add(target)
            global_candidates.append((target, "基于当前进度推荐的下一个学习节点"))
    return global_candidates[:limit]


@router.get("", response_model=dict)
async def get_recommendations(
    limit: int = Query(default=5, ge=1, le=20, description="返回数量"),
    type: str = Query(default="next", description="推荐类型: next/weak/review/path"),
    node_id: str | None = Query(default=None, description="当前选中的知识点 ID"),
    full: bool = Query(default=False, description="path 类型下返回当前节点所在的完整路径"),
):
    """
    获取学习路径推荐
    
    - **limit**: 返回数量，默认 5
    - **type**: 推荐类型
      - `next`: 基于已掌握节点的下一步推荐
      - `weak`: 薄弱知识点优先
      - `review`: 需要复习的知识点
      - `path`: 默认主线路径（按 recommendation-seeds.json 顺序返回）
    - **node_id**: 当前选中的知识点，传入后路径与推荐会围绕该节点生成
    - **full**: 为 true 且 type=path 时，返回当前节点所在的完整路径而非截断窗口
    """
    progress = get_progress_store()
    nodes = get_nodes_data()
    edges = get_edges_data()
    config = get_recommendation_config()
    
    node_by_id = {n.get("id"): n for n in nodes}
    
    # 根据类型生成推荐
    candidates = []
    reason = ""
    
    mastered = {node_id for node_id, record in progress.items() if record.get("status") == "mastered"}
    weak = {node_id for node_id, record in progress.items() if record.get("status") == "weak"}
    
    if type == "next":
        candidate_pairs = build_next_for_node(node_id, edges, node_by_id, mastered, limit)
        recommendations = []
        for idx, (candidate_id, candidate_reason) in enumerate(candidate_pairs):
            node = node_by_id[candidate_id]
            recommendations.append(RecommendationItem(
                id=node.get("id"),
                name=node.get("name"),
                difficulty=node.get("difficulty", 5),
                estimated_minutes=node.get("estimatedMinutes"),
                reason=candidate_reason,
                priority=idx + 1
            ))

        if not recommendations:
            default_path = config.get("defaultPath", [])
            for fallback_idx, fallback_id in enumerate(default_path[:limit]):
                if fallback_id in node_by_id:
                    node = node_by_id[fallback_id]
                    recommendations.append(RecommendationItem(
                        id=node.get("id"),
                        name=node.get("name"),
                        difficulty=node.get("difficulty", 5),
                        estimated_minutes=node.get("estimatedMinutes"),
                        reason="基于学习路径的推荐",
                        priority=fallback_idx + 1
                    ))

        return success_response([r.model_dump() for r in recommendations])
    
    elif type == "weak":
        # 薄弱优先
        candidates = list(weak)
        reason = "优先巩固薄弱知识点"
    
    elif type == "review":
        # 需要复习的节点
        from datetime import datetime
        now = datetime.now().isoformat() + "Z"
        for node_id, record in progress.items():
            due = record.get("reviewDueAt")
            if due and due <= now:
                candidates.append(node_id)
        reason = "根据记忆曲线推荐的复习节点"

    elif type == "path":
        default_path = config.get("defaultPath", [])
        path_pairs = build_path_for_node(default_path, node_id, edges, node_by_id, limit, full=full)
        recommendations = []
        for idx, (path_node_id, path_reason) in enumerate(path_pairs):
            node = node_by_id[path_node_id]
            recommendations.append(RecommendationItem(
                id=node.get("id"),
                name=node.get("name"),
                difficulty=node.get("difficulty", 5),
                estimated_minutes=node.get("estimatedMinutes"),
                reason=path_reason,
                priority=idx + 1
            ))
        return success_response([r.model_dump() for r in recommendations])
    
    else:
        raise HTTPException(status_code=400, detail="Invalid recommendation type")
    
    # 去重并限制数量
    seen = set()
    unique_candidates = []
    for c in candidates:
        if c not in seen and c in node_by_id:
            seen.add(c)
            unique_candidates.append(c)
    
    # 构建推荐结果
    recommendations = []
    for idx, node_id in enumerate(unique_candidates[:limit]):
        node = node_by_id[node_id]
        priority = idx + 1
        
        # 计算优先级
        if type == "weak":
            mastery = progress.get(node_id, {}).get("metrics", {}).get("mastery", 1)
            priority = int((1 - mastery) * 100)
        elif type == "review":
            priority = idx + 1
        
        recommendations.append(RecommendationItem(
            id=node.get("id"),
            name=node.get("name"),
            difficulty=node.get("difficulty", 5),
            estimated_minutes=node.get("estimatedMinutes"),
            reason=reason,
            priority=priority
        ))
    
    # 如果没有推荐结果，使用默认路径
    if not recommendations:
        default_path = config.get("defaultPath", [])
        for fallback_idx, node_id in enumerate(default_path[:limit]):
            if node_id in node_by_id:
                node = node_by_id[node_id]
                recommendations.append(RecommendationItem(
                    id=node.get("id"),
                    name=node.get("name"),
                    difficulty=node.get("difficulty", 5),
                    estimated_minutes=node.get("estimatedMinutes"),
                    reason="基于学习路径的推荐",
                    priority=fallback_idx + 1
                ))
    
    return success_response([r.model_dump() for r in recommendations])
