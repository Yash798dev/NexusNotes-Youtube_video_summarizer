# ingest.py
# Downloads audio (WAV) and video (MP4) streams from a YouTube URL.
#
# Each job gets its own isolated subdirectory under DATA_DIR/downloads/<job_id>/
# so concurrent requests and retries never share or lock the same file.

import os
import shutil
from pathlib import Path
from yt_dlp import YoutubeDL

# Windows-safe base directory — configurable via DATA_DIR env var
BASE = Path(os.getenv("DATA_DIR", "./data"))


def _job_dir(job_id: str) -> Path:
    """Return an isolated directory for this job's downloads."""
    d = BASE / "downloads" / job_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def download_streams(url: str, job_id: str = "default") -> dict:
    """
    Download best-quality audio and video streams for the given YouTube URL.

    Each call uses an isolated subdirectory (job_id) so Windows file-locking
    (WinError 32) can never occur between concurrent or retried jobs.

    Returns paths to the downloaded files and the video title.
    """
    job_dir = _job_dir(job_id)
    keyframes_dir = BASE / "keyframes" / job_id
    keyframes_dir.mkdir(parents=True, exist_ok=True)

    # If a previous failed run left partial files, remove them cleanly
    for leftover in job_dir.glob("audio.*"):
        try:
            leftover.unlink()
        except OSError:
            pass
    for leftover in job_dir.glob("video.*"):
        try:
            leftover.unlink()
        except OSError:
            pass

    audio_outtmpl = str(job_dir / "audio_dl.%(ext)s")   # download to audio_dl.* first
    video_path    = job_dir / "video.mp4"

    # Common yt-dlp options
    common_opts = {
        "quiet": True,
        "no_warnings": False,
        "extractor_args": {
            "youtube": {"skip": ["dash", "hls"]},
        },
    }

    audio_opts = {
        **common_opts,
        "format": "bestaudio/best",
        "outtmpl": audio_outtmpl,
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "nopostoverwrites": False,
        }],
        "keepvideo": False,
    }

    video_opts = {
        **common_opts,
        "format": "bestvideo[height<=720][ext=mp4]/best[ext=mp4]/best",
        "outtmpl": str(video_path),
        "merge_output_format": "mp4",
    }

    print(f"[ingest] Downloading audio stream to {job_dir}/ ...")
    with YoutubeDL(audio_opts) as ydl:
        info  = ydl.extract_info(url, download=True)
        title = info.get("title", "Untitled") if info else "Untitled"

    # Rename audio_dl.wav → audio.wav now that yt-dlp has released the handle
    audio_dl = job_dir / "audio_dl.wav"
    audio_path = job_dir / "audio.wav"
    if audio_dl.exists():
        import time
        for _ in range(5):   # retry up to 5× in case handle not yet released
            try:
                if audio_path.exists():
                    audio_path.unlink()
                audio_dl.rename(audio_path)
                break
            except PermissionError:
                time.sleep(0.5)
    elif not audio_path.exists():
        candidates = list(job_dir.glob("audio_dl.*"))
        if candidates:
            audio_path = candidates[0]

    print(f"[ingest] Downloading video stream ...")
    with YoutubeDL(video_opts) as ydl:
        ydl.download([url])

    print(f"[ingest] Done. Title: {title!r}")
    return {
        "title":        title,
        "video":        str(video_path),
        "audio":        str(audio_path),
        "keyframes_dir": str(keyframes_dir),
    }


if __name__ == "__main__":
    url = input("YouTube URL: ")
    paths = download_streams(url, job_id="test")
    print(paths)