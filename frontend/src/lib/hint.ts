import { fetchImageUrl } from "./images";

export type HintDetails = {
  text: string | null;
  imageUrl: string | null;
};

// Session cache: term -> full hint details (or null fields if not found).
const cache = new Map<string, HintDetails>();

async function fetchWikipediaExtract(term: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, "_"))}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const extract: string | undefined = data.extract;
    return extract && extract.trim().length > 0 ? extract.trim() : null;
  } catch {
    return null;
  }
}

export async function fetchHintDetails(term: string): Promise<HintDetails> {
  const key = term.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const [text, imageUrl] = await Promise.all([
    fetchWikipediaExtract(term),
    fetchImageUrl(term),
  ]);

  const details = { text, imageUrl };
  cache.set(key, details);
  return details;
}
