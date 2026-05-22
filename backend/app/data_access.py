import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GRAPH_DIR = ROOT / "data" / "knowledge-graph"
EXERCISE_DIR = ROOT / "data" / "exercises"
CONTENT_DIR = ROOT / "data" / "learning-content"


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


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
