import json
import os
import re
import socket
import urllib.error
import urllib.request
from typing import Any

from fastapi import APIRouter, HTTPException

from .ai_models import ChatRequest, CodeAnalysisRequest, CodeGenerationRequest, StudyArtifactRequest
from .data_access import code_analysis_rules, code_examples, content_by_node_id, edges, exercises, node_by_id


router = APIRouter(prefix="/api/ai", tags=["AI"])

GENERIC_FALLBACK_NODES = ["data-structure", "algorithm-complexity", "linear-list"]
GENERIC_NODE_IDS = {"data-structure"}


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


def relation_summary_for_nodes(node_ids: list[str], limit: int = 10) -> list[dict[str, str]]:
    known_nodes = node_by_id()
    node_set = set(node_ids)
    relations = []
    for edge in edges():
        if edge["source"] in node_set or edge["target"] in node_set:
            source = known_nodes.get(edge["source"])
            target = known_nodes.get(edge["target"])
            if not source or not target:
                continue
            relations.append({
                "subjectId": edge["source"],
                "subjectName": source["name"],
                "predicate": edge["type"],
                "objectId": edge["target"],
                "objectName": target["name"],
                "label": edge["label"],
                "source": "knowledge-graph",
                "evidence": "curated"
            })
    return relations[:limit]


def build_node_cards(node_ids: list[str], source: str = "ai-analysis") -> list[dict[str, Any]]:
    known_nodes = node_by_id()
    known_contents = content_by_node_id()
    cards = []
    for node_id in node_ids:
        node = known_nodes.get(node_id)
        if not node:
            continue
        content = known_contents.get(node_id)
        cards.append({
            "nodeId": node_id,
            "title": node["name"],
            "description": node["description"],
            "category": node["category"],
            "difficulty": node["difficulty"],
            "tags": node.get("tags", []),
            "reason": (content or {}).get("definition", node["description"]),
            "source": source
        })
    return cards


def related_exercises_for_nodes(node_ids: list[str], limit: int = 4) -> list[dict[str, Any]]:
    node_set = set(node_ids)
    result = []
    for exercise in exercises():
        linked = {exercise["nodeId"], *exercise.get("linkedNodeIds", [])}
        if linked & node_set:
            result.append({
                "exerciseId": exercise["id"],
                "nodeId": exercise["nodeId"],
                "title": exercise["title"],
                "type": exercise["type"],
                "difficulty": exercise["difficulty"],
                "reason": "与当前分析出的知识点相关，适合作为下一步练习。"
            })
    return result[:limit]


def build_learning_actions(node_ids: list[str]) -> list[dict[str, str]]:
    actions = []
    if node_ids:
        actions.append({
            "type": "review",
            "label": "查看知识点讲解",
            "nodeId": node_ids[0],
            "description": "从图谱节点进入知识库，复核定义、复杂度和常见错误。"
        })
    if len(node_ids) > 1:
        actions.append({
            "type": "compare",
            "label": "对比关联概念",
            "nodeId": node_ids[1],
            "description": "跳到关联节点，建立前置知识和应用场景之间的联系。"
        })
    actions.append({
        "type": "practice",
        "label": "进入练习闭环",
        "nodeId": node_ids[0] if node_ids else "linear-list",
        "description": "完成推荐练习，再把错误提交给 AI 生成新的知识绑定。"
    })
    return actions


