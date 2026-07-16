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

export type UpdateCheck = {
  update_available: boolean;
  local?: string;
  remote?: string;
  error?: string;
};

export async function checkForUpdate(): Promise<UpdateCheck> {
  const res = await fetch(`${BASE}/update/check`);
  if (!res.ok) throw new Error("Failed to check for updates");
  return res.json();
}

export async function applyUpdate(): Promise<void> {
  const res = await fetch(`${BASE}/update/apply`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start update");
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
