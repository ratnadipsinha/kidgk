import logging

import httpx

logger = logging.getLogger("kidgk.images")

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
USER_AGENT = "KidGK-Quiz-App/0.1 (https://github.com/ratnadipsinha/kidgk; educational demo)"

# Per-process cache: image_keyword -> url (or None if no safe result was found).
# Keeps repeated categories/keywords from re-hitting the API every round.
_cache: dict[str, str | None] = {}


def _looks_like_real_photo(url: str) -> bool:
    """Wikipedia's own thumbnail is usually a real photo, but not always -
    it can occasionally be a logo, icon, coat of arms, or map instead
    (verified live: the current "Eiffel Tower" article's thumbnail is a
    small logo SVG, not a tower photo)."""
    lower = url.lower()
    if "/wikipedia/en/" in lower:
        return False  # local non-free files: usually logos/screenshots
    if lower.endswith(".svg") or ".svg.png" in lower:
        return False  # rendered SVGs: diagrams/logos/maps
    if any(w in lower for w in ("logo", "icon", "seal", "crest", "coat_of_arms", "emblem", "symbol")):
        return False
    return True


async def _wikipedia_thumbnail(client: httpx.AsyncClient, keyword: str) -> str | None:
    """The article's own curated thumbnail - far more reliable than a Commons
    keyword search, which full-text matches file names/descriptions and can
    return something only tangentially (or completely un-) related."""
    try:
        resp = await client.get(
            SUMMARY_URL.format(title=keyword.replace(" ", "_")),
            headers={"User-Agent": USER_AGENT},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if data.get("type") == "disambiguation":
            return None
        url = (data.get("thumbnail") or {}).get("source")
        return url if url and _looks_like_real_photo(url) else None
    except Exception:
        return None


async def _commons_search(client: httpx.AsyncClient, keyword: str) -> str | None:
    params = {
        "action": "query",
        "format": "json",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {keyword}",
        "gsrnamespace": "6",  # File namespace
        "gsrlimit": "1",
        "prop": "imageinfo",
        "iiprop": "url",
        "iiurlwidth": "500",
    }
    try:
        resp = await client.get(COMMONS_API, params=params, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        data = resp.json()

        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            infos = page.get("imageinfo") or []
            if infos:
                return infos[0].get("thumburl") or infos[0].get("url")
        return None
    except Exception as exc:
        logger.warning("Commons search failed for %r: %s", keyword, exc)
        return None


async def fetch_image_url(keyword: str | None) -> str | None:
    if not keyword:
        return None

    key = keyword.strip().lower()
    if key in _cache:
        return _cache[key]

    async with httpx.AsyncClient(timeout=8) as client:
        url = await _wikipedia_thumbnail(client, keyword)
        if not url:
            url = await _commons_search(client, keyword)

    _cache[key] = url
    return url
