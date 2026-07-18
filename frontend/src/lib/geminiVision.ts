import type { Question } from "./types";
import { GEMINI_API_KEY } from "./config";
import { filterSafe } from "./safety";

const MODEL = "gemini-flash-lite-latest";
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = (grade: number, count: number) =>
  `You are shown a photo of a page (often from a school textbook or notes). ` +
  `Read the ACTUAL lesson content on the page - the paragraphs, headings, and ` +
  `labelled diagrams that teach a subject. Completely ignore page numbers, dates, ` +
  `book titles, exercise numbers, figure numbers, and any other layout boilerplate.\n\n` +
  `First work out what the page is teaching (for example the parts of a plant, the ` +
  `water cycle, a historical event). Then generate ${count} multiple-choice ` +
  `questions for a Grade ${grade} student that test understanding of that subject ` +
  `matter, based ONLY on what the page actually says.\n\n` +
  `Return ONLY a JSON array (no prose, no markdown fences). Each object must have ` +
  `exactly these keys: "question" (string), "options" (array of exactly 4 strings), ` +
  `"answer" (integer 0-3 index of the correct option), "explanation" (string, max 15 ` +
  `words), "topic" (string: the single key word/phrase the question is about, ` +
  `appearing verbatim in the question text), "image_keyword" (always null). ` +
  `Distractors should be plausible and similar in length. Never ask about page ` +
  `numbers, dates, or figure numbers.`;

function parseQuestions(text: string): Question[] {
  // Gemini may wrap JSON in ```json fences or prose; extract the array.
  let jsonText = text.trim();
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonText = fence[1].trim();
  const start = jsonText.indexOf("[");
  const end = jsonText.lastIndexOf("]");
  if (start !== -1 && end !== -1) jsonText = jsonText.slice(start, end + 1);

  const raw = JSON.parse(jsonText);
  const arr: unknown[] = Array.isArray(raw) ? raw : [];
  const valid: Question[] = [];
  for (const item of arr) {
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

export function geminiConfigured(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY !== "your_gemini_api_key_here";
}

/** Sends the raw image to Gemini's vision model and returns quiz questions
 *  built from the page's actual content. `dataUrl` is a data: URL from a
 *  FileReader (e.g. "data:image/jpeg;base64,...."). */
export async function generateQuestionsFromImage(
  dataUrl: string,
  grade: number,
  count = 5
): Promise<Question[]> {
  if (!geminiConfigured()) throw new Error("Gemini not configured");

  const commaIdx = dataUrl.indexOf(",");
  const meta = dataUrl.slice(5, dataUrl.indexOf(";")); // e.g. image/jpeg
  const base64 = dataUrl.slice(commaIdx + 1);

  const res = await fetch(`${URL}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT(grade, count) },
            { inline_data: { mime_type: meta || "image/jpeg", data: base64 } },
          ],
        },
      ],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no content");

  const questions = filterSafe(parseQuestions(text));
  if (questions.length === 0) {
    throw new Error("Could not build questions from that image.");
  }
  return questions;
}
