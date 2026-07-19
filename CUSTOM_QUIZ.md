# Custom (photo) quiz — how it works and key setup

The "Custom" category lets a student upload a photo of a textbook page or
notes and get a 5-question quiz generated from its actual content. There is
no backend — everything runs client-side in the static app, calling two LLM
providers directly from the browser.

## Flow

```
CustomUpload.tsx
  ├─ Gemini configured? ──yes──▶ geminiVision.ts ──▶ Gemini 2.x vision model
  │                                (image sent directly, no OCR step)
  └─ not configured ──────────▶ ocr.ts (tesseract.js, in-browser OCR)
                                   └─▶ customQuestions.ts ──▶ Groq (text-only LLM)
```

- **Preferred path (Gemini vision):** the photo is sent straight to Gemini's
  vision model. It reads the page's real layout (headings, paragraphs,
  labelled diagrams) far more reliably than OCR, and is asked to first
  identify the subject being taught, then write questions about it.
- **Fallback path (no Gemini key):** the photo is OCR'd in-browser with
  `tesseract.js`, boilerplate lines are stripped (page numbers, dates,
  chapter headers), and the cleaned text is sent to Groq's text LLM with the
  same "identify the subject, then quiz on it" two-step prompt.
- Both paths validate the model's JSON response (exactly 4 options, valid
  answer index, etc.) and run it through `safety.ts` before showing it.

Relevant files: [CustomUpload.tsx](frontend/src/components/CustomUpload.tsx),
[geminiVision.ts](frontend/src/lib/geminiVision.ts),
[customQuestions.ts](frontend/src/lib/customQuestions.ts),
[ocr.ts](frontend/src/lib/ocr.ts), [config.ts](frontend/src/lib/config.ts).

## LLM keys

This app is a fully static site (GitHub Pages) with **no server**, so both
keys ultimately live in the browser bundle or the browser's `localStorage` —
there's no way around that for a client-only app. The two providers are
handled differently because of how each one reacts to a leaked key:

### Groq key — committed, public by design

`frontend/src/lib/config.ts` hardcodes `GROQ_API_KEY` directly in source.
This is intentional: Groq doesn't auto-revoke keys found in public repos, and
the key is only ever used for question generation (low value if abused). If
it ever gets rate-limited or abused, rotate it at
[console.groq.com](https://console.groq.com).

### Gemini key — never committed, two ways to supply it

Google's key-scanner **automatically revokes any Gemini/API key it finds
committed to a public repo**, usually within minutes — this happened once
already in this project. So the Gemini key is never written to source. It's
supplied one of two ways, checked in this order by `getGeminiKey()`:

1. **User-entered key (`localStorage`)** — if no key is configured yet,
   `CustomUpload.tsx` shows a one-time setup screen asking the student/parent
   to paste a free key from
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey). It's
   saved via `setGeminiKey()` to `localStorage` under `kidgk_gemini_key`,
   scoped to that browser only — never sent anywhere except directly to
   Google's API.
2. **Build-time key (GitHub Actions secret)** — the repo has a
   `GEMINI_API_KEY` secret in *Settings → Secrets and variables → Actions*.
   `.github/workflows/deploy-pages.yml` injects it as
   `VITE_GEMINI_API_KEY` during `npm run build`, and Vite bakes it into the
   bundle as `import.meta.env.VITE_GEMINI_API_KEY`. This means the publicly
   deployed site works out of the box with no manual key entry — but anyone
   building the app locally without that secret falls back to option 1.

`geminiConfigured()` just checks whether either source produced a key longer
than 10 characters.

**Rule going forward: never paste a raw Gemini key into chat, a commit, or
any file in this repo.** Enter it only into the app's own "paste your key"
screen (goes straight to `localStorage`), or update the `GEMINI_API_KEY` repo
secret directly on GitHub.
