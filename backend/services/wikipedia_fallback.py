import asyncio
import logging
import random
import re

import httpx

logger = logging.getLogger("kidgk.wikipedia_fallback")

SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"

# Rotated for variety instead of one fixed phrasing repeated for every
# question in a round, which reads as flat/robotic.
QUESTION_TEMPLATES = [
    lambda title: f"Which of these facts is about {title}?",
    lambda title: f"What do we know about {title}?",
    lambda title: f"Pick the true statement about {title}.",
    lambda title: f"Which one correctly describes {title}?",
    lambda title: f"Can you spot the real fact about {title}?",
]

# Curated per-category article pools. Kept to well-known, kid-safe topics
# rather than pulling random/search results, since anything auto-discovered
# from Wikipedia search could surface off-topic or inappropriate pages.
CATEGORY_TOPICS = {
    "space": [
        "Mars", "Saturn", "Jupiter", "Venus", "Mercury (planet)", "Neptune",
        "Uranus", "Sun", "Moon", "Milky Way", "International Space Station",
        "Halley's Comet",
    ],
    "wildlife": [
        "Lion", "Giraffe", "Cheetah", "Polar bear", "Ostrich", "Honey bee",
        "Kangaroo", "Chameleon", "Elephant", "Blue whale", "Penguin", "Koala",
    ],
    "countries": [
        "Japan", "France", "Canada", "Brazil", "Egypt", "Australia", "India",
        "Italy", "Kenya", "Norway", "Mexico", "China",
    ],
    "history": [
        "Ancient Egypt", "Roman Empire", "Great Wall of China",
        "George Washington", "Titanic", "Great Pyramid of Giza",
        "Ancient Greece", "Christopher Columbus", "Vikings", "Machu Picchu",
    ],
    "famous_people": [
        "Isaac Newton", "Leonardo da Vinci", "Thomas Edison",
        "Neil Armstrong", "Albert Einstein", "Marie Curie",
        "Wright brothers", "Alexander Graham Bell", "Amelia Earhart",
    ],
    "science": [
        "Photosynthesis", "Human heart", "Gravity", "Water cycle",
        "Solar system", "DNA", "Volcano", "Electricity", "Human skeleton",
    ],
}


def _first_sentence(text: str, max_words: int = 18) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    sentence = re.split(r"(?<=[.!?])\s", text)[0] if text else ""
    words = sentence.split(" ")
    if len(words) > max_words:
        sentence = " ".join(words[:max_words]).rstrip(".,;:") + "..."
    return sentence


async def _fetch_summary(client: httpx.AsyncClient, title: str) -> dict | None:
    try:
        resp = await client.get(
            SUMMARY_URL.format(title=title.replace(" ", "_")),
            headers={
                "User-Agent": "KidGK-Quiz-App/0.1 "
                "(https://github.com/ratnadipsinha/kidgk; educational demo)"
            },
        )
        resp.raise_for_status()
        data = resp.json()
        extract = data.get("extract", "")
        if not extract:
            return None
        return {"title": title, "sentence": _first_sentence(extract)}
    except Exception as exc:
        logger.warning("Wikipedia summary fetch failed for %r: %s", title, exc)
        return None


async def generate_from_wikipedia(category_id: str, count: int) -> list[dict]:
    """Builds simple 'which fact matches this topic' MCQs straight from
    Wikipedia article summaries. Used as a fallback tier when Groq is
    unavailable or rate-limited, before falling back further to the static
    offline bank."""
    topics = CATEGORY_TOPICS.get(category_id, [])
    if len(topics) < 4:
        return []

    pool_size = min(len(topics), max(count + 3, 8))
    chosen_titles = random.sample(topics, pool_size)

    async with httpx.AsyncClient(timeout=8) as client:
        results = await asyncio.gather(
            *(_fetch_summary(client, t) for t in chosen_titles)
        )
    facts = [r for r in results if r]
    if len(facts) < 4:
        return []

    # No picture questions in this tier: the "which fact matches this title"
    # mechanic means the correct answer's sentence always names the exact
    # subject the image would show, so displaying that image is always a
    # giveaway (confirmed live: a Jupiter photo above "which fact is about
    # Jupiter?" with an option literally starting "Jupiter is..."). Unlike
    # Groq, there's no LLM here to write a genuinely ambiguous picture
    # question, so this tier stays text-only.
    questions = []
    for fact in facts:
        distractor_pool = [f["sentence"] for f in facts if f["title"] != fact["title"]]
        if len(distractor_pool) < 3:
            continue
        distractors = random.sample(distractor_pool, 3)
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
                "image_keyword": None,
                "topic": fact["title"],
            }
        )
        if len(questions) >= count:
            break

    return questions
