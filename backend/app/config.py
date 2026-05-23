import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
GRAPH_DIR = ROOT / "data" / "knowledge-graph"
EXERCISE_DIR = ROOT / "data" / "exercises"
CONTENT_DIR = ROOT / "data" / "learning-content"
INITIAL_PROGRESS_FILE = CONTENT_DIR / "initial-progress.json"
PROGRESS_FILE = CONTENT_DIR / "progress.json"


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