def quiz_for_node(node_id: str) -> list[dict[str, Any]]:
    known_nodes = node_by_id()
    known_contents = content_by_node_id()
    node = known_nodes.get(node_id)
    content = known_contents.get(node_id)
    if not node:
        return []

    definition = (content or {}).get("definition", node["description"])
    mistakes = (content or {}).get("commonMistakes", [])
    properties = (content or {}).get("properties", node.get("tags", []))
    primary_property = properties[0] if properties else node["description"]
    common_mistake = mistakes[0] if mistakes else "忽略边界条件"

    return [
        {
            "id": f"quiz-{node_id}-concept",
            "type": "choice",
            "question": f"关于「{node['name']}」的核心理解，哪一项最准确？",
            "options": [
                definition,
                "只要使用数组就一定属于该结构",
                "它不需要考虑任何复杂度",
                "它只能用于排序问题"
            ],
            "answer": definition,
            "explanation": "题目考查知识点定义，应优先回到知识库中的正式描述。",
            "linkedNodeIds": [node_id]
        },
        {
            "id": f"quiz-{node_id}-mistake",
            "type": "judge",
            "question": f"判断：学习「{node['name']}」时可以忽略边界条件和空结构访问。",
            "options": ["正确", "错误"],
            "answer": "错误",
            "explanation": f"错误。需要特别避免：{common_mistake}",
            "linkedNodeIds": [node_id]
        },
        {
            "id": f"quiz-{node_id}-property",
            "type": "short",
            "question": f"用一句话说明「{node['name']}」的一个关键性质或适用场景。",
            "answer": primary_property,
            "explanation": "可结合性质、操作步骤或复杂度作答。",
            "linkedNodeIds": [node_id]
        }
    ]


def knowledge_cards_for_nodes(node_ids: list[str]) -> list[dict[str, Any]]:
    known_nodes = node_by_id()
    known_contents = content_by_node_id()
    cards = []
    for node_id in node_ids[:4]:
        node = known_nodes.get(node_id)
        content = known_contents.get(node_id)
        if not node:
            continue
        example = next((item for item in code_examples() if item.get("nodeId") == node_id), None)
        cards.append({
            "nodeId": node_id,
            "front": node["name"],
            "back": (content or {}).get("definition", node["description"]),
            "bullets": [
                *((content or {}).get("properties", [])[:2]),
                (content or {}).get("complexity", {}).get("time", "")
            ],
            "mistake": ((content or {}).get("commonMistakes") or [""])[0],
            "cppExample": (example or {}).get("code", "")
        })
    return cards


def fallback_cpp_code(node_ids: list[str], prompt: str) -> str:
    primary = node_ids[0] if node_ids else ""
    if primary == "stack":
        return (
            "#include <iostream>\n"
            "#include <stack>\n"
            "using namespace std;\n\n"
            "bool isValidParentheses(const string& text) {\n"
            "    stack<char> st;\n"
            "    for (char ch : text) {\n"
            "        if (ch == '(' || ch == '[' || ch == '{') st.push(ch);\n"
            "        else if (ch == ')' || ch == ']' || ch == '}') {\n"
            "            if (st.empty()) return false;\n"
            "            char top = st.top();\n"
            "            st.pop();\n"
            "            if ((ch == ')' && top != '(') || (ch == ']' && top != '[') || (ch == '}' && top != '{')) return false;\n"
            "        }\n"
            "    }\n"
            "    return st.empty();\n"
            "}\n"
        )
    if primary == "binary-search":
        return (
            "int binarySearch(const vector<int>& a, int target) {\n"
            "    int left = 0, right = static_cast<int>(a.size()) - 1;\n"
            "    while (left <= right) {\n"
            "        int mid = left + (right - left) / 2;\n"
            "        if (a[mid] == target) return mid;\n"
            "        if (a[mid] < target) left = mid + 1;\n"
            "        else right = mid - 1;\n"
            "    }\n"
            "    return -1;\n"
            "}\n"
        )
    if primary == "shortest-path":
        return (
            "void dijkstra(int source, const vector<vector<pair<int, int>>>& graph, vector<int>& dist) {\n"
            "    const int INF = 1e9;\n"
            "    dist.assign(graph.size(), INF);\n"
            "    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> pq;\n"
            "    dist[source] = 0;\n"
            "    pq.push({0, source});\n"
            "    while (!pq.empty()) {\n"
            "        auto [distance, u] = pq.top();\n"
            "        pq.pop();\n"
            "        if (distance != dist[u]) continue;\n"
            "        for (auto [v, weight] : graph[u]) {\n"
            "            if (dist[v] > dist[u] + weight) {\n"
            "                dist[v] = dist[u] + weight;\n"
            "                pq.push({dist[v], v});\n"
            "            }\n"
            "        }\n"
            "    }\n"
            "}\n"
        )
    return (
        "// 根据需求生成规范 C++ 代码骨架\n"
        f"// 需求：{trim_text(prompt, 160)}\n"
        "#include <bits/stdc++.h>\n"
        "using namespace std;\n\n"
        "int main() {\n"
        "    ios::sync_with_stdio(false);\n"
        "    cin.tie(nullptr);\n"
        "    return 0;\n"
        "}\n"
    )


