# checkpoint.py — Save/load intermediate pipeline results
# Each step's output is persisted as JSON so a failed job can resume.

import json
import os
from pathlib import Path

BASE = Path(os.getenv("DATA_DIR", "./data")) / "checkpoints"

STEPS = {
    "ingest":     0,
    "keyframes":  1,
    "transcript": 2,
    "fusion":     3,
    "quiz":       4,
}


def _dir(video_id: str) -> Path:
    d = BASE / video_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def save(video_id: str, step: str, data: dict | list) -> None:
    path = _dir(video_id) / f"{step}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load(video_id: str, step: str) -> dict | list | None:
    path = _dir(video_id) / f"{step}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return None


def has(video_id: str, step: str) -> bool:
    return (_dir(video_id) / f"{step}.json").exists()


def clear(video_id: str) -> None:
    """Remove all checkpoints for a job (for a clean re-run)."""
    d = BASE / video_id
    if d.exists():
        for f in d.glob("*.json"):
            f.unlink()
