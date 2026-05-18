import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
GRAPH_DIR = ROOT / "data" / "knowledge-graph"
EXERCISE_DIR = ROOT / "data" / "exercises"
CONTENT_DIR = ROOT / "data" / "learning-content"


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def main() -> None:
    nodes = read_json(GRAPH_DIR / "nodes.json")
    edges = read_json(GRAPH_DIR / "edges.json")
    exercises = read_json(EXERCISE_DIR / "exercises.json")
    contents = read_json(CONTENT_DIR / "knowledge-content.json")
    code_examples = read_json(CONTENT_DIR / "code-examples.json")
    initial_progress = read_json(CONTENT_DIR / "initial-progress.json")
    analysis_rules = read_json(CONTENT_DIR / "code-analysis-rules.json")
    recommendation_seeds = read_json(CONTENT_DIR / "recommendation-seeds.json")

    node_ids = {node["id"] for node in nodes}
    errors: list[str] = []

    for edge in edges:
        if edge["source"] not in node_ids:
            errors.append(f"edge source not found: {edge['source']}")
        if edge["target"] not in node_ids:
            errors.append(f"edge target not found: {edge['target']}")

    for exercise in exercises:
        if exercise["nodeId"] not in node_ids:
            errors.append(f"exercise nodeId not found: {exercise['id']} -> {exercise['nodeId']}")

    for content in contents:
        if content["nodeId"] not in node_ids:
            errors.append(f"content nodeId not found: {content['nodeId']}")

    for example in code_examples:
        if example["nodeId"] not in node_ids:
            errors.append(f"code example nodeId not found: {example['title']} -> {example['nodeId']}")

    for node_id in initial_progress:
        if node_id not in node_ids:
            errors.append(f"initial progress nodeId not found: {node_id}")

    for rule in analysis_rules:
        for node_id in rule["linkedNodes"]:
            if node_id not in node_ids:
                errors.append(f"analysis rule linked node not found: {rule['id']} -> {node_id}")

    for node_id in recommendation_seeds["defaultPath"]:
        if node_id not in node_ids:
            errors.append(f"recommendation seed nodeId not found: {node_id}")

    if errors:
        for error in errors:
            print(f"[error] {error}")
        raise SystemExit(1)

    print(
        "OK: "
        f"{len(nodes)} nodes, "
        f"{len(edges)} edges, "
        f"{len(exercises)} exercises, "
        f"{len(contents)} content records, "
        f"{len(code_examples)} code examples"
    )


if __name__ == "__main__":
    main()
