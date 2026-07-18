"""Assembles the hand-authored per-category tier files (tools/bank_parts/*.json)
into the final static question bank keyed by `category:grade`, and writes both
the backend JSON and the frontend TS module.

Each category file has three tiers - "a" (grades 4-5), "b" (grades 6-7),
"c" (grades 8-10) - so every category x grade cell is populated from the
tier appropriate to that grade.

Usage: python tools/assemble_bank.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PARTS = ROOT / "tools" / "bank_parts"
OUT_JSON = ROOT / "backend" / "data" / "groq_bank.json"
OUT_TS = ROOT / "frontend" / "src" / "lib" / "groqBank.ts"

CATEGORIES = ["space", "wildlife", "countries", "history", "famous_people", "science"]
# grade -> tier
GRADE_TIER = {4: "a", 5: "a", 6: "b", 7: "b", 8: "c", 9: "c", 10: "c"}

REQUIRED_KEYS = {"question", "options", "answer", "explanation", "image_keyword", "topic"}


def validate(cat: str, tier: str, q: dict) -> None:
    missing = REQUIRED_KEYS - set(q)
    assert not missing, f"{cat}/{tier}: question missing keys {missing}: {q.get('question')}"
    assert len(q["options"]) == 4, f"{cat}/{tier}: not 4 options: {q['question']}"
    assert 0 <= q["answer"] <= 3, f"{cat}/{tier}: bad answer index: {q['question']}"
    # topic should appear in the question when set (drives the inline hint highlight)


def main():
    bank: dict[str, list] = {}
    for cat in CATEGORIES:
        data = json.loads((PARTS / f"{cat}.json").read_text(encoding="utf-8"))
        for tier in ("a", "b", "c"):
            for q in data[tier]:
                validate(cat, tier, q)
        for grade, tier in GRADE_TIER.items():
            bank[f"{cat}:{grade}"] = data[tier]

    OUT_JSON.write_text(json.dumps(bank, indent=2, ensure_ascii=False), encoding="utf-8")

    ts = 'import type { Question } from "./types";\n\n'
    ts += "// Pre-authored static question bank (tools/bank_parts/*.json via\n"
    ts += "// tools/assemble_bank.py). Keys are `category:grade`. This is the\n"
    ts += "// PRIMARY question source - instant, offline, no API dependency.\n"
    ts += "export const GROQ_BANK: Record<string, Question[]> = "
    ts += json.dumps(bank, indent=2, ensure_ascii=False)
    ts += ";\n"
    OUT_TS.write_text(ts, encoding="utf-8")

    per_tier = {cat: {t: 0 for t in "abc"} for cat in CATEGORIES}
    for cat in CATEGORIES:
        data = json.loads((PARTS / f"{cat}.json").read_text(encoding="utf-8"))
        for t in "abc":
            per_tier[cat][t] = len(data[t])
    print(f"Wrote {len(bank)} cells to {OUT_JSON.name} and {OUT_TS.name}")
    for cat in CATEGORIES:
        t = per_tier[cat]
        print(f"  {cat}: a={t['a']} b={t['b']} c={t['c']}")


if __name__ == "__main__":
    main()
