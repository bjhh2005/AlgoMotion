"""
学习记录存储模块
持久化细粒度练习记录（逐题）和每日学习快照，供学情分析使用
"""
import json
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from .config import CONTENT_DIR


RECORDS_DIR = CONTENT_DIR / "learning-records"
EXERCISE_LOG_FILE = RECORDS_DIR / "exercise-log.json"
DAILY_SNAPSHOT_FILE = RECORDS_DIR / "daily-snapshots.json"

_records_lock = threading.RLock()

exercise_log: list[dict] = []
daily_snapshots: dict[str, dict] = {}


def _ensure_dir():
    RECORDS_DIR.mkdir(parents=True, exist_ok=True)


def _read_json_safe(path: Path, default: Any) -> Any:
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return default


def _write_json_safe(path: Path, data: Any) -> None:
    _ensure_dir()
    import tempfile
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", dir=path.parent, delete=False, suffix=".tmp"
    ) as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
        temp = Path(f.name)
    temp.replace(path)


def load_learning_records() -> None:
    global exercise_log, daily_snapshots
    with _records_lock:
        exercise_log = _read_json_safe(EXERCISE_LOG_FILE, [])
        daily_snapshots = _read_json_safe(DAILY_SNAPSHOT_FILE, {})


def save_exercise_log() -> None:
    with _records_lock:
        _write_json_safe(EXERCISE_LOG_FILE, exercise_log)


def save_daily_snapshots() -> None:
    with _records_lock:
        _write_json_safe(DAILY_SNAPSHOT_FILE, daily_snapshots)


def append_exercise_record(record: dict) -> None:
    with _records_lock:
        exercise_log.append(record)
        save_exercise_log()


def update_daily_snapshot(node_id: str, mastery: float, study_minutes: int, attempt_count: int) -> None:
    today = datetime.now().strftime("%Y-%m-%d")
    with _records_lock:
        if today not in daily_snapshots:
            daily_snapshots[today] = {
                "totalStudyMinutes": 0,
                "totalAttempts": 0,
                "nodeMasteries": {},
            }
        snap = daily_snapshots[today]
        snap["totalStudyMinutes"] += study_minutes
        snap["totalAttempts"] += attempt_count
        snap["nodeMasteries"][node_id] = mastery
        save_daily_snapshots()


def get_exercise_log(node_id: Optional[str] = None, limit: int = 1000) -> list[dict]:
    with _records_lock:
        records = exercise_log
        if node_id:
            records = [r for r in records if r.get("nodeId") == node_id]
        return records[-limit:]


def get_daily_snapshots(days: int = 90) -> dict[str, dict]:
    with _records_lock:
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        return {k: v for k, v in daily_snapshots.items() if k >= cutoff}


def clear_learning_records() -> None:
    global exercise_log, daily_snapshots
    with _records_lock:
        exercise_log = []
        daily_snapshots = {}
        _ensure_dir()
        if EXERCISE_LOG_FILE.exists():
            EXERCISE_LOG_FILE.unlink()
        if DAILY_SNAPSHOT_FILE.exists():
            DAILY_SNAPSHOT_FILE.unlink()


load_learning_records()
