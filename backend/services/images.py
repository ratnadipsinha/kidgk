import logging

import httpx

logger = logging.getLogger("kidgk.images")

COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# Per-process cache: image_keyword -> url (or None if no safe result was found).
# Keeps repeated categories/keywords from re-hitting the API every round.
_cache: dict[str, str | None] = {}


async def fetch_image_url(keyword: str | None) -> str | None:
    if not keyword:
        return None

    key = keyword.strip().lower()
    if key in _cache:
        return _cache[key]

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
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                COMMONS_API,
                params=params,
                headers={
                    "User-Agent": "KidGK-Quiz-App/0.1 "
                    "(https://github.com/ratnadipsinha/kidgk; educational demo)"
                },
            )
            resp.raise_for_status()
            data = resp.json()

        pages = data.get("query", {}).get("pages", {})
        url = None
        for page in pages.values():
            infos = page.get("imageinfo") or []
            if infos:
                url = infos[0].get("thumburl") or infos[0].get("url")
                break

        _cache[key] = url
        return url
    except Exception as exc:
        logger.warning("Image lookup failed for %r: %s", keyword, exc)
        _cache[key] = None
        return None
