"""Builds a large offline fallback question bank from real Wikipedia articles.

Not a search-based crawl (which could surface off-topic/inappropriate
pages) - pulls members of hand-picked, clearly-scoped Wikipedia categories
per topic (e.g. "Category:Solar System" for space), one level of
subcategory recursion, then fetches each article's summary and builds
"which fact matches this topic" MCQs the same way the live Wikipedia
fallback tier does (see backend/services/wikipedia_fallback.py) - just
many more of them, computed offline and committed as static data instead
of fetched live.

Usage: python tools/build_fallback_bank.py
Writes: backend/data/fallback_questions_expanded.json
        frontend/src/lib/fallbackQuestionsExpanded.ts
"""

import asyncio
import json
import random
import re
import sys
from pathlib import Path

import httpx

TARGET_PER_CATEGORY = 150
USER_AGENT = "KidGK-Quiz-App/0.1 (https://github.com/ratnadipsinha/kidgk; educational demo)"

# Same blocklist as backend/services/safety.py and frontend/src/lib/safety.ts
BLOCKED_TERMS = {
    "kill", "murder", "suicide", "sex", "sexual", "porn", "nude", "naked",
    "drug", "cocaine", "heroin", "alcohol", "beer", "wine", "cigarette",
    "gun", "weapon", "bomb", "terrorist", "rape", "nazi", "hitler",
    "damn", "hell", "stupid", "idiot", "hate", "blood", "gore", "violent",
    "war", "death", "died", "dead", "attack", "assassinat",
}
WORD_RE = re.compile(r"[a-zA-Z']+")

EXCLUDE_TITLE_RE = re.compile(
    r"^(List of|Lists of|Index of|Timeline of|Outline of|Glossary of)|"
    r"\(disambiguation\)|^[0-9]{3,4}(\s|$)|"
    r"in popular culture|\(chess\)|versus|fictional",
    re.IGNORECASE,
)

EXCLUDE_EXTRACT_RE = re.compile(
    r"fictional character|insecticide|parasit|roundworm|is a genus of|"
    r"is a species of (insect|fungus|fungi|bacteri)",
    re.IGNORECASE,
)

# Minimum recent monthly pageviews to count as "well-known enough for a
# kid's GK quiz" - the actual quality problem found on the first pass
# wasn't unsafe content (the blocklist already handles that), it was
# genuinely obscure topics (parasite species, chemical compounds, fictional
# trivia) that no blocklist would ever catch. Pageviews is a decent proxy
# for "a general audience has actually heard of this."
MIN_MONTHLY_VIEWS = 3000

# Rotated for variety instead of one fixed phrasing repeated for every
# question, which reads as flat/robotic across a 150-question bank.
QUESTION_TEMPLATES = [
    lambda title: f"Which of these facts is about {title}?",
    lambda title: f"What do we know about {title}?",
    lambda title: f"Pick the true statement about {title}.",
    lambda title: f"Which one correctly describes {title}?",
    lambda title: f"Can you spot the real fact about {title}?",
]
PAGEVIEWS_URL = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
    "en.wikipedia/all-access/user/{title}/monthly/{start}/{end}"
)

SEED_CATEGORIES = {
    "space": [
        "Solar System", "Planets", "Stars", "Galaxies", "Astronomical objects",
        "Space exploration", "Constellations", "Moons", "Comets", "Asteroids",
    ],
    "wildlife": [
        "Mammals", "Birds", "Reptiles", "Amphibians", "Fish", "Insects",
        "Marine biology", "Big cats", "Bears", "Primates",
    ],
    "countries": [
        "Member states of the United Nations", "Countries by continent",
        "Capitals in Asia", "Capitals in Europe", "Capitals in Africa",
        "Capitals in South America", "Capitals in North America",
    ],
    "history": [
        "Ancient civilizations", "Ancient Egypt", "Ancient Rome",
        "Ancient Greece", "World Heritage Sites", "Historical eras",
        "Inventions", "Exploration",
    ],
    "famous_people": [
        "Scientists", "Inventors", "Explorers", "Nobel laureates in Physics",
        "Nobel laureates in Chemistry", "Astronauts", "Artists",
    ],
    "science": [
        "Branches of science", "Physics", "Chemistry", "Biology",
        "Human body", "Earth sciences", "Scientific method", "Energy",
    ],
}

API = "https://en.wikipedia.org/w/api.php"
SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"

# One global limiter for every request this script makes, across all
# categories - Wikipedia's API rate-limits per client regardless of which
# endpoint, and the first version of this script (a semaphore per category
# batch, no cross-batch coordination) blew through that limit in seconds.
_semaphore = asyncio.Semaphore(4)
_last_request_time = 0.0
_min_interval = 0.15  # ~6-7 req/s ceiling, shared across all requests


async def throttled_get(client: httpx.AsyncClient, url: str, **kwargs) -> httpx.Response:
    global _last_request_time
    async with _semaphore:
        now = asyncio.get_event_loop().time()
        wait = _last_request_time + _min_interval - now
        if wait > 0:
            await asyncio.sleep(wait)
        _last_request_time = asyncio.get_event_loop().time()

        for attempt in range(5):
            resp = await client.get(url, headers={"User-Agent": USER_AGENT}, **kwargs)
            if resp.status_code == 429:
                backoff = 2 ** attempt
                await asyncio.sleep(backoff)
                continue
            return resp
        return resp  # last attempt's response, caller checks status


def is_safe_text(text: str) -> bool:
    words = {w.lower() for w in WORD_RE.findall(text or "")}
    return words.isdisjoint(BLOCKED_TERMS)


def first_sentence(text: str, max_words: int = 18) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    sentence = re.split(r"(?<=[.!?])\s", text)[0] if text else ""
    words = sentence.split(" ")
    if len(words) > max_words:
        sentence = " ".join(words[:max_words]).rstrip(".,;:") + "..."
    return sentence


