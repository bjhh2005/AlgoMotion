import json
import tempfile
import threading
from pathlib import Path
from typing import Any

from .config import (
    CONTENT_DIR,
    EXERCISE_DIR,
    GRAPH_DIR,
    INITIAL_PROGRESS_FILE,
    PROGRESS_FILE,
)


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
