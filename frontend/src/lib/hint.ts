// Session cache: term -> full Wikipedia summary text (or null if none found).
const cache = new Map<string, string | null>();

export async function fetchHintText(term: string): Promise<string | null> {
  const key = term.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, "_"))}`
    );
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const extract: string | undefined = data.extract;
    const text = extract && extract.trim().length > 0 ? extract.trim() : null;
    cache.set(key, text);
    return text;
  } catch {
    cache.set(key, null);
    return null;
  }
}
