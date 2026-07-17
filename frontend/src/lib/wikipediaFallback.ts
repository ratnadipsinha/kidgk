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

// Wikipedia first sentences almost always open by naming their own subject
// ("Mars is the fourth planet...", "The Moon is Earth's only..."). Left
// as-is, a distractor for a Moon question literally names Mars - reads as
// out-of-context/broken, and the correct option names the asked subject,
// giving itself away. Rewrite each sentence to start with "It" so every
// option reads as an anonymous fact on equal footing.
function anonymize(sentence: string, title: string): string {
  // strip a parenthetical disambiguator: "Mercury (planet)" -> "Mercury"
  const plain = title.replace(/\s*\(.*\)$/, "");
  const patterns = [
    // "The Moon is ..." / "Mars is ..." / "The planet Mars is ..."
    new RegExp(`^(The\\s+)?(planet\\s+|star\\s+)?${escapeRe(plain)}[^,]*?\\s+(is|was|are|were)\\s+`, "i"),
    // "Mars, the fourth planet, is ..." (title then an appositive)
    new RegExp(`^(The\\s+)?${escapeRe(plain)},[^,]+,\\s+(is|was|are|were)\\s+`, "i"),
  ];
  for (const re of patterns) {
    const m = sentence.match(re);
    if (m) {
      const verb = m[m.length - 1];
      const rest = sentence.slice(m[0].length);
      return `It ${verb} ${rest}`;
    }
  }
  // Fallback for openings the patterns don't cover ("The Milky Way or Milky
  // Way Galaxy, or simply the Galaxy, is..."; "Maria Salomea Skłodowska
  // Curie, better known as Marie Curie was..."): cut everything before the
  // first main verb, which is where the subject naming lives.
  const verbSplit = sentence.match(/\s(is|was|are|were)\s/);
  if (verbSplit && verbSplit.index !== undefined) {
    return `It ${verbSplit[1]} ${sentence.slice(verbSplit.index + verbSplit[0].length)}`;
  }
  // last resort: blank out any mention of the subject name
  const mentionRe = new RegExp(escapeRe(plain), "gi");
  return sentence.replace(mentionRe, "this subject");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

async function fetchSummary(
  title: string
): Promise<{ title: string; sentence: string; anonymous: string } | null> {
  try {
    const res = await fetch(SUMMARY_URL(title));
    if (!res.ok) return null;
    const data = await res.json();
    const extract = data.extract as string | undefined;
    if (!extract) return null;
    const sentence = firstSentence(extract);
    return { title, sentence, anonymous: anonymize(sentence, title) };
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
  const facts = results.filter(
    (r): r is { title: string; sentence: string; anonymous: string } => r !== null
  );
  if (facts.length < 4) return [];

  // No picture questions in this tier: the "which fact matches this title"
  // mechanic means the correct answer's sentence always names the exact
  // subject the image would show, so displaying that image is always a
  // giveaway (confirmed live: a Jupiter photo above "which fact is about
  // Jupiter?" with an option literally starting "Jupiter is..."). Unlike
  // Groq, there's no LLM here to write a genuinely ambiguous picture
  // question, so this tier stays text-only.
  const questions: Question[] = [];
  for (const fact of facts) {
    // Anonymized options ("It is the fourth planet from the Sun") so
    // distractors don't name unrelated subjects and the correct option
    // doesn't name the asked subject - both directions were giveaways/
    // confusing with the raw sentences.
    const distractorPool = facts.filter((f) => f.title !== fact.title).map((f) => f.anonymous);
    if (distractorPool.length < 3) continue;
    const distractors = sample(distractorPool, 3);
    const options = shuffle([...distractors, fact.anonymous]);
    const answer = options.indexOf(fact.anonymous);

    const template = QUESTION_TEMPLATES[Math.floor(Math.random() * QUESTION_TEMPLATES.length)];
    questions.push({
      question: template(fact.title),
      options,
      answer,
      explanation: `${fact.sentence} (from Wikipedia)`,
      image_keyword: null,
      topic: fact.title,
    });
    if (questions.length >= count) break;
  }

  return questions;
}
