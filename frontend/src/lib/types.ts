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
};

export type RoundSource = "groq" | "cache" | "wikipedia" | "fallback";

export type Round = {
  category: string;
  source: RoundSource;
  questions: Question[];
};
