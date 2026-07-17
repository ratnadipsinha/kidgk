import json
import os

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a quiz-writing expert who makes genuinely fun, memorable trivia for "
    "students in grades 4-10 (ages 9-16) - the kind of question a kid would want to "
    "tell a friend about, not a textbook recall drill. Match difficulty and vocabulary "
    "to the specific grade given in each request - grade 4 should be simple and "
    "concrete, grade 10 can include more advanced vocabulary and multi-step reasoning. "
    "You return only strict JSON, no prose, no markdown fences. "
    "Content must be age-appropriate, factually accurate, and safe for a school setting."
)


def build_prompt(category: str, grade: int, count: int) -> str:
    picture_count = max(1, round(count * 0.25))
    return (
        f"Generate {count} multiple-choice general knowledge questions about "
        f"{category.upper()} for a Grade {grade} student. "
        "Return only a JSON array. Each object must have exactly these keys: "
        '"question" (string), "options" (array of exactly 4 strings), '
        '"answer" (integer index 0-3 of the correct option), '
        '"explanation" (string, max 15 words), '
        '"topic" (string, REQUIRED for every question: the single key word or short '
        'phrase the question is fundamentally about, e.g. "cosmonaut", "Saturn", '
        '"photosynthesis" - and it must appear verbatim, or as close to verbatim as '
        'grammar allows, inside the question text itself), '
        '"image_keyword" (string or null, a short search term for a matching image). '
        "Keep every question and option short and crisp - plain, direct wording, "
        "no long or wordy phrasing, options a few words each wherever possible. "
        "Favor specific, surprising, or vivid facts over generic textbook definitions - "
        "a fact worth knowing, not just a label to recall. Vary the question structure "
        "across the set: mix straightforward 'what/who/which' questions with ones about "
        "a cause, a comparison, a record (biggest/first/only), or a fun specific detail - "
        "don't make every single question follow the same template. "
        f"Most questions should be text-only - set image_keyword to null for those. "
        f"Only about {picture_count} of the {count} questions should be picture-based - "
        "only those should have a non-null image_keyword. "
        "CRITICAL rule for picture-based questions: the image is shown to the student "
        "BEFORE they see the answer, so it must never simply depict the correct answer "
        "itself (e.g. do NOT show a picture of China's flag and ask 'which of these is "
        "China's flag?' - that gives the answer away). Only use the picture format when "
        "the image itself IS the unknown the student must identify, e.g. 'What animal is "
        "this?' with a photo of a lion and options naming different animals. image_keyword "
        "must describe the picture's actual subject, not the answer text. "
        "Distractors should be plausible, similar in length to the correct answer, and "
        "genuinely tempting (not obviously wrong) - a student who half-remembers the topic "
        "should have to actually think. No repeated questions or repeated facts across the "
        "set. Kid-safe, factually accurate content only."
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
            topic = q.get("topic")
            valid.append(
                {
                    "question": q["question"],
                    "options": options,
                    "answer": answer,
                    "explanation": q.get("explanation", ""),
                    "image_keyword": q.get("image_keyword"),
                    "topic": topic.strip() if isinstance(topic, str) and topic.strip() else None,
                }
            )
    return valid
