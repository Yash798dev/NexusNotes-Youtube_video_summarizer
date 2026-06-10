# vision_pipeline.py
#
# Ultra-Fast 3-Stage Frame Extractor:
#   Stage 1 — FAST PIXEL DIFF    : Absolute difference on downscaled frames.
#   Stage 2 — PERCEPTUAL HASH    : pHash deduplication (no slow OCR here).
#   Stage 3 — PARALLEL OCR       : Runs Tesseract concurrently ONLY on final saved frames.

import concurrent.futures
import cv2
import hashlib
import os
import pytesseract
import numpy as np
from pathlib import Path
from typing import Optional

# ── Tunables ──────────────────────────────────────────────────────────────────
DIFF_THRESHOLD = 15.0   # Avg pixel difference (0-255) to be considered a "change"
MIN_OCR_CHARS  = 10     # Ignore frames with fewer OCR characters
SAMPLE_FPS     = 1      # Process 1 frame per second


# ── Fast Helpers ──────────────────────────────────────────────────────────────

def _fast_diff(frame_a, frame_b) -> float:
    """Calculates absolute difference on tiny grayscale versions of frames."""
    # Resize to 256x144 for lightning-fast comparison
    small_a = cv2.resize(frame_a, (256, 144), interpolation=cv2.INTER_LINEAR)
    small_b = cv2.resize(frame_b, (256, 144), interpolation=cv2.INTER_LINEAR)
    
    gray_a = cv2.cvtColor(small_a, cv2.COLOR_BGR2GRAY)
    gray_b = cv2.cvtColor(small_b, cv2.COLOR_BGR2GRAY)
    
    # Compute absolute difference and return the mean pixel change
    diff = cv2.absdiff(gray_a, gray_b)
    return np.mean(diff)

def _image_hash(frame) -> str:
    """Extremely fast perceptual difference hash (dHash) for deduplication."""
    small = cv2.resize(frame, (9, 8), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    # Compare adjacent pixels
    diff = gray[:, 1:] > gray[:, :-1]
    return hex(int("".join(["1" if b else "0" for b in diff.flatten()]), 2))[2:]

def _sec_to_time(sec: int) -> str:
    h, m, s = sec // 3600, (sec % 3600) // 60, sec % 60
    return f"{h:02}:{m:02}:{s:02}"

def _run_ocr_task(entry: dict, min_chars: int) -> Optional[dict]:
    """Runs OCR on a single saved image file."""
    img = cv2.imread(entry["image_path"])
    text = pytesseract.image_to_string(img).strip()
    
    if len(text) < min_chars:
        # Delete image if it doesn't have enough text to be useful
        try:
            os.remove(entry["image_path"])
        except OSError:
            pass
        return None
        
    entry["ocr_text"] = text
    return entry


# ── Public API ────────────────────────────────────────────────────────────────

def run_vision_pipeline(
    video_path: str,
    keyframes_dir: str,
    diff_threshold: float = DIFF_THRESHOLD,
    min_ocr_chars: int = MIN_OCR_CHARS,
    on_frame_saved=None,
) -> list[dict]:
    save_dir = Path(keyframes_dir)
    save_dir.mkdir(parents=True, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = max(1, int(cap.get(cv2.CAP_PROP_FPS)))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    last_frame = None
    last_hash = None
    frame_id = 0
    saved = 0
    candidate_entries: list[dict] = []

    print(f"[vision] Extracting frames from '{video_path}' at {fps} fps…")

    while cap.isOpened():
        # FAST SKIP: grab() decodes the header, but not the full image matrix
        ret = cap.grab()
        if not ret:
            break

        if frame_id % fps != 0:
            frame_id += 1
            continue

        # Actually decode the frame ONLY for the 1-per-second we care about
        ret, frame = cap.retrieve()
        if not ret:
            break

        current_sec = frame_id // fps
        frame_id += 1

        # ── Stage 1: FAST PIXEL DIFF ──
        if last_frame is not None:
            change_score = _fast_diff(frame, last_frame)
            if change_score < diff_threshold:
                continue # Too similar, skip

        # ── Stage 2: FAST PERCEPTUAL HASH DEDUPLICATION ──
        current_hash = _image_hash(frame)
        if current_hash == last_hash:
            continue # Layout is identical, skip

        # ── Save Candidate Frame ──
        timestamp_str = _sec_to_time(current_sec)
        filename = save_dir / f"frame_{saved:04d}_{timestamp_str.replace(':', '-')}.png"
        cv2.imwrite(str(filename), frame)

        entry = {
            "timestamp_sec": current_sec,
            "timestamp_str": timestamp_str,
            "ocr_text": "", # Will be filled concurrently later
            "image_path": str(filename),
        }
        candidate_entries.append(entry)

        if on_frame_saved:
            on_frame_saved(entry, saved + 1, frame_id, total_frames)

        last_frame = frame
        last_hash = current_hash
        saved += 1

    cap.release()
    print(f"[vision] Extracted {len(candidate_entries)} candidate frames. Running parallel OCR...")

    # ── Stage 3: PARALLEL OCR ON FINAL FRAMES ──
    # Instead of halting the loop to run Tesseract, we run it concurrently 
    # at the end ONLY on the frames that survived the gating.
    final_results = []
    
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = {executor.submit(_run_ocr_task, e, min_ocr_chars): e for e in candidate_entries}
        
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            if result:
                final_results.append(result)
                print(f"[vision] Finalized {result['image_path'][-20:]} | OCR: {result['ocr_text'][:40]!r}...")

    # Sort results back into chronological order since threads finish randomly
    final_results.sort(key=lambda x: x["timestamp_sec"])
    
    print(f"[vision] Done. Retained {len(final_results)} text-rich keyframes.")
    return final_results

if __name__ == "__main__":
    import sys
    video = sys.argv[1] if len(sys.argv) > 1 else "./data/downloads/video.mp4"
    out   = sys.argv[2] if len(sys.argv) > 2 else "./data/keyframes"
    frames = run_vision_pipeline(video, out)
    for f in frames:
        print(f)