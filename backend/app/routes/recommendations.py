"""
推荐相关路由
"""
from fastapi import APIRouter, HTTPException, Query

from ..schemas import RecommendationItem
from ..response import success_response

router = APIRouter(prefix="/api/recommendations", tags=["推荐"])


def get_nodes_data():
    """获取知识点数据"""
    from ..main import nodes
    return nodes()


def get_edges_data():
    """获取边数据"""
    from ..main import edges
    return edges()


def get_progress_store():
    """获取进度存储"""
    from ..main import progress_store
    return progress_store


def get_recommendation_config():
    """获取推荐配置"""
    from ..main import recommendation_seeds
    return recommendation_seeds()


@router.get("", response_model=dict)
async def get_recommendations(
    limit: int = Query(default=5, ge=1, le=20, description="返回数量"),
    type: str = Query(default="next", description="推荐类型: next/weak/review")
):
    """
    获取学习路径推荐
    
    - **limit**: 返回数量，默认 5
    - **type**: 推荐类型
      - `next`: 基于已掌握节点的下一步推荐
      - `weak`: 薄弱知识点优先
      - `review`: 需要复习的知识点
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
        # 基于已掌握的下一节点
        for edge in edges:
            if edge.get("type") in {"contains", "prerequisite"}:
                if edge.get("source") in mastered and edge.get("target") not in mastered:
                    candidates.append(edge.get("target"))
        reason = "基于当前进度推荐的下一个学习节点"
    
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
        for node_id in default_path[:limit]:
            if node_id in node_by_id:
                node = node_by_id[node_id]
                recommendations.append(RecommendationItem(
                    id=node.get("id"),
                    name=node.get("name"),
                    difficulty=node.get("difficulty", 5),
                    estimated_minutes=node.get("estimatedMinutes"),
                    reason="基于学习路径的推荐",
                    priority=idx + 1
                ))
    
    return success_response([r.model_dump() for r in recommendations])
