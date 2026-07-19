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

// The expanded bank (~800 questions, ~600KB) is only needed on the rare
// path where both Groq and Wikipedia have failed, so it's dynamically
// imported as its own chunk instead of bloating the main bundle every
// visitor downloads regardless of whether they ever hit this tier.
async function offlinePool(categoryId: string): Promise<Question[]> {
  try {
    const { FALLBACK_BANK_EXPANDED } = await import("./fallbackQuestionsExpanded");
    const expanded = FALLBACK_BANK_EXPANDED[categoryId];
    if (expanded && expanded.length > 0) return expanded;
  } catch {
    // fall through to the small bundled bank if the chunk fails to load
  }
  return FALLBACK_BANK[categoryId] ?? [];
}

async function fallbackRound(categoryId: string, count: number): Promise<Question[]> {
  const pool = await offlinePool(categoryId);
  return sample(pool, Math.min(count, pool.length));
}

async function attachImages(questions: Question[]): Promise<Question[]> {
  const urls = await Promise.all(questions.map((q) => fetchImageUrl(q.image_keyword)));
  return questions.map((q, i) => ({ ...q, image_url: urls[i] }));
}

// Primary tier: the pre-generated static bank (tools/build_groq_bank.py),
// keyed by category:grade and committed to the repo. Instant, high quality,
// and immune to Groq's shared daily rate limit - each round is a fresh
// random sample from the ~30 questions per cell. Lazily imported as its
// own chunk to keep the main bundle small.
async function staticBankPool(categoryId: string, grade: number): Promise<Question[] | null> {
  try {
    const { GROQ_BANK } = await import("./groqBank");
    const pool = GROQ_BANK[`${categoryId}:${grade}`];
    return pool && pool.length >= POOL_SIZE ? pool : null;
  } catch {
    return null;
  }
}

async function getPool(
  categoryId: string,
  categoryName: string,
  grade: number
): Promise<{ pool: Question[]; source: RoundSource }> {
  // The static bank is not cached in poolCache on purpose: sampling the
  // full 30-question cell fresh each round is what gives round-to-round
  // variety ("put things randomly").
  const bankPool = await staticBankPool(categoryId, grade);
  if (bankPool) return { pool: bankPool, source: "bank" };

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
      return { pool: await offlinePool(categoryId), source: "fallback" as RoundSource };
    }
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

// The static bank shares identical question pools across some adjacent
// grades within the same difficulty band (e.g. grade 4 and 5 use the same
// 30 questions per category), so a mid-round difficulty adjustment can land
// on a pool that overlaps with what was already asked. excludeQuestions lets
// the caller filter those out before sampling, so a round never repeats a
// question the student has already seen.
export async function getRound(
  categoryId: string,
  grade: number,
  count = 5,
  excludeQuestions: string[] = []
): Promise<Round> {
  const category = CATEGORIES.find((c) => c.id === categoryId);
  if (!category) throw new Error(`Unknown category: ${categoryId}`);

  const { pool, source } = await getPool(categoryId, category.name, grade);
  const exclude = new Set(excludeQuestions.map(normalize));
  const available = exclude.size > 0 ? pool.filter((q) => !exclude.has(normalize(q.question))) : pool;
  const usable = available.length >= Math.min(count, pool.length) ? available : pool;
  const questions = await attachImages(sample(usable, Math.min(count, usable.length)));

  return { category: categoryId, source, questions };
}

// Exported for completeness/parity with the old backend's fallback_round;
// unused directly since getPool already falls through to FALLBACK_BANK.
export { fallbackRound };
