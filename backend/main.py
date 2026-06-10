# main.py  —  FastAPI server with SSE progress, checkpoints, and retry

import asyncio
import concurrent.futures
import json
import os
import traceback
from collections import deque
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

import checkpoint
import db
from audio_pipeline import run_audio_pipeline
from fusion_engine import fuse
from ingest import download_streams
from quiz_engine import generate_quiz
from vision_pipeline import run_vision_pipeline

# ── App Setup ──────────────────────────────────────────────────────────────────
app = FastAPI(title="NexusNotes API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))

# Thread pool: heavy sync work runs here, freeing the event loop for SSE
_executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)

# In-memory per-job log buffer  {video_id: deque(maxlen=60)}
_logs: dict[str, deque] = {}


@app.on_event("startup")
def startup():
    db.init_db()
    DATA_DIR.mkdir(parents=True, exist_ok=True)


# ── Helpers ────────────────────────────────────────────────────────────────────

STEP_NAMES = [
    "Initializing",           # 0
    "Downloading Streams",    # 1
    "Extracting Keyframes",   # 2
    "Transcribing Audio",     # 3
    "Fusing Context",         # 4
    "Generating Quiz",        # 5
    "Saving Results",         # 6
    "Complete",               # 7
]


def _log(video_id: str, msg: str):
    if video_id not in _logs:
        _logs[video_id] = deque(maxlen=60)
    _logs[video_id].appendleft(msg)
    print(msg)


def _progress(video_id: str, step: int, message: str, pct: float = 0.0, stats: dict | None = None):
    db.update_progress(video_id, step, message, pct, stats)
    _log(video_id, f"[Step {step}] {message}")


# ── Full Pipeline ──────────────────────────────────────────────────────────────

def _run_full_pipeline(video_id: str, url: str, resume: bool = False):
    """
    Runs the 6-step NexusNotes pipeline.
    Checkpoints each step so a failed job can resume with resume=True.
    """
    try:
        _log(video_id, f"{'='*55}")
        _log(video_id, f"Pipeline started  id={video_id}  resume={resume}")
        _log(video_id, f"{'='*55}")

        stats: dict = {}

        # ── Step 1: Download ───────────────────────────────────────────────────
        if checkpoint.has(video_id, "ingest"):
            paths = checkpoint.load(video_id, "ingest")
            _log(video_id, "✓ Skipping download (checkpoint found)")
        else:
            _progress(video_id, 1, "Downloading audio & video streams…", 0)
            paths = download_streams(url, job_id=video_id)
            checkpoint.save(video_id, "ingest", paths)

        db.update_video_status(video_id, "processing", title=paths.get("title", ""))
        stats["title"] = paths.get("title", "")

        # ── Step 2: Vision (keyframes) ─────────────────────────────────────────
        if checkpoint.has(video_id, "keyframes"):
            keyframes = checkpoint.load(video_id, "keyframes")
            _log(video_id, f"✓ Skipping vision ({len(keyframes)} frames in checkpoint)")
        else:
            _progress(video_id, 2, "Extracting keyframes from video…", 0, stats)

            def on_frame(entry, saved_count, frame_id, total):
                pct = round(frame_id / total * 100, 1) if total else 0
                current_stats = {**stats,
                    "frames_analyzed": frame_id,
                    "total_frames": total,
                    "keyframes_saved": saved_count,
                    "latest_frame": entry["image_path"],
                    "latest_timestamp": entry["timestamp_str"],
                }
                db.update_progress(video_id, 2,
                    f"Analyzing frames… {saved_count} unique snapshots captured",
                    pct, current_stats)

            keyframes = run_vision_pipeline(
                paths["video"],
                paths["keyframes_dir"],
                on_frame_saved=on_frame,
            )
            checkpoint.save(video_id, "keyframes", keyframes)

        stats["keyframes_saved"] = len(keyframes)
        _progress(video_id, 2, f"✓ {len(keyframes)} keyframes extracted", 100, stats)

        # ── Step 3: Audio (Whisper) ────────────────────────────────────────────
        if checkpoint.has(video_id, "transcript"):
            transcript = checkpoint.load(video_id, "transcript")
            _log(video_id, f"✓ Skipping transcription ({len(transcript)} segments in checkpoint)")
        else:
            _progress(video_id, 3, "Transcribing audio with Whisper…", 0, stats)
            transcript = run_audio_pipeline(paths["audio"])
            checkpoint.save(video_id, "transcript", transcript)

        stats["transcript_segments"] = len(transcript)
        _progress(video_id, 3, f"✓ {len(transcript)} speech segments transcribed", 100, stats)

        # ── Step 4: Fusion + Gemini ────────────────────────────────────────────
        if checkpoint.has(video_id, "fusion"):
            fusion_result = checkpoint.load(video_id, "fusion")
            _log(video_id, "✓ Skipping fusion (checkpoint found)")
        else:
            _progress(video_id, 4, "Fusing transcript + frames → Gemini AI notes…", 0, stats)
            fusion_result = fuse(transcript, keyframes)
            checkpoint.save(video_id, "fusion", fusion_result)

        _progress(video_id, 4, "✓ Cornell notes generated by Gemini", 100, stats)

        # ── Step 5: Quiz ───────────────────────────────────────────────────────
        if checkpoint.has(video_id, "quiz"):
            questions = checkpoint.load(video_id, "quiz")
            _log(video_id, f"✓ Skipping quiz ({len(questions)} questions in checkpoint)")
        else:
            _progress(video_id, 5, "Generating quiz questions…", 0, stats)
            questions = generate_quiz(fusion_result["markdown_notes"])
            checkpoint.save(video_id, "quiz", questions)

        stats["quiz_questions"] = len(questions)
        _progress(video_id, 5, f"✓ {len(questions)} quiz questions generated", 100, stats)

        # ── Step 6: Save to DB ─────────────────────────────────────────────────
        _progress(video_id, 6, "Saving results to database…", 50, stats)

        # Avoid duplicate notes rows on retry
        existing_notes = db.get_notes(video_id)
        if not existing_notes:
            db.save_notes(
                video_id=video_id,
                markdown_content=fusion_result["markdown_notes"],
                fused_timeline_json=fusion_result["fused_timeline_json"],
                fused_script=fusion_result["fused_script"],
            )
        existing_quiz = db.get_quiz(video_id)
        if not existing_quiz:
            db.save_quiz(video_id=video_id, questions=questions)

        db.update_video_status(video_id, "completed")
        _progress(video_id, 7, "✓ All done! Your notes are ready.", 100, stats)
        _log(video_id, "Pipeline completed successfully ✅")

    except Exception as e:
        _log(video_id, f"❌ Pipeline FAILED at step: {e}")
        traceback.print_exc()
        db.update_video_status(video_id, "failed")


