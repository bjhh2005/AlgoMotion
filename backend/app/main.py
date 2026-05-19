import json
from pathlib import Path
import json
import uuid
import subprocess
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import ChatRequest, CodeAnalysisRequest, ProgressUpdate, JudgeRequest


ROOT = Path(__file__).resolve().parents[2]
GRAPH_DIR = ROOT / "data" / "knowledge-graph"
EXERCISE_DIR = ROOT / "data" / "exercises"
CONTENT_DIR = ROOT / "data" / "learning-content"

app = FastAPI(title="AlgoMotion API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def read_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


progress_store: dict[str, dict] = read_json(CONTENT_DIR / "initial-progress.json")


def nodes():
    return read_json(GRAPH_DIR / "nodes.json")


def edges():
    return read_json(GRAPH_DIR / "edges.json")


def contents():
    return read_json(CONTENT_DIR / "knowledge-content.json")


def code_examples():
    return read_json(CONTENT_DIR / "code-examples.json")


def recommendation_seeds():
    return read_json(CONTENT_DIR / "recommendation-seeds.json")


def code_analysis_rules():
    return read_json(CONTENT_DIR / "code-analysis-rules.json")


def exercises():
    return read_json(EXERCISE_DIR / "exercises.json")


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


@app.post("/api/ai/chat")
def chat(payload: ChatRequest):
    focus = f" 当前聚焦知识点：{payload.nodeId}。" if payload.nodeId else ""
    return {
        "answer": f"这是 AI 问答接口占位回复。{focus}后续可接入大模型与自建问答库。你的问题是：{payload.message}",
        "linkedNodes": [payload.nodeId] if payload.nodeId else []
    }


@app.post("/api/ai/code-analysis")
def analyze_code(payload: CodeAnalysisRequest):
    code = payload.code.lower()
    linked = []
    suggestions = []

    for rule in code_analysis_rules():
        if all(keyword.lower() in code for keyword in rule["keywords"]):
            linked.extend(rule["linkedNodes"])
            suggestions.append(rule["suggestion"])

    if not linked:
        linked = ["linear-list"]
        suggestions = ["暂未识别到明确算法标签，可补充题目描述提升分析准确度。"]

    return {
        "summary": "代码分析占位结果：当前版本使用规则识别，后续可替换为大模型分析。",
        "linkedNodes": list(dict.fromkeys(linked)),
        "suggestions": suggestions
    }



CONTAINER_NAME = "global-judger"

@app.post("/api/judge")
def run_judge(req: JudgeRequest):
    run_id = str(uuid.uuid4())
    work_dir = f"/workspace/work/{run_id}"

    try:
        subprocess.run(["docker", "exec", CONTAINER_NAME, "mkdir", "-p", work_dir], check=True)

        subprocess.run(
            ["docker", "exec", "-i", CONTAINER_NAME, "bash", "-c", f"cat > {work_dir}/solution.cpp"],
            input=req.code, text=True, encoding='utf-8', check=True
        )

        result = subprocess.run(
            ["docker", "exec", CONTAINER_NAME, "bash", "/workspace/judger/judge.sh", 
             run_id, req.problem_id, str(req.time_limit), str(req.mem_limit)],
            capture_output=True, text=True, encoding='utf-8'
        )

        try:
            output_json = json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            return {
                "status": "System Error",
                "total_cases": 0,
                "passed_cases": 0,
                "details": [],
                "error_log": result.stderr
            }

        if output_json["status"] == "Compile Error":
            log_res = subprocess.run(
                ["docker", "exec", CONTAINER_NAME, "cat", f"{work_dir}/compile.log"],
                capture_output=True, text=True
            )
            output_json["compile_log"] = log_res.stdout

        return output_json

    except Exception as e:
        return {
            "status": "Server Error",
            "total_cases": 0,
            "passed_cases": 0,
            "details": [],
            "error_log": str(e)
        }

    finally:
        subprocess.run(["docker", "exec", CONTAINER_NAME, "rm", "-rf", work_dir])

def load_data():
    with open(EXERCISE_DIR / "exercises.json", "r", encoding="utf-8") as f:
        return json.load(f)

@app.get("/data/{id}")
async def get_data(id: str):
    data_list = load_data()
    
    for item in data_list:
        if item.get("id") == id:
            return item
            
    return {
        "id": "Error",
        "details": "文件不存在"
    }