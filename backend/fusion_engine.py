# fusion_engine.py  —  Step 5: Context Fusion Engine
#
# Uses google-genai (new SDK) which calls the REST API and supports Gemini 2.5 Flash.
# pip install google-genai

import base64
import json
import os
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

# ── Config ────────────────────────────────────────────────────────────────────
GEMINI_MODEL   = "gemini-2.5-flash"      # Free tier: 5 RPM / 250K TPM / 20 RPD
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "")
MAX_IMAGES     = 8

SYSTEM_PROMPT = """You are an expert academic note-taker and educator.
You will receive a synchronized transcript of a lecture or tutorial video,
interleaved with visual snapshots of what was on the board/screen at each moment.

Your task: produce a beautifully organized set of study notes in Markdown.

Format requirements:
1. Start with a bold H1 title summarizing the video topic.
2. Use Cornell Note format:
   - Main Notes section (H2 headings per major topic)
   - Cue Questions section (bullet list of key questions a student should answer)
   - Summary section (3-5 sentence paragraph)
3. Embed timestamps as clickable anchors: [00:04:10](#t=250)
4. Highlight key formulas or definitions in code blocks.
5. If you detect a workflow or process, produce a Mermaid flowchart in a ```mermaid block.
   CRITICAL Mermaid syntax rules — violating these causes parse errors:
   a. NEVER use double-quote characters (") inside node labels.
   b. NEVER use ampersand (&) inside node labels — write "and" instead.
   c. NEVER use < or > inside node labels.
   d. If a label contains spaces or punctuation, wrap it in double quotes: A["My Label"].
   e. Use only simple ASCII in labels. No parentheses inside labels.
   f. Keep every node label short (under 8 words).
   Example of CORRECT syntax:
     graph TD
       A["Start Meditation"] --> B{"Eyes closed?"}
       B -->|Yes| C["Focus on breath"]
       B -->|No| D["Soft gaze and relax"]
6. Keep the tone educational, clear, and concise.
7. Do NOT repeat yourself. De-duplicate information.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sec_to_str(sec: float) -> str:
    sec = int(sec)
    return f"{sec//3600:02}:{(sec%3600)//60:02}:{sec%60:02}"


def _build_fused_script(transcript: list[dict], keyframes: list[dict]) -> tuple[str, list[dict]]:
    events: list[dict] = []
    for seg in transcript:
        events.append({"type": "speech", "time_sec": seg["start"], "time_str": _sec_to_str(seg["start"]),
                       "end_sec": seg["end"], "text": seg["text"]})
    for kf in keyframes:
        events.append({"type": "visual", "time_sec": kf["timestamp_sec"], "time_str": kf["timestamp_str"],
                       "ocr_text": kf.get("ocr_text", ""), "image_path": kf.get("image_path", "")})

    events.sort(key=lambda e: e["time_sec"])

    lines: list[str] = []
    timeline_json: list[dict] = []

    for ev in events:
        if ev["type"] == "speech":
            lines.append(f'[Timestamp: {ev["time_str"]}] Speaker: "{ev["text"]}"')
            timeline_json.append({"type": "speech", "time_sec": ev["time_sec"],
                                  "time_str": ev["time_str"], "text": ev["text"]})
        else:
            lines.append(f'[BOARD VISUAL AT {ev["time_str"]}]: "{ev["ocr_text"]}"')
            timeline_json.append({"type": "visual", "time_sec": ev["time_sec"],
                                  "time_str": ev["time_str"], "ocr_text": ev["ocr_text"],
                                  "image_path": ev["image_path"]})

    return "\n".join(lines), timeline_json


# ── Public API ────────────────────────────────────────────────────────────────

def fuse(transcript: list[dict], keyframes: list[dict], api_key: Optional[str] = None) -> dict:
    """
    Fuse transcript + keyframes and call Gemini to generate Cornell notes.

    Returns
    -------
    {
        "markdown_notes":      str,
        "fused_timeline_json": list[dict],
        "fused_script":        str,
    }
    """
    key = api_key or GEMINI_API_KEY
    if not key:
        raise ValueError("GOOGLE_API_KEY not set. Get one at https://aistudio.google.com/apikey")

    print("[fusion] Building fused script…")
    fused_script, timeline_json = _build_fused_script(transcript, keyframes)

    # Select N evenly-spaced keyframe images
    image_paths = [kf["image_path"] for kf in keyframes if kf.get("image_path")]
    step = max(1, len(image_paths) // MAX_IMAGES)
    selected_images = image_paths[::step][:MAX_IMAGES]

    print(f"[fusion] Calling Gemini ({GEMINI_MODEL}) with {len(fused_script)} chars + {len(selected_images)} images…")

    client = genai.Client(api_key=key)

    # Build content parts list: text first, then images
    contents: list = [fused_script]
    for img_path in selected_images:
        try:
            img_bytes = Path(img_path).read_bytes()
            contents.append(types.Part.from_bytes(data=img_bytes, mime_type="image/png"))
        except Exception as e:
            print(f"[fusion] Warning: could not load image {img_path}: {e}")

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
        ),
    )

    markdown_notes = response.text
    print(f"[fusion] Notes generated ({len(markdown_notes)} chars).")

    return {
        "markdown_notes":      markdown_notes,
        "fused_timeline_json": timeline_json,
        "fused_script":        fused_script,
    }


# ── CLI ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    t = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else []
    k = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else []
    r = fuse(t, k)
    print(r["markdown_notes"])
