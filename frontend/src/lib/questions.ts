import type { Question, Round, RoundSource } from "./types";
import { CATEGORIES } from "./categories";
import { FALLBACK_BANK } from "./fallbackQuestions";
import { generateQuestions } from "./groq";
import { generateFromWikipedia } from "./wikipediaFallback";
import { filterSafe } from "./safety";
import { fetchImageUrl } from "./images";

// Generated question pools are cached per category+grade for the lifetime
// of the page (mirrors backend/services/cache.py's TTL pool, minus the TTL
// since a browser tab doesn't stay open for hours the way a server does).
const POOL_SIZE = 20;
const poolCache = new Map<string, Question[]>();
const inFlight = new Map<string, Promise<{ pool: Question[]; source: RoundSource }>>();

function sample<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function fallbackRound(categoryId: string, count: number): Question[] {
  const pool = FALLBACK_BANK[categoryId] ?? [];
  return sample(pool, Math.min(count, pool.length));
}

async function attachImages(questions: Question[]): Promise<Question[]> {
  const urls = await Promise.all(questions.map((q) => fetchImageUrl(q.image_keyword)));
  return questions.map((q, i) => ({ ...q, image_url: urls[i] }));
}

async function getPool(
  categoryId: string,
  categoryName: string,
  grade: number
): Promise<{ pool: Question[]; source: RoundSource }> {
  const key = `${categoryId}:${grade}`;
  const cached = poolCache.get(key);
  if (cached) return { pool: cached, source: "cache" };

  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const raw = await generateQuestions(categoryName, grade, POOL_SIZE);
      const filtered = filterSafe(raw);
      if (filtered.length < Math.min(5, POOL_SIZE)) {
        throw new Error(
          `Only ${filtered.length}/${POOL_SIZE} Groq questions passed validation/safety checks`
        );
      }
      poolCache.set(key, filtered);
      return { pool: filtered, source: "groq" as RoundSource };
    } catch {
      // fall through to Wikipedia
    }

    try {
      const wiki = await generateFromWikipedia(categoryId, POOL_SIZE);
      const filtered = filterSafe(wiki);
      if (filtered.length < Math.min(5, POOL_SIZE)) {
        throw new Error(
          `Only ${filtered.length}/${POOL_SIZE} Wikipedia questions passed safety checks`
        );
      }
      poolCache.set(key, filtered);
      return { pool: filtered, source: "wikipedia" as RoundSource };
    } catch {
      return { pool: FALLBACK_BANK[categoryId] ?? [], source: "fallback" as RoundSource };
    }
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

export async function getRound(categoryId: string, grade: number, count = 5): Promise<Round> {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new Error(`Unknown category: ${categoryId}`);

  const { pool, source } = await getPool(categoryId, category.name, grade);
  const questions = await attachImages(sample(pool, Math.min(count, pool.length)));

  return { category: categoryId, source, questions };
}

// Exported for completeness/parity with the old backend's fallback_round;
// unused directly since getPool already falls through to FALLBACK_BANK.
export { fallbackRound };