def node_depth_map() -> dict[str, int]:
    depths = {"data-structure": 0}
    changed = True
    graph_edges = edges()
    while changed:
        changed = False
        for edge in graph_edges:
            if edge.get("type") != "contains":
                continue
            source = edge["source"]
            target = edge["target"]
            if source not in depths:
                continue
            next_depth = depths[source] + 1
            if target not in depths or depths[target] > next_depth:
                depths[target] = next_depth
                changed = True
    return depths


def score_nodes_from_text(text: str) -> dict[str, int]:
    known_nodes = node_by_id()
    normalized = text.lower()
    depths = node_depth_map()
    scored: dict[str, int] = {}

    for item in known_nodes.values():
        score = 0
        primary_terms = [item["id"], item["name"]]
        secondary_terms = [item["category"], *item.get("tags", [])]

        for term in primary_terms:
            value = str(term).strip().lower()
            if value and value in normalized:
                # One-character Chinese node names such as "树" are useful hints,
                # but should not outrank a more explicit hit like "二叉树".
                score += 24 if len(value) == 1 else 80 + len(value) * 4

        for term in secondary_terms:
            value = str(term).strip().lower()
            if value and len(value) > 1 and value in normalized:
                score += 12 + len(value) * 2

        if score:
            score += depths.get(item["id"], 0) * 6 + int(item.get("difficulty", 1))
            if item["id"] in GENERIC_NODE_IDS:
                score -= 36
            scored[item["id"]] = score

    return scored


def ranked_node_ids_from_scores(scored: dict[str, int]) -> list[str]:
    known_nodes = node_by_id()
    depths = node_depth_map()

    def sort_key(item: tuple[str, int]) -> tuple[int, int, int]:
        node_id, score = item
        node = known_nodes.get(node_id, {})
        name_length = len(str(node.get("name", "")))
        depth = depths.get(node_id, 0)
        return score, depth, name_length

    return [node for node, _ in sorted(scored.items(), key=sort_key, reverse=True)]


def append_graph_neighbors(ranked: list[str], seed_ids: list[str]) -> list[str]:
    result = list(ranked)
    for seed_id in seed_ids:
        for edge in edges():
            if edge["source"] == seed_id:
                result.append(edge["target"])
            elif edge["target"] == seed_id:
                result.append(edge["source"])
    return result


def find_relevant_node_ids(
    message: str,
    node_id: str | None = None,
    limit: int = 6,
    include_fallback: bool = True
) -> list[str]:
    known_nodes = node_by_id()
    ranked = ranked_node_ids_from_scores(score_nodes_from_text(message))

    if not ranked and node_id and node_id in known_nodes:
        ranked = [node_id]

    ranked = append_graph_neighbors(ranked, ranked[:3])

    if ranked and node_id and node_id in known_nodes:
        selected_is_generic = node_id in GENERIC_NODE_IDS or known_nodes[node_id].get("category") == "root"
        if not selected_is_generic:
            ranked.append(node_id)

    if not ranked and include_fallback:
        ranked = GENERIC_FALLBACK_NODES

    return unique_node_ids(ranked, known_nodes)[:limit]


def focus_node_ids(node_ids: list[str], limit: int = 3) -> list[str]:
    known_nodes = node_by_id()
    concrete = [
        node_id
        for node_id in node_ids
        if node_id in known_nodes and known_nodes[node_id].get("category") != "root"
    ]
    return (concrete or node_ids)[:limit]


