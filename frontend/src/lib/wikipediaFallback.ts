import type { Question } from "./types";

const SUMMARY_URL = (title: string) =>
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// Curated per-category article pools. Kept to well-known, kid-safe topics
// rather than pulling random/search results, since anything auto-discovered
// from Wikipedia search could surface off-topic or inappropriate pages.
// Ported from backend/services/wikipedia_fallback.py (kept identical).
const CATEGORY_TOPICS: Record<string, string[]> = {
  space: [
    "Mars", "Saturn", "Jupiter", "Venus", "Mercury (planet)", "Neptune",
    "Uranus", "Sun", "Moon", "Milky Way", "International Space Station",
    "Halley's Comet",
  ],
  wildlife: [
    "Lion", "Giraffe", "Cheetah", "Polar bear", "Ostrich", "Honey bee",
    "Kangaroo", "Chameleon", "Elephant", "Blue whale", "Penguin", "Koala",
  ],
  countries: [
    "Japan", "France", "Canada", "Brazil", "Egypt", "Australia", "India",
    "Italy", "Kenya", "Norway", "Mexico", "China",
  ],
  history: [
    "Ancient Egypt", "Roman Empire", "Great Wall of China",
    "George Washington", "Titanic", "Great Pyramid of Giza",
    "Ancient Greece", "Christopher Columbus", "Vikings", "Machu Picchu",
  ],
  famous_people: [
    "Isaac Newton", "Leonardo da Vinci", "Thomas Edison",
    "Neil Armstrong", "Albert Einstein", "Marie Curie",
    "Wright brothers", "Alexander Graham Bell", "Amelia Earhart",
  ],
  science: [
    "Photosynthesis", "Human heart", "Gravity", "Water cycle",
    "Solar system", "DNA", "Volcano", "Electricity", "Human skeleton",
  ],
};

function firstSentence(text: string, maxWords = 18): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentence = cleaned.split(/(?<=[.!?])\s/)[0];
  const words = sentence.split(" ");
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(" ").replace(/[.,;:]+$/, "") + "...";
  }
  return sentence;
}

// Rotated for variety instead of one fixed phrasing repeated for every
// question in a round, which reads as flat/robotic.
const QUESTION_TEMPLATES = [
  (title: string) => `Which of these facts is about ${title}?`,
  (title: string) => `What do we know about ${title}?`,
  (title: string) => `Pick the true statement about ${title}.`,
  (title: string) => `Which one correctly describes ${title}?`,
  (title: string) => `Can you spot the real fact about ${title}?`,
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

async function fetchSummary(title: string): Promise<{ title: string; sentence: string } | null> {
  try {
    const res = await fetch(SUMMARY_URL(title));
    if (!res.ok) return null;
    const data = await res.json();
    const extract = data.extract as string | undefined;
    if (!extract) return null;
    return { title, sentence: firstSentence(extract) };
  } catch {
    return null;
  }
}

export async function generateFromWikipedia(categoryId: string, count: number): Promise<Question[]> {
  const topics = CATEGORY_TOPICS[categoryId] ?? [];
  if (topics.length < 4) return [];

  const poolSize = Math.min(topics.length, Math.max(count + 3, 8));
  const chosenTitles = sample(topics, poolSize);

  const results = await Promise.all(chosenTitles.map(fetchSummary));
  const facts = results.filter((r): r is { title: string; sentence: string } => r !== null);
  if (facts.length < 4) return [];

  const pictureCount = Math.max(1, Math.round(count * 0.25));
  const pictureTitles = new Set(sample(facts, Math.min(pictureCount, facts.length)).map((f) => f.title));

  const questions: Question[] = [];
  for (const fact of facts) {
    const distractorPool = facts.filter((f) => f.title !== fact.title).map((f) => f.sentence);
    if (distractorPool.length < 3) continue;
    const distractors = sample(distractorPool, 3);
    const options = shuffle([...distractors, fact.sentence]);
    const answer = options.indexOf(fact.sentence);

    const template = QUESTION_TEMPLATES[Math.floor(Math.random() * QUESTION_TEMPLATES.length)];
    questions.push({
      question: template(fact.title),
      options,
      answer,
      explanation: `${fact.sentence} (from Wikipedia)`,
      image_keyword: pictureTitles.has(fact.title) ? fact.title : null,
    });
    if (questions.length >= count) break;
  }

  return questions;
}
