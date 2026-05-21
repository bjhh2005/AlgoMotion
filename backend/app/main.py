import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai_assistant import router as ai_router
from .data_access import ROOT, CONTENT_DIR, code_analysis_rules, code_examples, contents, edges, exercises, nodes, read_json, recommendation_seeds
from .schemas import ProgressUpdate


app = FastAPI(title="AlgoMotion API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_local_env() -> None:
    for env_path in (ROOT / ".env", ROOT / "backend" / ".env"):
        if not env_path.exists():
            continue
        with env_path.open("r", encoding="utf-8") as file:
            for raw_line in file:
                line = raw_line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip().lstrip("\ufeff"), value.strip().strip("\"'"))


load_local_env()

progress_store: dict[str, dict] = read_json(CONTENT_DIR / "initial-progress.json")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "AlgoMotion API"}


@app.get("/api/bootstrap")
def bootstrap():
    return {
        "nodes": nodes(),
        "edges": edges(),
        "contents": contents(),
        "codeExamples": code_examples(),
        "exercises": exercises(),
        "progress": progress_store,
        "analysisRules": code_analysis_rules(),
        "recommendationConfig": recommendation_seeds()
    }


@app.get("/api/knowledge/nodes")
def get_nodes():
    return nodes()


@app.get("/api/knowledge/edges")
def get_edges():
    return edges()


@app.get("/api/knowledge/graph")
def get_graph():
    return {"nodes": nodes(), "edges": edges()}


@app.get("/api/exercises")
def get_exercises():
    return exercises()


@app.get("/api/knowledge/{node_id}")
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
        "exercises": related_exercises
    }


@app.get("/api/progress/me")
def get_progress():
    return progress_store


@app.post("/api/progress/update")
def update_progress(payload: ProgressUpdate):
    progress_store[payload.nodeId] = payload.model_dump()
    return {"ok": True, "progress": progress_store[payload.nodeId]}


@app.get("/api/recommendations/me")
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
        "reason": "基于已掌握节点、前置关系与薄弱标记生成的规则推荐。"
    }


app.include_router(ai_router)
