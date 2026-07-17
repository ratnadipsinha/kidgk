"""One-off post-processor: rewrites every option in the expanded offline bank
to start with "It is/was/..." instead of naming its own subject, matching the
live Wikipedia tier's fix (see _anonymize in backend/services/wikipedia_fallback.py).
Without this, a Moon question shows distractors literally starting "Mars is..."
- out-of-context/confusing - and the correct option names the asked subject."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "backend" / "data" / "fallback_questions_expanded.json"
TS_PATH = ROOT / "frontend" / "src" / "lib" / "fallbackQuestionsExpanded.ts"


def anonymize(sentence: str) -> str:
    m = re.search(r"\s(is|was|are|were)\s", sentence)
    if m:
        return f"It {m.group(1)} {sentence[m.end():]}"
    return sentence


def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        bank = json.load(f)

    changed = 0
    unchanged = 0
    for qs in bank.values():
        for q in qs:
            new_options = []
            for opt in q["options"]:
                new = anonymize(opt)
                if new != opt:
                    changed += 1
                else:
                    unchanged += 1
                new_options.append(new)
            q["options"] = new_options

    # Options that failed anonymization (typically truncated first sentences
    # with no main verb) still name their own subject - if that's the correct
    # option it's a giveaway, and either way it reads inconsistently next to
    # the "It is..." options. Drop those questions; the bank is big enough.
    dropped = 0
    for cat in bank:
        before = len(bank[cat])
        bank[cat] = [
            q for q in bank[cat]
            if all(o.startswith(("It is", "It was", "It are", "It were")) for o in q["options"])
        ]
        # normalize the plural-verb artifact ("It are ...") to read naturally
        for q in bank[cat]:
            q["options"] = [
                o.replace("It are ", "They are ", 1).replace("It were ", "They were ", 1)
                for o in q["options"]
            ]
        dropped += before - len(bank[cat])
    print(f"dropped {dropped} questions with un-anonymizable options")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(bank, f, indent=2, ensure_ascii=False)

    ts = 'import type { Question } from "./types";\n\n'
    ts += "export const FALLBACK_BANK_EXPANDED: Record<string, Question[]> = "
    ts += json.dumps(bank, indent=2, ensure_ascii=False)
    ts += ";\n"
    with open(TS_PATH, "w", encoding="utf-8") as f:
        f.write(ts)

    print(f"options rewritten: {changed}, left as-is (no verb found): {unchanged}")


if __name__ == "__main__":
    main()
