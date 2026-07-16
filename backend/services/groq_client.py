import json
import os

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a quiz question generator for children in grades 4-6 (ages 9-12). "
    "You return only strict JSON, no prose, no markdown fences. "
    "Content must be kid-safe, factually accurate, and age-appropriate."
)


def build_prompt(category: str, grade: int, count: int) -> str:
    return (
        f"Generate {count} multiple-choice general knowledge questions about "
        f"{category.upper()} for a Grade {grade} student. "
        "Return only a JSON array. Each object must have exactly these keys: "
        '"question" (string), "options" (array of exactly 4 strings), '
        '"answer" (integer index 0-3 of the correct option), '
        '"explanation" (string, max 15 words), '
        '"image_keyword" (string or null, a short search term for a matching image). '
        "Distractors should be plausible and similar in length to the correct answer. "
        "No repeated questions. Kid-safe, factually accurate content only."
    )


async def generate_questions(category: str, grade: int, count: int = 5) -> list[dict]:
    """Calls Groq for fresh questions. Raises on any failure so callers can fall back."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not configured")

    model = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(category, grade, count)},
        ],
        "temperature": 0.8,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    # Groq's json_object mode returns an object; unwrap the first array value found.
    questions = parsed if isinstance(parsed, list) else next(
        (v for v in parsed.values() if isinstance(v, list)), []
    )
    return validate_questions(questions)


def validate_questions(questions: list[dict]) -> list[dict]:
    valid = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        options = q.get("options")
        answer = q.get("answer")
        if (
            isinstance(q.get("question"), str)
            and isinstance(options, list)
            and len(options) == 4
            and all(isinstance(o, str) for o in options)
            and isinstance(answer, int)
            and 0 <= answer <= 3
        ):
            valid.append(
                {
                    "question": q["question"],
                    "options": options,
                    "answer": answer,
                    "explanation": q.get("explanation", ""),
                    "image_keyword": q.get("image_keyword"),
                }
            )
    return valid
