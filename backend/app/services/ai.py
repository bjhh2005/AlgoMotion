import json
import os
import re
from typing import Any
import urllib.error
import urllib.request

from ..storage import code_analysis_rules
from .knowledge import (
    build_knowledge_context,
    content_by_node_id,
    find_relevant_node_ids,
    node_by_id,
    trim_text,
    unique_node_ids,
)


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
        "timeout": read_float_env("AI_TIMEOUT_SECONDS", 30),
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
        "max_tokens": settings["max_tokens"],
    }
    request = urllib.request.Request(
        settings["endpoint"],
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings['api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
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

    prefix = f"当前未调用大模型接口（{reason}），下面先基于本地知识库回答。\n\n"
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
                "复杂度："
                + content["complexity"].get("time", "")
                + " "
                + content["complexity"].get("space", "")
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


def answer_chat(message: str, node_id: str | None) -> dict:
    linked_nodes = find_relevant_node_ids(message, node_id)
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
            {"role": "user", "content": user_prompt},
        ])
    except RuntimeError as error:
        answer = local_chat_answer(message, linked_nodes, str(error))

    return {
        "answer": answer,
        "linkedNodes": linked_nodes,
    }


def analyze_cpp_code(code: str, problem: str | None = None) -> dict:
    linked, suggestions = match_code_rules(code, problem)

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
            f"题目描述：{problem or '未提供'}\n\n"
            f"候选知识点：{', '.join(linked)}\n\n"
            f"课程知识上下文：\n{context}\n\n"
            f"C++ 代码：\n{code}\n\n"
            "请输出 JSON，例如："
            '{"summary":"...","suggestions":["..."],"linkedNodes":["stack"]}'
        )
        try:
            ai_text = call_ai([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
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
    }
