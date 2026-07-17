export type WikipediaSummary = {
  extract: string | null;
  thumbnailUrl: string | null;
};

// Session cache: term -> summary (article's own extract + curated thumbnail).
// This is far more reliable than a Commons keyword search, which full-text
// matches file names/descriptions and can return something only tangentially
// related (or completely unrelated) to the actual subject.
const cache = new Map<string, WikipediaSummary>();

// Wikipedia's own "thumbnail" is usually a real photo, but not always - it
// can occasionally be a logo, icon, coat of arms, or map instead (verified
// live: the actual current "Eiffel Tower" article's thumbnail is a small
// logo SVG, not a tower photo). Filter those out rather than show a kid a
// random icon for "what does this look like" style questions.
function looksLikeRealPhoto(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.includes("/wikipedia/en/")) return false; // local non-free files: usually logos/screenshots
  if (lower.endsWith(".svg") || lower.includes(".svg.png")) return false; // rendered SVGs: diagrams/logos/maps
  if (/logo|icon|seal|crest|coat_of_arms|emblem|symbol/.test(lower)) return false;
  return true;
}

export async function fetchWikipediaSummary(term: string): Promise<WikipediaSummary> {
  const key = term.trim().toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const empty: WikipediaSummary = { extract: null, thumbnailUrl: null };
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(term.replace(/ /g, "_"))}`
    );
    if (!res.ok) {
      cache.set(key, empty);
      return empty;
    }
    const data = await res.json();
    if (data.type === "disambiguation") {
      cache.set(key, empty);
      return empty;
    }
    const rawThumbnail: string | undefined = data.thumbnail?.source;
    const summary: WikipediaSummary = {
      extract: typeof data.extract === "string" && data.extract.trim() ? data.extract.trim() : null,
      thumbnailUrl: rawThumbnail && looksLikeRealPhoto(rawThumbnail) ? rawThumbnail : null,
    };
    cache.set(key, summary);
    return summary;
  } catch {
    cache.set(key, empty);
    return empty;
  }
}
