import type { Question } from "./types";

// Minimal blocklist for an MVP — flags content that has no place in a kids' quiz.
// Ported from backend/services/safety.py (kept identical intentionally).
const BLOCKED_TERMS = new Set([
  "kill", "murder", "suicide", "sex", "sexual", "porn", "nude", "naked",
  "drug", "cocaine", "heroin", "alcohol", "beer", "wine", "cigarette",
  "gun", "weapon", "bomb", "terrorist", "rape", "nazi", "hitler",
  "damn", "hell", "stupid", "idiot", "hate", "blood", "gore", "violent",
]);

const WORD_RE = /[a-zA-Z']+/g;

function words(text: string): Set<string> {
  const matches = text.match(WORD_RE) ?? [];
  return new Set(matches.map((w) => w.toLowerCase()));
}

export function isSafe(q: Pick<Question, "question" | "options" | "explanation">): boolean {
  const text = [q.question, ...q.options, q.explanation ?? ""].join(" ");
  for (const w of words(text)) {
    if (BLOCKED_TERMS.has(w)) return false;
  }
  return true;
}

export function filterSafe<T extends Pick<Question, "question" | "options" | "explanation">>(
  questions: T[]
): T[] {
  return questions.filter(isSafe);
}
