import type { Question } from "./types";
import { GROQ_API_KEY, GROQ_MODEL } from "./config";
import { filterSafe } from "./safety";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT =
  "You are a quiz question generator for students in grades 4-10 (ages 9-16). " +
  "You read text scanned from a page and build questions about the actual " +
  "subject matter it teaches. You return only strict JSON, no prose, no " +
  "markdown fences. Content must be age-appropriate, factually accurate, and " +
  "safe for a school setting.";

// Strip lines that are almost certainly page boilerplate, not content: bare
// page numbers, chapter/exercise headers, dates, standalone numbers, running
// heads. The prompt tells the model to ignore these too, but removing the
// obvious ones up front makes the questions noticeably more on-topic.
function cleanOcrText(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((line) => {
      if (!line) return false;
      const lower = line.toLowerCase();
      // bare page numbers or "Page 12", "12 | ...", "- 12 -"
      if (/^[-–|\s]*(page|pg\.?)?\s*\d{1,4}\s*[-–|]*$/.test(lower)) return false;
      // standalone dates like "12/03/2024", "March 2024", "2024"
      if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(line)) return false;
      if (/^(19|20)\d{2}$/.test(line)) return false;
      if (/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{4}$/.test(lower)) return false;
      // chapter/unit/exercise/lesson headers with just a number
      if (/^(chapter|unit|exercise|lesson|section|worksheet|activity|figure|fig\.?|table)\s*[:#-]?\s*[\d.]*$/.test(lower)) return false;
      // a line that is only digits/punctuation (page footers, question numbers)
      if (/^[\d\s.,:;|#*_-]+$/.test(line)) return false;
      return true;
    })
    .join("\n");
}

function buildPrompt(sourceText: string, grade: number, count: number): string {
  const cleaned = cleanOcrText(sourceText).slice(0, 6000);
  return (
    `Below is text scanned (via OCR) from a page - it may have minor recognition ` +
    `errors, and it may include noise like page numbers, dates, headers, footers, ` +
    `chapter titles, exercise numbers, or captions.\n\n"""\n${cleaned}\n"""\n\n` +
    `STEP 1 - Understand the page: figure out what topic or subject this page is ` +
    `actually teaching (e.g. "the water cycle", "the French Revolution", ` +
    `"photosynthesis"). Completely ignore page numbers, dates, headings, exercise ` +
    `numbers, names of textbooks, and any other boilerplate that is not part of the ` +
    `lesson content.\n\n` +
    `STEP 2 - Write questions about that subject matter, testing whether a student ` +
    `understood the ideas on the page. Base them ONLY on information contained in ` +
    `the text - do not add outside facts, and never ask about page numbers, dates, ` +
    `figure numbers, or formatting.\n\n` +
    `Generate ${count} multiple-choice questions for a Grade ${grade} student. ` +
    'Return only a JSON array. Each object must have exactly these keys: ' +
    '"question" (string), "options" (array of exactly 4 strings), ' +
    '"answer" (integer index 0-3 of the correct option), ' +
    '"explanation" (string, max 15 words, referencing the source text), ' +
    '"topic" (string, REQUIRED: the single key word or short phrase the question ' +
    'is about, appearing verbatim or near-verbatim in the question text), ' +
    '"image_keyword" (always null for this - set every one to null). ' +
    "Distractors should be plausible and similar in length to the correct answer. " +
    "No repeated questions. If the page has too little real content to make good " +
    "questions, generate as many solid ones as you can, even fewer than requested."
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
        topic: typeof q.topic === "string" && q.topic.trim() ? q.topic.trim() : null,
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
