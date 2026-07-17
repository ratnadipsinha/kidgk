const COMMONS_API = "https://commons.wikimedia.org/w/api.php";

// Per-session cache: image_keyword -> url (or null if no result was found).
const cache = new Map<string, string | null>();

export async function fetchImageUrl(keyword: string | null | undefined): Promise<string | null> {
  if (!keyword) return null;

  const key = keyword.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key) ?? null;

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
    if (!res.ok) throw new Error(`Commons request failed: ${res.status}`);
    const data = await res.json();

    const pages = data?.query?.pages ?? {};
    let url: string | null = null;
    for (const page of Object.values(pages) as any[]) {
      const infos = page.imageinfo;
      if (infos && infos.length > 0) {
        url = infos[0].thumburl ?? infos[0].url ?? null;
        break;
      }
    }

    cache.set(key, url);
    return url;
  } catch {
    cache.set(key, null);
    return null;
  }
}
