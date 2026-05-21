from fastapi import APIRouter, HTTPException

from ..schemas import ProgressUpdate
from ..storage import (
    code_examples,
    contents,
    edges,
    exercises,
    nodes,
    progress_store,
    recommendation_seeds,
    set_progress_record,
)

router = APIRouter(tags=["兼容旧接口"])


@router.get("/api/knowledge/nodes")
def get_nodes():
    return nodes()


@router.get("/api/knowledge/edges")
def get_edges():
    return edges()


@router.get("/api/knowledge/graph")
def get_graph():
    return {"nodes": nodes(), "edges": edges()}


@router.get("/api/knowledge/{node_id}")
def get_node(node_id: str):
    node = next((item for item in nodes() if item["id"] == node_id), None)
    if not node:
        raise HTTPException(status_code=404, detail="Knowledge node not found")

    related_edges = [
        edge for edge in edges() if edge["source"] == node_id or edge["target"] == node_id
    ]
    related_exercises = [
        item for item in exercises() if item["nodeId"] == node_id
    ]
    content = next((item for item in contents() if item["nodeId"] == node_id), None)
    examples = [item for item in code_examples() if item["nodeId"] == node_id]
    return {
        "node": node,
        "content": content,
        "codeExamples": examples,
        "relations": related_edges,
        "exercises": related_exercises,
    }


@router.get("/api/progress/me")
def get_progress():
    return progress_store


@router.post("/api/progress/update")
def update_progress(payload: ProgressUpdate):
    record = set_progress_record(payload.nodeId, payload.model_dump())
    return {"ok": True, "progress": record}


@router.get("/api/recommendations/me")
def get_recommendations():
    config = recommendation_seeds()
    mastered = {
        node_id
        for node_id, record in progress_store.items()
        if record.get("status") == "mastered"
    }
    weak = [
        node_id for node_id, record in progress_store.items() if record.get("status") == "weak"
    ]

    candidates = []
    for edge in edges():
        if edge["type"] in {"contains", "prerequisite"} and edge["source"] in mastered:
            if edge["target"] not in mastered:
                candidates.append(edge["target"])

    if not candidates:
        candidates = config["defaultPath"]

    node_by_id = {item["id"]: item for item in nodes()}
    recommended = [node_by_id[node_id] for node_id in dict.fromkeys(candidates) if node_id in node_by_id]
    weak_nodes = [node_by_id[node_id] for node_id in weak if node_id in node_by_id]

    return {
        "recommended": recommended[: config["maxRecommendations"]],
        "weak": weak_nodes,
        "reason": "基于已掌握节点、前置关系与薄弱标记生成的规则推荐。",
    }
