# quiz_engine.py  —  MCQ quiz generator using google-genai (new SDK)
# pip install google-genai

import json
import os
import re
from typing import Optional

from google import genai
from google.genai import types

GEMINI_MODEL   = "gemini-2.5-flash"      # Free tier: 5 RPM / 250K TPM / 20 RPD
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY", "")

QUIZ_PROMPT = """You are an expert educator creating a quiz from lecture notes.

Given the following markdown study notes, generate 8 multiple-choice questions (MCQ).

Rules:
- Each question must test genuine comprehension, not trivial recall.
- Provide exactly 4 options (A, B, C, D).
- Mark the correct answer.
- Return ONLY valid JSON — no prose, no markdown fences.

Output format (strict JSON array):
[
  {
    "question": "What does X represent in the equation?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option B",
    "explanation": "Brief explanation of why this is correct."
  }
]
"""


def generate_quiz(markdown_notes: str, api_key: Optional[str] = None) -> list[dict]:
    """
    Generate MCQ quiz questions from markdown notes via Gemini 2.5 Flash.
    """
    key = api_key or GEMINI_API_KEY
    if not key:
        raise ValueError("GOOGLE_API_KEY not set.")

    client = genai.Client(api_key=key)

    print(f"[quiz] Calling Gemini to generate quiz questions…")
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=markdown_notes,
        config=types.GenerateContentConfig(
            system_instruction=QUIZ_PROMPT,
        ),
    )

    raw = response.text.strip()
    # Strip accidental markdown fences
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        questions = json.loads(raw)
        print(f"[quiz] Generated {len(questions)} questions.")
        return questions
    except json.JSONDecodeError as e:
        print(f"[quiz] Warning: JSON parse failed ({e}). Returning empty list.")
        return []


if __name__ == "__main__":
    import sys
    notes = open(sys.argv[1]).read() if len(sys.argv) > 1 else ""
    print(json.dumps(generate_quiz(notes), indent=2))
