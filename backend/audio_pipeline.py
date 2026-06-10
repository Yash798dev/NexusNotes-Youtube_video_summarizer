# audio_pipeline.py  —  Step 4: Audio Transcription Pipeline
#
# Loads OpenAI Whisper (base/small model) and transcribes the audio file
# with word-level timestamps.  Automatically uses CUDA if a GPU is available.
#
# Output structure:
#   [{"start": 251.0, "end": 254.5, "text": "Now, let's look at the equation..."}]

import os
import warnings
from typing import Optional

# Suppress noisy FutureWarning from whisper's internal torch calls
warnings.filterwarnings("ignore", category=FutureWarning)

import torch
import whisper

# ── Config ────────────────────────────────────────────────────────────────────
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")   # base | small | medium | large
MAX_SEGMENT_GAP = 1.5   # seconds of silence that splits two segments


def _merge_words_to_segments(word_segments: list[dict]) -> list[dict]:
    """
    Whisper's word-level output can be very granular.
    This merges nearby words into sentence-like chunks separated
    by gaps > MAX_SEGMENT_GAP seconds or by punctuation boundaries.
    """
    if not word_segments:
        return []

    merged: list[dict] = []
    current_start: float = word_segments[0]["start"]
    current_text:  list[str] = []
    current_end:   float = word_segments[0]["end"]

    for word in word_segments:
        gap = word["start"] - current_end

        # Split on long silence OR sentence-ending punctuation in last word
        ends_sentence = current_text and current_text[-1].rstrip().endswith((".", "?", "!"))
        if gap > MAX_SEGMENT_GAP or ends_sentence:
            if current_text:
                merged.append({
                    "start": round(current_start, 2),
                    "end":   round(current_end, 2),
                    "text":  " ".join(current_text).strip(),
                })
            current_start = word["start"]
            current_text  = []

        current_text.append(word["word"].strip())
        current_end = word["end"]

    # Flush last segment
    if current_text:
        merged.append({
            "start": round(current_start, 2),
            "end":   round(current_end, 2),
            "text":  " ".join(current_text).strip(),
        })

    return merged


def run_audio_pipeline(
    audio_path: str,
    model_name: Optional[str] = None,
) -> list[dict]:
    """
    Transcribe an audio file using OpenAI Whisper with word-level timestamps.

    Parameters
    ----------
    audio_path  : Path to the WAV (or MP3/M4A) audio file.
    model_name  : Whisper model size. Defaults to WHISPER_MODEL env var ('base').
                  Options: tiny | base | small | medium | large

    Returns
    -------
    List of segment dicts:
        [{"start": float, "end": float, "text": str}]
    """
    model_size = model_name or WHISPER_MODEL

    # Auto-detect CUDA
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"[audio] Loading Whisper '{model_size}' model on {device.upper()}…")

    model = whisper.load_model(model_size, device=device)

    print(f"[audio] Transcribing '{audio_path}'…")
    result = model.transcribe(
        audio_path,
        word_timestamps=True,   # enables per-word start/end times
        verbose=False,
    )

    # Flatten all word-level entries from every segment
    all_words: list[dict] = []
    for segment in result.get("segments", []):
        for word_info in segment.get("words", []):
            all_words.append({
                "start": word_info["start"],
                "end":   word_info["end"],
                "word":  word_info["word"],
            })

    segments = _merge_words_to_segments(all_words)

    print(f"[audio] Done. {len(segments)} transcript segments produced.")
    return segments


# ── CLI entry-point ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys, json
    audio = sys.argv[1] if len(sys.argv) > 1 else "./data/downloads/audio.wav"
    segs  = run_audio_pipeline(audio)
    print(json.dumps(segs, indent=2))