def quiz_for_nodes(node_ids: list[str], max_nodes: int = 2) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for node_id in focus_node_ids(node_ids, max_nodes):
        result.extend(quiz_for_node(node_id))
    return result


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
    deepseek_api_key = os.getenv("DEEPSEEK_API_KEY")
    api_key = deepseek_api_key or os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY")
    model = (
        os.getenv("DEEPSEEK_MODEL")
        or os.getenv("AI_MODEL")
        or os.getenv("OPENAI_MODEL")
        or ("deepseek-v4-pro" if deepseek_api_key else None)
    )
    if not api_key or not model:
        return None

    provider = "deepseek" if deepseek_api_key or model.startswith("deepseek-") else "openai-compatible"
    endpoint = (
        os.getenv("DEEPSEEK_CHAT_COMPLETIONS_URL")
        or os.getenv("AI_CHAT_COMPLETIONS_URL")
        or os.getenv("OPENAI_CHAT_COMPLETIONS_URL")
    )
    if not endpoint:
        base_url = (
            os.getenv("DEEPSEEK_BASE_URL")
            or os.getenv("AI_BASE_URL")
            or os.getenv("OPENAI_BASE_URL")
            or ("https://api.deepseek.com" if provider == "deepseek" else "https://api.openai.com/v1")
        )
        endpoint = f"{base_url.rstrip('/')}/chat/completions"

    return {
        "provider": provider,
        "api_key": api_key,
        "model": model,
        "endpoint": endpoint,
        "temperature": read_float_env("AI_TEMPERATURE", 0.2),
        "max_tokens": read_int_env("AI_MAX_TOKENS", 1800),
        "timeout": read_float_env("AI_TIMEOUT_SECONDS", 90),
        "deepseek_thinking": os.getenv("DEEPSEEK_THINKING", "enabled"),
        "deepseek_reasoning_effort": os.getenv("DEEPSEEK_REASONING_EFFORT", "high")
    }


def extract_ai_result(data: dict[str, Any]) -> tuple[str, str | None]:
    if isinstance(data.get("output_text"), str):
        return data["output_text"].strip(), None

    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        choice = choices[0]
        message = choice.get("message", {}) if isinstance(choice, dict) else {}
        finish_reason = choice.get("finish_reason") if isinstance(choice, dict) else None
        finish_reason = finish_reason if isinstance(finish_reason, str) else None
        content = message.get("content")
        if isinstance(content, str):
            return content.strip(), finish_reason
        if isinstance(content, list):
            parts = []
            for part in content:
                if isinstance(part, dict):
                    parts.append(str(part.get("text") or part.get("content") or ""))
                else:
                    parts.append(str(part))
            return "".join(parts).strip(), finish_reason
        if isinstance(choice.get("text"), str):
            return choice["text"].strip(), finish_reason

    raise RuntimeError("AI API 返回格式无法解析。")


def extract_answer(data: dict[str, Any]) -> str:
    return extract_ai_result(data)[0]


def call_ai(messages: list[dict[str, str]], allow_continuation: bool = True) -> str:
    settings = ai_settings()
    if not settings:
        raise RuntimeError("未配置 AI_API_KEY/OPENAI_API_KEY 或 AI_MODEL/OPENAI_MODEL。")

    payload = {
        "model": settings["model"],
        "messages": messages,
        "temperature": settings["temperature"],
        "max_tokens": settings["max_tokens"]
    }
    if settings["provider"] == "deepseek":
        thinking = settings["deepseek_thinking"].strip().lower()
        if thinking in {"enabled", "disabled"}:
            payload["thinking"] = {"type": thinking}
        reasoning_effort = settings["deepseek_reasoning_effort"].strip()
        if thinking != "disabled" and reasoning_effort:
            payload["reasoning_effort"] = settings["deepseek_reasoning_effort"]

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
    except (TimeoutError, socket.timeout) as error:
        raise RuntimeError(f"AI API 响应超时：{settings['timeout']} 秒内未返回。") from error

    answer, finish_reason = extract_ai_result(data)
    if allow_continuation and finish_reason == "length":
        continuation = call_ai(
            [
                *messages,
                {"role": "assistant", "content": answer},
                {
                    "role": "user",
                    "content": "上一次回答因为长度限制中断了。请从中断处继续，不要重复前文，并用自然完整的结尾收束。"
                }
            ],
            allow_continuation=False
        )
        return f"{answer.rstrip()}\n\n{continuation.lstrip()}"

    return answer


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


