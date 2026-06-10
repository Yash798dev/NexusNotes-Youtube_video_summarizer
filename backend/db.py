# db.py  —  SQLite persistence layer (drop-in replacement for Supabase)
#
# Uses Python's built-in sqlite3 module — no extra dependencies needed.
# When you're ready to switch to Supabase, replace these functions with
# equivalent supabase-py calls using the same signatures.

import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

DB_PATH = Path(os.getenv("DATA_DIR", "./data")) / "nexusnotes.db"


# ── Schema ────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    id            TEXT PRIMARY KEY,
    youtube_url   TEXT NOT NULL,
    title         TEXT,
    status        TEXT NOT NULL DEFAULT 'processing',
    current_step  INTEGER DEFAULT 0,
    step_message  TEXT DEFAULT '',
    step_progress REAL DEFAULT 0,
    stats_json    TEXT DEFAULT '{}',
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
    id                  TEXT PRIMARY KEY,
    video_id            TEXT NOT NULL REFERENCES videos(id),
    markdown_content    TEXT,
    fused_timeline_json TEXT,
    fused_script        TEXT,
    created_at          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quizzes (
    id             TEXT PRIMARY KEY,
    video_id       TEXT NOT NULL REFERENCES videos(id),
    questions_json TEXT,
    created_at     TEXT NOT NULL
);
"""


def _conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    return con


def init_db():
    """Create tables + run any missing column migrations."""
    with _conn() as con:
        con.executescript(SCHEMA)
        # Safe migrations: add new columns if upgrading from older schema
        for col, definition in [
            ("current_step",  "INTEGER DEFAULT 0"),
            ("step_message",  "TEXT DEFAULT ''"),
            ("step_progress", "REAL DEFAULT 0"),
            ("stats_json",    "TEXT DEFAULT '{}'"),
        ]:
            try:
                con.execute(f"ALTER TABLE videos ADD COLUMN {col} {definition}")
            except Exception:
                pass  # column already exists
    print(f"[db] SQLite database ready at {DB_PATH}")


# ── Videos ────────────────────────────────────────────────────────────────────

def create_video_record(youtube_url: str, title: str = "") -> str:
    """Insert a new video row and return its UUID."""
    vid_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with _conn() as con:
        con.execute(
            "INSERT INTO videos (id, youtube_url, title, status, created_at) VALUES (?,?,?,?,?)",
            (vid_id, youtube_url, title, "processing", now),
        )
    return vid_id


def update_video_status(video_id: str, status: str, title: str = ""):
    with _conn() as con:
        if title:
            con.execute("UPDATE videos SET status=?, title=? WHERE id=?", (status, title, video_id))
        else:
            con.execute("UPDATE videos SET status=? WHERE id=?", (status, video_id))


def update_progress(
    video_id: str,
    step: int,
    message: str,
    progress: float = 0.0,
    stats: dict | None = None,
):
    """Write real-time progress info — read by the SSE endpoint."""
    with _conn() as con:
        con.execute(
            "UPDATE videos SET current_step=?, step_message=?, step_progress=?, stats_json=? WHERE id=?",
            (step, message, progress, json.dumps(stats or {}), video_id),
        )


def get_video(video_id: str) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT * FROM videos WHERE id=?", (video_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["stats"] = json.loads(d.get("stats_json") or "{}")
    return d


# ── Notes ─────────────────────────────────────────────────────────────────────

def save_notes(
    video_id: str,
    markdown_content: str,
    fused_timeline_json: list,
    fused_script: str = "",
) -> str:
    """Insert notes row and return its UUID."""
    note_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with _conn() as con:
        con.execute(
            "INSERT INTO notes (id, video_id, markdown_content, fused_timeline_json, fused_script, created_at) VALUES (?,?,?,?,?,?)",
            (note_id, video_id, markdown_content, json.dumps(fused_timeline_json), fused_script, now),
        )
    return note_id


def get_notes(video_id: str) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT * FROM notes WHERE video_id=?", (video_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["fused_timeline_json"] = json.loads(d["fused_timeline_json"] or "[]")
    return d


# ── Quizzes ───────────────────────────────────────────────────────────────────

def save_quiz(video_id: str, questions: list) -> str:
    """Insert a quiz row and return its UUID."""
    quiz_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    with _conn() as con:
        con.execute(
            "INSERT INTO quizzes (id, video_id, questions_json, created_at) VALUES (?,?,?,?)",
            (quiz_id, video_id, json.dumps(questions), now),
        )
    return quiz_id


def get_quiz(video_id: str) -> dict | None:
    with _conn() as con:
        row = con.execute("SELECT * FROM quizzes WHERE video_id=?", (video_id,)).fetchone()
    if not row:
        return None
    d = dict(row)
    d["questions_json"] = json.loads(d["questions_json"] or "[]")
    return d
