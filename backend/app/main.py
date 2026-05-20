import json
import os
import re
import tempfile
import threading
from pathlib import Path
import subprocess
from typing import Any
import urllib.error
import urllib.request
import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import ChatRequest, CodeAnalysisRequest, ProgressUpdate, JudgeRequest, Select_CompleteRequest


ROOT = Path(__file__).resolve().parents[2]
GRAPH_DIR = ROOT / "data" / "knowledge-graph"
EXERCISE_DIR = ROOT / "data" / "exercises"
CONTENT_DIR = ROOT / "data" / "learning-content"
INITIAL_PROGRESS_FILE = CONTENT_DIR / "initial-progress.json"
PROGRESS_FILE = CONTENT_DIR / "progress.json"

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
                os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_local_env()


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json_atomic(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=path.parent,
        delete=False,
        suffix=".tmp",
    ) as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temp_path = Path(file.name)

    temp_path.replace(path)


def load_progress_store() -> dict[str, dict]:
    path = PROGRESS_FILE if PROGRESS_FILE.exists() else INITIAL_PROGRESS_FILE
    return read_json(path)


progress_store_lock = threading.RLock()
progress_store: dict[str, dict] = load_progress_store()


def save_progress_store() -> None:
    with progress_store_lock:
        write_json_atomic(PROGRESS_FILE, progress_store)


def set_progress_record(node_id: str, record: dict) -> dict:
    with progress_store_lock:
        progress_store[node_id] = record
        write_json_atomic(PROGRESS_FILE, progress_store)
        return progress_store[node_id]


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


def content_by_node_id() -> dict[str, dict]:
    return {item["nodeId"]: item for item in contents()}


def node_by_id() -> dict[str, dict]:
    return {item["id"]: item for item in nodes()}


def trim_text(value: str, limit: int = 900) -> str:
    text = value.strip()
    if len(text) <= limit:
        return text
    return text[:limit].rstrip() + "..."


def unique_node_ids(node_ids: list[str], known_nodes: dict[str, dict]) -> list[str]:
    result = []
    for node_id in node_ids:
        if node_id in known_nodes and node_id not in result:
            result.append(node_id)
    return result


def find_relevant_node_ids(message: str, node_id: str | None = None, limit: int = 6) -> list[str]:
    known_nodes = node_by_id()
    normalized = message.lower()
    scored: dict[str, int] = {}

    if node_id and node_id in known_nodes:
        scored[node_id] = 100

    for item in known_nodes.values():
        terms = [item["id"], item["name"], item["category"], *item.get("tags", [])]
        score = 0
        for term in terms:
            value = str(term).strip().lower()
            if value and value in normalized:
                score += 5 if value in {item["id"].lower(), item["name"].lower()} else 2
        if score:
            scored[item["id"]] = scored.get(item["id"], 0) + score

    ranked = [node for node, _ in sorted(scored.items(), key=lambda item: item[1], reverse=True)]

    if node_id and node_id in known_nodes:
        for edge in edges():
            if edge["source"] == node_id:
                ranked.append(edge["target"])
            elif edge["target"] == node_id:
                ranked.append(edge["source"])

    if not ranked:
        ranked = ["data-structure", "algorithm-complexity", "linear-list"]

    return unique_node_ids(ranked, known_nodes)[:limit]


def build_knowledge_context(node_ids: list[str]) -> str:
    known_nodes = node_by_id()
    known_contents = content_by_node_id()
    graph_edges = edges()
    examples_by_node: dict[str, list[dict]] = {}
    for example in code_examples():
        examples_by_node.setdefault(example["nodeId"], []).append(example)

    sections = []
    for node_id in node_ids:
        node = known_nodes.get(node_id)
        if not node:
            continue

        content = known_contents.get(node_id)
        related = []
        for edge in graph_edges:
            if edge["source"] == node_id:
                target = known_nodes.get(edge["target"])
                if target:
                    related.append(f"{edge['label']} -> {target['name']}")
            elif edge["target"] == node_id:
                source = known_nodes.get(edge["source"])
                if source:
                    related.append(f"{source['name']} -> {edge['label']}")

        lines = [
            f"【{node['name']} / {node['id']}】",
            f"简介：{node['description']}",
            f"难度：{node['difficulty']}；标签：{', '.join(node.get('tags', [])) or '无'}"
        ]

        if content:
            lines.extend([
                f"定义：{content['definition']}",
                f"性质：{'；'.join(content.get('properties', [])[:4])}",
                f"操作步骤：{'；'.join(content.get('operationSteps', [])[:4])}",
                f"复杂度：{content['complexity'].get('time', '')} {content['complexity'].get('space', '')}",
                f"常见错误：{'；'.join(content.get('commonMistakes', [])[:4])}"
            ])

        if related:
            lines.append(f"关联知识：{'；'.join(related[:6])}")

        examples = examples_by_node.get(node_id, [])
        if examples:
            example = examples[0]
            lines.append(
                f"C++ 示例（{example['title']}）：{trim_text(example['code'], 420)}"
            )

        sections.append("\n".join(lines))

    return "\n\n".join(sections)