@router.post("/chat")
def chat(payload: ChatRequest):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message cannot be empty")

    history_text = "\n".join(
        f"{item.role}: {item.content}" for item in payload.history[-8:]
    )
    current_nodes = find_relevant_node_ids(message, payload.nodeId, include_fallback=False)
    history_nodes = find_relevant_node_ids(history_text, None, limit=4, include_fallback=False) if history_text.strip() else []
    selected_nodes = [payload.nodeId] if payload.nodeId else []
    linked_nodes = unique_node_ids(
        [
            *current_nodes,
            *history_nodes,
            *selected_nodes,
            *GENERIC_FALLBACK_NODES
        ],
        node_by_id()
    )[:6]
    primary_focus_nodes = focus_node_ids(current_nodes or linked_nodes, 3)
    context = build_knowledge_context(linked_nodes)
    system_prompt = (
        "你是 AlgoMotion 数据结构课程平台的 AI 助教。"
        "请基于给定课程知识上下文回答学生问题。"
        "回答要使用中文，准确、分点清晰，优先解释概念、适用场景、复杂度、常见错误和下一步练习。"
        "回答只能使用纯文本或 Markdown，不要输出 HTML 标签、<details>、<summary> 或未闭合的标签。"
        "如果需要展开解析，请直接用小标题和列表表达。"
        "如果上下文不足，可以说明推断依据，但不要编造课程数据。"
    )
    conversation = "\n".join(
        f"{item.role}: {item.content}" for item in payload.history[-6:]
    ) or "暂无历史对话。"
    user_prompt = (
        f"历史对话：\n{conversation}\n\n"
        f"课程知识上下文：\n{context}\n\n"
        f"学生问题：{message}\n\n"
        "请给出可以直接展示在学习平台中的完整回答，并形成“发现问题-讲解-练习-推荐”的学习闭环。"
        "回答末尾必须自然收束，不要停在半句话、半个列表或半个代码块。"
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
        "message": {
            "id": f"assistant-{len(payload.history) + 1}",
            "role": "assistant",
            "content": answer,
            "linkedNodeIds": linked_nodes
        },
        "linkedNodes": linked_nodes,
        "nodeCards": build_node_cards(linked_nodes, "ai-analysis"),
        "graphRelations": relation_summary_for_nodes(linked_nodes),
        "quiz": quiz_for_nodes((primary_focus_nodes or linked_nodes)[:1], max_nodes=1),
        "knowledgeCards": knowledge_cards_for_nodes(primary_focus_nodes or linked_nodes),
        "recommendedExercises": related_exercises_for_nodes(primary_focus_nodes or linked_nodes),
        "learningActions": build_learning_actions(primary_focus_nodes or linked_nodes),
        "loop": {
            "stage": "发现问题-讲解-练习-推荐",
            "problem": message,
            "explainNodeId": (primary_focus_nodes or linked_nodes)[0] if linked_nodes else None,
            "practiceCount": len(related_exercises_for_nodes(primary_focus_nodes or linked_nodes)),
            "recommendation": "先查看跳转卡片中的核心知识点，再完成推荐练习，把错误代码继续交给 AI 分析。"
        }
    }


@router.post("/code-analysis")
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
        "suggestions": suggestions,
        "nodeCards": build_node_cards(linked, "ai-analysis"),
        "graphRelations": relation_summary_for_nodes(linked),
        "recommendedExercises": related_exercises_for_nodes(linked),
        "learningActions": build_learning_actions(linked)
    }


