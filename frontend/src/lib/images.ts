import { fetchWikipediaSummary } from "./wikipediaSummary";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Per-session cache: image_keyword -> url (or null if no result was found).
const cache = new Map<string, string | null>();

async function searchCommons(keyword: string): Promise<string | null> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: `filetype:bitmap ${keyword}`,
    gsrnamespace: "6", // File namespace
    gsrlimit: "1",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "500",
    origin: "*", // required for CORS on MediaWiki's API
  });

  try {
    const res = await fetch(`${COMMONS_API}?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();

    const pages = data?.query?.pages ?? {};
    for (const page of Object.values(pages) as any[]) {
      const infos = page.imageinfo;
      if (infos && infos.length > 0) {
        return infos[0].thumburl ?? infos[0].url ?? null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchImageUrl(keyword: string | null | undefined): Promise<string | null> {
  if (!keyword) return null;

  const key = keyword.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

  // Prefer the actual Wikipedia article's own curated thumbnail - a plain
  // Commons keyword search full-text matches file names/descriptions and
  // can return something unrelated to the actual subject. Only fall back
  // to that search if no matching Wikipedia article/thumbnail exists.
  const summary = await fetchWikipediaSummary(keyword);
  let url = summary.thumbnailUrl;
  if (!url) {
    url = await searchCommons(keyword);
  }

  cache.set(key, url);
  return url;
}
