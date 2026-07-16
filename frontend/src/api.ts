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
  image_url: string | null;
};

export type RoundResponse = {
  category: string;
  source: "groq" | "fallback";
  questions: Question[];
};

const BASE = "/api";

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${BASE}/categories`);
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json();
}

export async function fetchRound(
  category: string,
  grade: number,
  count = 5
): Promise<RoundResponse> {
  const res = await fetch(`${BASE}/round`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, grade, count }),
  });
  if (!res.ok) throw new Error("Failed to load round");
  return res.json();
}