# ── Models ─────────────────────────────────────────────────────────────────────

class ProcessVideoRequest(BaseModel):
    url: str


class ProcessVideoResponse(BaseModel):
    video_id: str
    message: str


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post("/api/process-video", response_model=ProcessVideoResponse)
async def process_video(body: ProcessVideoRequest):
    video_id = db.create_video_record(youtube_url=body.url)
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_full_pipeline, video_id, body.url, False)
    return ProcessVideoResponse(
        video_id=video_id,
        message="Processing started.",
    )


@app.post("/api/retry/{video_id}", response_model=ProcessVideoResponse)
async def retry_video(video_id: str):
    """Resume a failed job from the last successful checkpoint."""
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    if video["status"] == "processing":
        raise HTTPException(status_code=409, detail="Job is still running.")

    db.update_video_status(video_id, "processing")
    loop = asyncio.get_event_loop()
    loop.run_in_executor(_executor, _run_full_pipeline, video_id, video["youtube_url"], True)
    return ProcessVideoResponse(video_id=video_id, message="Resuming from last checkpoint.")


@app.get("/api/status/{video_id}")
async def get_status(video_id: str):
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    return {
        "video_id":     video["id"],
        "title":        video["title"],
        "status":       video["status"],
        "youtube_url":  video["youtube_url"],
        "current_step": video.get("current_step", 0),
        "step_message": video.get("step_message", ""),
        "step_progress":video.get("step_progress", 0),
        "stats":        video.get("stats", {}),
        "created_at":   video["created_at"],
    }


@app.get("/api/progress/{video_id}")
async def progress_stream(video_id: str):
    """Server-Sent Events stream for real-time pipeline progress."""
    async def generator():
        last_payload = None
        idle_ticks = 0
        while True:
            video = db.get_video(video_id)
            if not video:
                yield f"data: {json.dumps({'error': 'not found'})}\n\n"
                break

            logs = list(_logs.get(video_id, []))
            payload = json.dumps({
                "status":        video["status"],
                "current_step":  video.get("current_step", 0),
                "step_name":     STEP_NAMES[min(video.get("current_step", 0), len(STEP_NAMES)-1)],
                "step_message":  video.get("step_message", ""),
                "step_progress": float(video.get("step_progress", 0) or 0),
                "stats":         video.get("stats", {}),
                "logs":          logs[:15],
            })

            if payload != last_payload:
                yield f"data: {payload}\n\n"
                last_payload = payload
                idle_ticks = 0
            else:
                idle_ticks += 1
                # Send a heartbeat every 10s so the connection stays alive
                if idle_ticks % 10 == 0:
                    yield ": heartbeat\n\n"

            if video["status"] in ("completed", "failed"):
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/notes/{video_id}")
async def get_notes(video_id: str):
    notes = db.get_notes(video_id)
    if not notes:
        raise HTTPException(status_code=404, detail="Notes not found.")
    return {
        "video_id":            video_id,
        "markdown_content":    notes["markdown_content"],
        "fused_timeline_json": notes["fused_timeline_json"],
    }


@app.get("/api/quiz/{video_id}")
async def get_quiz(video_id: str):
    quiz = db.get_quiz(video_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    return {"video_id": video_id, "questions": quiz["questions_json"]}


@app.get("/api/keyframe")
async def serve_keyframe(path: str):
    img_path = Path(path)
    if not img_path.exists() or img_path.suffix.lower() not in (".png", ".jpg"):
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(str(img_path), media_type="image/png")


@app.get("/api/video/{video_id}")
async def serve_video(video_id: str):
    video_path = DATA_DIR / "downloads" / video_id / "video.mp4"
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video not found.")
    return FileResponse(str(video_path), media_type="video/mp4")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "NexusNotes API"}
