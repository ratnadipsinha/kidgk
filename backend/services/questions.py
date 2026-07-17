import asyncio
import json
import logging
import random
from pathlib import Path

from services.cache import TTLPool
from services.groq_client import generate_questions
from services.images import fetch_image_url
from services.safety import filter_safe
from services.wikipedia_fallback import generate_from_wikipedia

logger = logging.getLogger("kidgk.questions")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

with open(DATA_DIR / "categories.json", encoding="utf-8") as f:
    CATEGORIES = json.load(f)

with open(DATA_DIR / "fallback_questions.json", encoding="utf-8") as f:
    FALLBACK_BANK = json.load(f)

with open(DATA_DIR / "fallback_questions_expanded.json", encoding="utf-8") as f:
    FALLBACK_BANK_EXPANDED = json.load(f)


def _offline_pool(category_id: str) -> list[dict]:
    expanded = FALLBACK_BANK_EXPANDED.get(category_id) or []
    return expanded if expanded else FALLBACK_BANK.get(category_id, [])

CATEGORY_IDS = {c["id"] for c in CATEGORIES}

# Generated question sets are cached per category+grade and reused across
# sessions/rounds — cuts Groq calls roughly in line with proposal §5's
# ~80% reduction target while staying well within free-tier rate limits.
POOL_SIZE = 20
CACHE_TTL_SECONDS = 6 * 60 * 60  # 6 hours

_pool_cache: TTLPool[list[dict]] = TTLPool(CACHE_TTL_SECONDS)


def fallback_round(category_id: str, count: int) -> list[dict]:
    pool = _offline_pool(category_id)
    picked = random.sample(pool, min(count, len(pool)))
    return picked


async def _attach_images(questions: list[dict]) -> list[dict]:
    urls = await asyncio.gather(
        *(fetch_image_url(q.get("image_keyword")) for q in questions)
    )
    for q, url in zip(questions, urls):
        q["image_url"] = url
    return questions


async def _get_pool(category_id: str, category_name: str, grade: int) -> tuple[list[dict], str]:
    """Returns a cached (or freshly generated) pool of questions plus its source.
    Three tiers, in order: Groq (fresh, cached) -> Wikipedia-derived facts
    (cached, so a Groq outage/rate-limit doesn't re-hit Wikipedia every
    request) -> static offline bank (never cached, always retries the live
    tiers next time)."""
    key = f"{category_id}:{grade}"
    cached = _pool_cache.get(key)
    if cached is not None:
        return cached, "cache"

    async with _pool_cache.lock_for(key):
        cached = _pool_cache.get(key)  # re-check after acquiring the lock
        if cached is not None:
            return cached, "cache"

        try:
            raw = await generate_questions(category_name, grade, POOL_SIZE)
            filtered = filter_safe(raw)
            if len(filtered) < min(5, POOL_SIZE):
                raise RuntimeError(
                    f"Only {len(filtered)}/{POOL_SIZE} Groq questions passed validation/safety checks"
                )
            _pool_cache.set(key, filtered)
            return filtered, "groq"
        except Exception as exc:
            logger.warning("Groq unavailable for %s (%s) - trying Wikipedia", category_id, exc)

        try:
            wiki = await generate_from_wikipedia(category_id, POOL_SIZE)
            filtered = filter_safe(wiki)
            if len(filtered) < min(5, POOL_SIZE):
                raise RuntimeError(
                    f"Only {len(filtered)}/{POOL_SIZE} Wikipedia questions passed safety checks"
                )
            _pool_cache.set(key, filtered)
            return filtered, "wikipedia"
        except Exception as exc:
            logger.warning("Wikipedia fallback failed for %s (%s) - using offline bank", category_id, exc)
            return _offline_pool(category_id), "fallback"


async def get_round(category_id: str, grade: int, count: int = 5) -> dict:
    if category_id not in CATEGORY_IDS:
        raise ValueError(f"Unknown category: {category_id}")

    category_name = next(c["name"] for c in CATEGORIES if c["id"] == category_id)

    pool, source = await _get_pool(category_id, category_name, grade)
    questions = random.sample(pool, min(count, len(pool)))
    questions = await _attach_images(questions)

    return {"category": category_id, "source": source, "questions": questions}