@router.post("/study-artifacts")
def generate_study_artifacts(payload: StudyArtifactRequest):
    source = payload.sourceText.strip()
    if not source:
        raise HTTPException(status_code=400, detail="sourceText cannot be empty")

    linked_nodes = find_relevant_node_ids(source, payload.nodeId, limit=8)
    title = payload.title or "上传内容学习包"
    summary = (
        f"已根据「{title}」识别出 {len(linked_nodes)} 个相关知识点，"
        "并生成 Quiz、知识卡片和图谱跳转卡片。"
    )

    try:
        settings = ai_settings()
    except RuntimeError:
        settings = None

    if settings:
        context = build_knowledge_context(linked_nodes)
        system_prompt = (
            "你是 AlgoMotion 的学习资料整理助手。"
            "请基于上传文本和课程知识上下文，输出简洁中文摘要。"
            "不要输出 quiz JSON，quiz 由平台结构化生成。"
        )
        user_prompt = (
            f"标题：{title}\n\n"
            f"课程知识上下文：\n{context}\n\n"
            f"上传文本：\n{trim_text(source, 2800)}\n\n"
            "请总结该资料与数据结构课程的关系，并指出学生下一步应学哪些知识点。"
        )
        try:
            summary = call_ai([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
        except RuntimeError:
            pass

    quiz = quiz_for_nodes(linked_nodes, max_nodes=3)

    return {
        "title": title,
        "summary": summary,
        "linkedNodes": linked_nodes,
        "nodeCards": build_node_cards(linked_nodes, "ai-analysis"),
        "graphRelations": relation_summary_for_nodes(linked_nodes),
        "quiz": quiz,
        "knowledgeCards": knowledge_cards_for_nodes(linked_nodes),
        "recommendedExercises": related_exercises_for_nodes(linked_nodes),
        "learningActions": build_learning_actions(linked_nodes)
    }


@router.post("/code-generation")
def generate_code(payload: CodeGenerationRequest):
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="prompt cannot be empty")

    history_text = "\n".join(
        f"{item.role}: {item.content}" for item in payload.history[-6:]
    )
    linked_nodes = find_relevant_node_ids(f"{history_text}\n{prompt}", payload.nodeId, limit=6)
    code = fallback_cpp_code(linked_nodes, prompt)
    explanation = "已生成规范 C++ 代码，并关联到知识图谱节点。"

    try:
        settings = ai_settings()
    except RuntimeError:
        settings = None

    if settings:
        context = build_knowledge_context(linked_nodes)
        system_prompt = (
            "你是 AlgoMotion 的 C++ 代码生成助手。"
            "请生成规范、可读、适合数据结构课程教学的 C++17 代码。"
            "必须返回 JSON，字段为 code、explanation、linkedNodes。"
            "linkedNodes 只能从候选知识点中选择。"
        )
        user_prompt = (
            f"需求：{prompt}\n\n"
            f"历史对话：\n{history_text or '暂无'}\n\n"
            f"候选知识点：{', '.join(linked_nodes)}\n\n"
            f"课程知识上下文：\n{context}\n\n"
            "请输出 JSON，例如："
            '{"code":"...","explanation":"...","linkedNodes":["stack"]}'
        )
        try:
            ai_text = call_ai([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ])
            parsed = parse_json_from_text(ai_text)
            if parsed:
                code = str(parsed.get("code") or code)
                explanation = str(parsed.get("explanation") or explanation)
                ai_linked = parsed.get("linkedNodes")
                if isinstance(ai_linked, list):
                    linked_nodes = unique_node_ids([str(item) for item in ai_linked] + linked_nodes, node_by_id())
            else:
                explanation = ai_text
        except RuntimeError:
            pass

    return {
        "code": code,
        "language": "cpp",
        "explanation": explanation,
        "linkedNodes": linked_nodes,
        "nodeCards": build_node_cards(linked_nodes, "ai-analysis"),
        "graphRelations": relation_summary_for_nodes(linked_nodes),
        "recommendedExercises": related_exercises_for_nodes(linked_nodes),
        "learningActions": build_learning_actions(linked_nodes)
    }
