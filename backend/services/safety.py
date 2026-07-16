import re

# Minimal blocklist for an MVP — flags content that has no place in a kids' quiz.
# This is a coarse net, not a substitute for the "flag a question" review queue
# described in the proposal; it exists to catch obvious model slip-ups.
BLOCKED_TERMS = {
    "kill", "murder", "suicide", "sex", "sexual", "porn", "nude", "naked",
    "drug", "cocaine", "heroin", "alcohol", "beer", "wine", "cigarette",
    "gun", "weapon", "bomb", "terrorist", "rape", "nazi", "hitler",
    "damn", "hell", "stupid", "idiot", "hate", "blood", "gore", "violent",
}

_WORD_RE = re.compile(r"[a-zA-Z']+")


def _words(text: str) -> set[str]:
    return {w.lower() for w in _WORD_RE.findall(text or "")}


def is_safe(question: dict) -> bool:
    text = " ".join(
        [
            question.get("question", ""),
            *question.get("options", []),
            question.get("explanation", "") or "",
        ]
    )
    return _words(text).isdisjoint(BLOCKED_TERMS)


def filter_safe(questions: list[dict]) -> list[dict]:
    return [q for q in questions if is_safe(q)]