async def get_category_members(client: httpx.AsyncClient, category: str, subcats=True) -> list[str]:
    titles: list[str] = []
    params = {
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "cmtitle": f"Category:{category}",
        "cmlimit": "500",
        "cmtype": "page|subcat" if subcats else "page",
    }
    try:
        resp = await throttled_get(client, API, params=params)
        resp.raise_for_status()
        data = resp.json()
        members = data.get("query", {}).get("categorymembers", [])
    except Exception as exc:
        print(f"  ! failed to list Category:{category}: {exc}", file=sys.stderr)
        return titles

    subcat_names = []
    for m in members:
        title = m["title"]
        if title.startswith("Category:"):
            subcat_names.append(title[len("Category:"):])
        else:
            titles.append(title)

    if subcats and subcat_names:
        # one level of recursion into subcategories, no further nesting.
        # Sequential (not gather) so the shared throttle actually spaces
        # these out instead of firing them all at once.
        for sc in subcat_names[:10]:
            titles.extend(await get_category_members(client, sc, subcats=False))

    return titles


def _last_full_month() -> tuple[str, str]:
    import datetime

    today = datetime.date.today()
    first_of_this_month = today.replace(day=1)
    last_month_end = first_of_this_month - datetime.timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return last_month_start.strftime("%Y%m01"), last_month_end.strftime("%Y%m%d")


_PV_START, _PV_END = _last_full_month()


async def get_monthly_views(client: httpx.AsyncClient, title: str) -> int:
    url = PAGEVIEWS_URL.format(
        title=title.replace(" ", "_"), start=_PV_START, end=_PV_END
    )
    try:
        resp = await throttled_get(client, url)
        if resp.status_code != 200:
            return 0
        data = resp.json()
        items = data.get("items", [])
        return sum(i.get("views", 0) for i in items)
    except Exception:
        return 0


async def fetch_summary(client: httpx.AsyncClient, title: str):
    try:
        resp = await throttled_get(client, SUMMARY_URL.format(title=title.replace(" ", "_")))
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("type") == "disambiguation":
            return None
        extract = data.get("extract", "")
        if not extract or len(extract) < 60:
            return None
        if not is_safe_text(extract):
            return None
        if EXCLUDE_EXTRACT_RE.search(extract):
            return None

        views = await get_monthly_views(client, title)
        if views < MIN_MONTHLY_VIEWS:
            return None

        return {"title": title, "sentence": first_sentence(extract), "image_keyword": title}
    except Exception:
        return None


async def build_category(client: httpx.AsyncClient, category_id: str, seeds: list[str]) -> list[dict]:
    print(f"== {category_id} ==")

    all_titles: set[str] = set()
    for seed in seeds:
        members = await get_category_members(client, seed)
        before = len(all_titles)
        for t in members:
            if not EXCLUDE_TITLE_RE.search(t):
                all_titles.add(t)
        print(f"  Category:{seed} -> +{len(all_titles) - before} (running total {len(all_titles)})")

    titles = list(all_titles)
    random.shuffle(titles)
    candidates = titles[: TARGET_PER_CATEGORY * 8]

    facts = []
    batch_size = 8
    for i in range(0, len(candidates), batch_size):
        batch = candidates[i : i + batch_size]
        results = await asyncio.gather(*(fetch_summary(client, t) for t in batch))
        facts.extend(r for r in results if r)
        if len(facts) >= TARGET_PER_CATEGORY * 1.3:
            break

    print(f"  {len(facts)} usable facts from {len(candidates)} candidates")

    if len(facts) > TARGET_PER_CATEGORY:
        facts = facts[:TARGET_PER_CATEGORY]

    return build_questions(facts)


def build_questions(facts: list[dict]) -> list[dict]:
    if len(facts) < 4:
        return []
    picture_count = max(1, round(len(facts) * 0.25))
    picture_titles = set(f["title"] for f in random.sample(facts, min(picture_count, len(facts))))

    questions = []
    for fact in facts:
        pool = [f["sentence"] for f in facts if f["title"] != fact["title"]]
        if len(pool) < 3:
            continue
        distractors = random.sample(pool, 3)
        options = distractors + [fact["sentence"]]
        random.shuffle(options)
        answer = options.index(fact["sentence"])
        template = random.choice(QUESTION_TEMPLATES)
        questions.append(
            {
                "question": template(fact["title"]),
                "options": options,
                "answer": answer,
                "explanation": f"{fact['sentence']} (from Wikipedia)",
                "image_keyword": fact["title"] if fact["title"] in picture_titles else None,
            }
        )
    return questions


async def main():
    bank = {}
    async with httpx.AsyncClient(timeout=15) as client:
        for category_id, seeds in SEED_CATEGORIES.items():
            bank[category_id] = await build_category(client, category_id, seeds)

    root = Path(__file__).resolve().parent.parent
    out_json = root / "backend" / "data" / "fallback_questions_expanded.json"
    out_json.write_text(json.dumps(bank, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nWrote {out_json} ({sum(len(v) for v in bank.values())} total questions)")

    ts_lines = [
        'import type { Question } from "./types";',
        "",
        "export const FALLBACK_BANK_EXPANDED: Record<string, Question[]> = ",
        json.dumps(bank, indent=2, ensure_ascii=False),
        ";",
        "",
    ]
    out_ts = root / "frontend" / "src" / "lib" / "fallbackQuestionsExpanded.ts"
    out_ts.write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"Wrote {out_ts}")

    for cat, qs in bank.items():
        print(f"  {cat}: {len(qs)} questions")


if __name__ == "__main__":
    asyncio.run(main())