def read_float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError as error:
        raise RuntimeError(f"{name} 必须是数字。") from error


def read_int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as error:
        raise RuntimeError(f"{name} 必须是整数。") from error


def ai_settings() -> dict[str, Any] | None:
    api_key = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
    model = os.getenv("AI_MODEL") or os.getenv("OPENAI_MODEL")
    if not api_key or not model:
        return None

    endpoint = os.getenv("AI_CHAT_COMPLETIONS_URL") or os.getenv("OPENAI_CHAT_COMPLETIONS_URL")
    if not endpoint:
        base_url = os.getenv("AI_BASE_URL") or os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1"
        endpoint = f"{base_url.rstrip('/')}/chat/completions"

    return {
        "api_key": api_key,
        "model": model,
        "endpoint": endpoint,
        "temperature": read_float_env("AI_TEMPERATURE", 0.2),
        "max_tokens": read_int_env("AI_MAX_TOKENS", 900),
        "timeout": read_float_env("AI_TIMEOUT_SECONDS", 30)
    }


def extract_answer(data: dict[str, Any]) -> str:
    if isinstance(data.get("output_text"), str):
        return data["output_text"].strip()

    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0]
        message = choice.get("message", {}) if isinstance(choice, dict) else {}
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    parts.append(str(part.get("text") or part.get("content") or ""))
                else:
                    parts.append(str(part))
            return "".join(parts).strip()
        if isinstance(choice.get("text"), str):
            return choice["text"].strip()

    raise RuntimeError("AI API 返回格式无法解析。")


def call_ai(messages: list[dict[str, str]]) -> str:
    settings = ai_settings()
    if not settings:
        raise RuntimeError("未配置 AI_API_KEY/OPENAI_API_KEY 或 AI_MODEL/OPENAI_MODEL。")

    payload = {
        "model": settings["model"],
        "messages": messages,
        "temperature": settings["temperature"],
        "max_tokens": settings["max_tokens"]
    }
    request = urllib.request.Request(
        settings["endpoint"],
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings['api_key']}",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(request, timeout=settings["timeout"]) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"AI API 请求失败：HTTP {error.code} {trim_text(detail, 240)}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"AI API 网络连接失败：{error.reason}") from error

    return extract_answer(data)


def local_chat_answer(message: str, linked_nodes: list[str], reason: str) -> str:
    known_nodes = node_by_id()
    known_contents = content_by_node_id()
    primary = known_nodes.get(linked_nodes[0]) if linked_nodes else None
    content = known_contents.get(primary["id"]) if primary else None

    prefix = (
        f"当前未调用大模型接口（{reason}），下面先基于本地知识库回答。\n\n"
    )
    if not primary:
        return prefix + f"你的问题是：{message}\n建议先选择一个具体知识点，再配置 API 获取更完整回答。"

    parts = [
        prefix + f"围绕「{primary['name']}」来看：{content['definition'] if content else primary['description']}"
    ]
    if content:
        if content.get("properties"):
            parts.append("关键性质：" + "；".join(content["properties"][:3]) + "。")
        if content.get("operationSteps"):
            parts.append("学习时可按这个顺序理解：" + "；".join(content["operationSteps"][:3]) + "。")
        if content.get("complexity"):
            parts.append(
                "复杂度：" +
                content["complexity"].get("time", "") +
                " " +
                content["complexity"].get("space", "")
            )
        if content.get("commonMistakes"):
            parts.append("常见错误：" + "；".join(content["commonMistakes"][:3]) + "。")

    parts.append("配置 API 后，系统会把这些课程上下文交给模型生成更自然的问答解释。")
    return "\n".join(parts)


def parse_json_from_text(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.S)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None


