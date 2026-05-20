from ..storage import code_examples, contents, edges, nodes


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
            f"难度：{node['difficulty']}；标签：{', '.join(node.get('tags', [])) or '无'}",
        ]

        if content:
            lines.extend([
                f"定义：{content['definition']}",
                f"性质：{'；'.join(content.get('properties', [])[:4])}",
                f"操作步骤：{'；'.join(content.get('operationSteps', [])[:4])}",
                f"复杂度：{content['complexity'].get('time', '')} {content['complexity'].get('space', '')}",
                f"常见错误：{'；'.join(content.get('commonMistakes', [])[:4])}",
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
