import asyncio
import json
import logging
import random
from pathlib import Path

from services.groq_client import generate_questions
from services.images import fetch_image_url
from services.safety import filter_safe

logger = logging.getLogger("kidgk.questions")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "categories.json", encoding="utf-8") as f:
    CATEGORIES = json.load(f)

with open(DATA_DIR / "fallback_questions.json", encoding="utf-8") as f:
    FALLBACK_BANK = json.load(f)

CATEGORY_IDS = {c["id"] for c in CATEGORIES}


def fallback_round(category_id: str, count: int) -> list[dict]:
    pool = FALLBACK_BANK.get(category_id, [])
    picked = random.sample(pool, min(count, len(pool)))
    return picked


async def _attach_images(questions: list[dict]) -> list[dict]:
    urls = await asyncio.gather(
        *(fetch_image_url(q.get("image_keyword")) for q in questions)
    )
    for q, url in zip(questions, urls):
        q["image_url"] = url
    return questions


async def get_round(category_id: str, grade: int, count: int = 5) -> dict:
    if category_id not in CATEGORY_IDS:
        raise ValueError(f"Unknown category: {category_id}")

    category_name = next(c["name"] for c in CATEGORIES if c["id"] == category_id)

    try:
        raw = await generate_questions(category_name, grade, count)
        questions = filter_safe(raw)
        if len(questions) < count:
            raise RuntimeError(
                f"Only {len(questions)}/{count} Groq questions passed validation/safety checks"
            )
        source = "groq"
    except Exception as exc:
        logger.warning("Falling back to offline bank for %s: %s", category_id, exc)
        questions = fallback_round(category_id, count)
        source = "fallback"

    questions = await _attach_images(questions)
    return {"category": category_id, "source": source, "questions": questions}
