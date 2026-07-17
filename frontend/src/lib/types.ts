export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
};

export type Question = {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
  image_keyword: string | null;
  image_url?: string | null;
  // The single key word/phrase this question is about (e.g. "cosmonaut",
  // "Saturn"), used to target the hint drawer - distinct from
  // image_keyword, which is only set for the ~25% of questions that show
  // a picture. topic is set for every question so the hint always has a
  // sensible term to look up, even for text-only questions.
  topic: string | null;
};

export type RoundSource = "groq" | "cache" | "wikipedia" | "fallback";

export type Round = {
  category: string;
  source: RoundSource;
  questions: Question[];
};
