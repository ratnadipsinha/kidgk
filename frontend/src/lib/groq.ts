import type { Question } from "./types";
import { GROQ_API_KEY, GROQ_MODEL } from "./config";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT =
  "You are a quiz question generator for students in grades 4-10 (ages 9-16). " +
  "Match difficulty and vocabulary to the specific grade given in each request - " +
  "grade 4 should be simple and concrete, grade 10 can include more advanced " +
  "vocabulary and multi-step reasoning. " +
  "You return only strict JSON, no prose, no markdown fences. " +
  "Content must be age-appropriate, factually accurate, and safe for a school setting.";

function buildPrompt(category: string, grade: number, count: number): string {
  const pictureCount = Math.max(1, Math.round(count * 0.25));
  return (
    `Generate ${count} multiple-choice general knowledge questions about ` +
    `${category.toUpperCase()} for a Grade ${grade} student. ` +
    'Return only a JSON array. Each object must have exactly these keys: ' +
    '"question" (string), "options" (array of exactly 4 strings), ' +
    '"answer" (integer index 0-3 of the correct option), ' +
    '"explanation" (string, max 15 words), ' +
    '"image_keyword" (string or null, a short search term for a matching image). ' +
    "Keep every question and option short and crisp - plain, direct wording, " +
    "no long or wordy phrasing, options a few words each wherever possible. " +
    `Most questions should be text-only - set image_keyword to null for those. ` +
    `Only about ${pictureCount} of the ${count} questions should be picture-based - ` +
    "only those should have a non-null image_keyword. " +
    "CRITICAL rule for picture-based questions: the image is shown to the student " +
    "BEFORE they see the answer, so it must never simply depict the correct answer " +
    "itself (e.g. do NOT show a picture of China's flag and ask 'which of these is " +
    "China's flag?' - that gives the answer away). Only use the picture format when " +
    "the image itself IS the unknown the student must identify, e.g. 'What animal is " +
    "this?' with a photo of a lion and options naming different animals. image_keyword " +
    "must describe the picture's actual subject, not the answer text. " +
    "Distractors should be plausible and similar in length to the correct answer. " +
    "No repeated questions. Kid-safe, factually accurate content only."
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
        image_keyword: typeof q.image_keyword === "string" ? q.image_keyword : null,
      });
    }
  }
  return valid;
}

export async function generateQuestions(
  category: string,
  grade: number,
  count: number
): Promise<Question[]> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not configured");

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
        { role: "user", content: buildPrompt(category, grade, count) },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed: ${res.status}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq returned no content");

  const parsed = JSON.parse(content);
  const questions: unknown[] = Array.isArray(parsed)
    ? parsed
    : Object.values(parsed).find((v) => Array.isArray(v)) ?? [];

  return validateQuestions(questions);
}
