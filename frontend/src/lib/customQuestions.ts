import type { Question } from "./types";
import { GROQ_API_KEY, GROQ_MODEL } from "./config";
import { filterSafe } from "./safety";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT =
  "You are a quiz question generator for students in grades 4-10 (ages 9-16). " +
  "You return only strict JSON, no prose, no markdown fences. " +
  "Content must be age-appropriate, factually accurate, and safe for a school setting.";

function buildPrompt(sourceText: string, grade: number, count: number): string {
  // Truncate to keep the request a reasonable size - OCR output from a
  // photo of a page/notes rarely needs more than this to build 5 questions.
  const trimmed = sourceText.slice(0, 6000);
  return (
    `Here is text extracted from a photo (via OCR, so it may contain minor ` +
    `recognition errors - use your judgement to read through those): \n\n"""\n${trimmed}\n"""\n\n` +
    `Generate ${count} multiple-choice questions for a Grade ${grade} student, based ONLY on ` +
    `the content of this text (not general outside knowledge). ` +
    'Return only a JSON array. Each object must have exactly these keys: ' +
    '"question" (string), "options" (array of exactly 4 strings), ' +
    '"answer" (integer index 0-3 of the correct option), ' +
    '"explanation" (string, max 15 words, referencing the source text), ' +
    '"image_keyword" (always null for this - set every one to null). ' +
    "Distractors should be plausible and similar in length to the correct answer. " +
    "No repeated questions. If the text is too short or unclear to make good questions, " +
    "generate as many good ones as you reasonably can, even fewer than requested."
  );
}

function validateQuestions(raw: unknown[]): Question[] {
  const valid: Question[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const q = item as Record<string, unknown>;
    const options = q.options;
    const answer = q.answer;
    if (
      typeof q.question === "string" &&
      Array.isArray(options) &&
      options.length === 4 &&
      options.every((o) => typeof o === "string") &&
      typeof answer === "number" &&
      Number.isInteger(answer) &&
      answer >= 0 &&
      answer <= 3
    ) {
      valid.push({
        question: q.question,
        options: options as string[],
        answer,
        explanation: typeof q.explanation === "string" ? q.explanation : "",
        image_keyword: null,
      });
    }
  }
  return valid;
}

export async function generateQuestionsFromText(
  sourceText: string,
  grade: number,
  count = 5
): Promise<Question[]> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");
  if (!sourceText || sourceText.trim().length < 40) {
    throw new Error("Not enough readable text was found in that image.");
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildPrompt(sourceText, grade, count) },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) throw new Error(`Groq request failed: ${res.status}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");

  const parsed = JSON.parse(content);
  const questions: unknown[] = Array.isArray(parsed)
    ? parsed
    : Object.values(parsed).find((v) => Array.isArray(v)) ?? [];

  const valid = validateQuestions(questions);
  const safe = filterSafe(valid);
  if (safe.length === 0) {
    throw new Error("Could not build any questions from that image.");
  }
  return safe;
}