def match_code_rules(code: str, problem: str | None = None) -> tuple[list[str], list[str]]:
    haystack = f"{code}\n{problem or ''}".lower()
    matched_rules = []
    for rule in code_analysis_rules():
        keywords = [keyword.lower() for keyword in rule["keywords"]]
        hit_count = sum(1 for keyword in keywords if keyword in haystack)
        if hit_count >= len(keywords) or hit_count >= 2:
            matched_rules.append((hit_count, rule))

    matched_rules.sort(key=lambda item: item[0], reverse=True)

    linked = []
    suggestions = []
    for _, rule in matched_rules:
        linked.extend(rule["linkedNodes"])
        suggestions.append(rule["suggestion"])

    return list(dict.fromkeys(linked)), list(dict.fromkeys(suggestions))


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
    record = set_progress_record(payload.nodeId, payload.model_dump())
    return {"ok": True, "progress": record}


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
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    linked_nodes = find_relevant_node_ids(message, payload.nodeId)
    context = build_knowledge_context(linked_nodes)
    system_prompt = (
        "你是 AlgoMotion 数据结构课程平台的 AI 助教。"
        "请基于给定课程知识上下文回答学生问题。"
        "回答要使用中文，准确、分点清晰，优先解释概念、适用场景、复杂度和常见错误。"
        "如果上下文不足，可以说明推断依据，但不要编造课程数据。"
    )
    user_prompt = (
        f"课程知识上下文：\n{context}\n\n"
        f"学生问题：{message}\n\n"
        "请给出可以直接展示在学习平台中的回答。"
    )

    try:
        answer = call_ai([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])
    except RuntimeError as error:
        answer = local_chat_answer(message, linked_nodes, str(error))

    return {
        "answer": answer,
        "linkedNodes": linked_nodes
    }


@app.post("/api/ai/code-analysis")
def analyze_code(payload: CodeAnalysisRequest):
    linked, suggestions = match_code_rules(payload.code, payload.problem)

    if not linked:
        linked = ["linear-list"]
        suggestions = ["暂未识别到明确算法标签，可补充题目描述提升分析准确度。"]

    linked = list(dict.fromkeys(linked))
    local_summary = "代码分析结果：已根据代码关键词和课程知识图谱识别潜在知识点。"

    try:
        settings = ai_settings()
    except RuntimeError as error:
        settings = None
        local_summary = f"{local_summary}（AI 配置无效：{error}）"

    if settings:
        context = build_knowledge_context(linked)
        system_prompt = (
            "你是 AlgoMotion 数据结构课程平台的 C++ 代码分析助教。"
            "请只分析代码和题目中的数据结构/算法问题，避免泛泛而谈。"
            "必须返回 JSON，字段为 summary、suggestions、linkedNodes。"
            "linkedNodes 只能从已给出的候选 nodeId 中选择。"
        )
        user_prompt = (
            f"题目描述：{payload.problem or '未提供'}\n\n"
            f"候选知识点：{', '.join(linked)}\n\n"
            f"课程知识上下文：\n{context}\n\n"
            f"C++ 代码：\n{payload.code}\n\n"
            "请输出 JSON，例如："
            '{"summary":"...","suggestions":["..."],"linkedNodes":["stack"]}'
        )
        try:
            ai_text = call_ai([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            parsed = parse_json_from_text(ai_text)
            if parsed:
                summary = str(parsed.get("summary") or local_summary)
                ai_suggestions = parsed.get("suggestions")
                ai_linked = parsed.get("linkedNodes")
                if isinstance(ai_suggestions, list):
                    suggestions = [str(item) for item in ai_suggestions if str(item).strip()] or suggestions
                if isinstance(ai_linked, list):
                    known_nodes = node_by_id()
                    linked = unique_node_ids([str(item) for item in ai_linked] + linked, known_nodes) or linked
            else:
                summary = ai_text
        except RuntimeError:
            summary = local_summary
    else:
        summary = local_summary

    return {
        "summary": summary,
        "linkedNodes": linked,
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


@app.get("/api/get_problem_data/{id}")
async def get_problem(id: str):
    data_list = load_data()

    result = next((item for item in data_list if item["id"] == id), None)

    if result is None:
        return {
            "id": "Error",
            "details": "文件不存在"
        }

    if result["type"] == "programming":
        path = Path(result["path"])
        if path.exists() and path.is_file():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    md_content = f.read()

                full_data = result.copy()
                full_data["content"] = md_content

                return full_data

            except Exception as e:
                return {
                    "id": "Error",
                    "details": "题面不存在"
                }
        else:
            return {
                "id": "Error",
                "details": "路径错误"
            }
    else:
        return result


@app.post("/api/check_S&C_ans/{id}")
def check(req: Select_CompleteRequest):
    data_list = load_data()

    result = next((item for item in data_list if item["id"] == req.problem_id), None)

    if result is None:
        return {
            "id": "Error",
            "details": "文件不存在"
        }

    if result["type"] == "programming":
        return {
            "id": "Error",
            "details": "题目并非是选填"
        }
    else:
        return {
            "status": result["answer"] == req.answer
        }


from .routes.analytics import router as analytics_router
from .routes.progress import router as progress_router
from .routes.recommendations import router as recommendations_router

app.include_router(analytics_router)
app.include_router(progress_router)
app.include_router(recommendations_router)
