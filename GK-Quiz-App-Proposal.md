# Proposal: KidGK — AI-Powered General Knowledge Quiz App

**Target audience:** Students in Grades 4, 5, and 6 (ages 9–12)
**Prepared by:** Digital Nexa
**Date:** July 2026

---

## 1. Overview

KidGK is an interactive general knowledge quiz application for upper-primary students. Instead of a fixed question bank, questions are **auto-generated in real time by an LLM** (Groq free-tier API), giving students a fresh quiz every session while keeping content costs at zero.

## 2. Core User Flow

1. **Select grade** — Grade 4, 5, or 6 (controls difficulty of generated questions)
2. **Select category** — two ways to pick:
   - **Tap a category card**, or
   - **Spin the wheel** — a colorful 6-segment spinner (one slice per category) that the student taps to spin; it randomly lands on a category, adding a fun, game-show-style element for kids who want a surprise topic
   - Categories:
     - 🪐 Space (planets, stars, solar system)
     - 🦁 Wildlife (animals, birds, habitats)
     - 🌍 Countries (capitals, flags, landmarks)
     - 👤 Famous People (scientists, leaders, inventors)
     - 🔬 Science (everyday science, human body)
     - 🏛️ History (civilizations, key events)
   - *(Category list is config-driven — new categories can be added without code changes; the wheel auto-adjusts its slice count to match)*
3. **Take the quiz** — 10 questions per round
4. **See results** — score, correct answers with one-line explanations, "Play Again" / "New Category" / "Spin Again"

### 2.1 Spin Wheel — Random Category Selection

Instead of always tapping a card, students can spin a wheel to have a category chosen for them at random.

- **UI:** circular wheel divided into equal colored slices (one per active category), a center "Spin" button/hub, spring/ease-out rotation animation (3–5s, multiple rotations before settling), confetti or highlight pulse on the winning slice
- **Randomization:** client picks a random target angle (`Math.random()`-based, weighted evenly across slices) so every category has an equal chance; result is purely cosmetic (no gameplay logic depends on server-side randomness), so it can run fully client-side
- **Behavior:** wheel slice count/labels are generated from the same config-driven category list used by the category cards — no separate data source to maintain
- **Accessibility fallback:** a "Skip — pick for me" text button triggers the same random pick without requiring the animation, for accessibility/reduced-motion users
- **Effort:** small — a single reusable `SpinWheel` component (SVG/canvas + CSS animation) that emits a `categorySelected` event; ~2–3 days within Phase 1

## 3. Question Format

Each question consists of:

| Element | Detail |
|---|---|
| Question text | Age-appropriate, single-concept question |
| Image (optional) | Photo/illustration relevant to the question — e.g., an animal photo ("Which animal is this?") or planet image ("Identify this planet") |
| Options | Exactly 4, presented as radio buttons — one correct, three plausible distractors |
| Explanation | One short line shown after answering (reinforces learning) |

**Two question types:**
- **Text-only** — e.g., "Which planet is known as the Red Planet?"
- **Picture-based** — image shown above the question; the image itself is the subject

## 4. LLM Question Generation Layer (Groq)

**Why Groq:** free tier, very low latency (fast inference on Llama models), OpenAI-compatible API — ideal for real-time question generation at zero cost.

**How it works:**

```
App → Backend API → Groq (llama-3.3-70b / llama-3.1-8b)
                     ↓
        Structured JSON: question, 4 options,
        correct answer, explanation, image_keyword
```

- Backend sends a prompt with: category, grade level, question count, and instruction to return **strict JSON only**
- Prompt enforces: kid-safe content, single correct answer, distractors of similar length, no repeats within a session
- `image_keyword` from the LLM (e.g., "African elephant", "planet Saturn") is used to fetch a matching image from a free image API (Pixabay / Unsplash / Wikimedia Commons) with a local cache
- **Validation layer:** backend validates JSON schema, checks exactly 4 options and 1 correct answer, filters unsafe words; malformed responses are regenerated
- **Fallback:** small offline question bank (50/category) used if the Groq API is unavailable or rate-limited

**Sample generation prompt (simplified):**
> "Generate 10 multiple-choice general knowledge questions about SPACE for a Grade 5 student (age 10–11). Return only JSON array. Each object: question, options (4), answer, explanation (max 15 words), image_keyword (or null for text-only). Mix 6 text and 4 picture-based questions. Kid-safe, factually accurate."

## 5. Technical Architecture

| Layer | Technology |
|---|---|
| Frontend | React (web) / React Native or Flutter (mobile) — category cards, quiz screen with radio buttons, results screen |
| Backend | Node.js / Python (FastAPI) — thin API layer, prompt management, validation, caching |
| LLM | Groq API (free tier) — Llama 3.3 70B for quality, 8B fallback for speed |
| Images | Pixabay / Wikimedia Commons API (free, safe-search enabled) + CDN cache |
| Storage | Lightweight DB (SQLite/Postgres) — cached questions, fallback bank, optional score history |

**Caching strategy:** generated question sets are cached per category+grade for reuse across sessions — cuts API calls ~80% and keeps well within Groq free-tier limits (rate limits apply per minute/day on free tier).

## 6. Kid-Safety & Quality Controls

- System prompt hard-locks content to age-appropriate topics
- Server-side profanity/sensitive-topic filter on every generated question
- Image API safe-search enforced; images reviewed against a blocklist
- Factual accuracy spot-checks: flag-a-question button feeds a review queue
- No ads, no external links, no personal data collection (COPPA/GDPR-K friendly)

## 7. Gamification (Phase 2)

- Streaks, badges per category, difficulty auto-scaling by grade + performance
- Leaderboard (classroom mode, optional)
- Timed challenge mode

## 8. Development Phases

| Phase | Scope | Duration |
|---|---|---|
| 1 — MVP | Categories, Groq generation, text + picture MCQs, results screen, fallback bank | 3–4 weeks |
| 2 — Polish | Gamification, caching optimization, teacher/parent dashboard | 2–3 weeks |
| 3 — Launch | App store deployment / web hosting, analytics, feedback loop | 1–2 weeks |

## 9. Cost Summary

| Item | Cost |
|---|---|
| Groq API | Free tier (rate-limited; paid tier available if scale demands) |
| Image APIs | Free (Pixabay/Wikimedia) |
| Hosting | ~$5–20/month (small VPS or serverless free tiers initially) |
| **Content cost** | **$0 — fully LLM-generated** |

---

*Next steps: confirm platform (web vs mobile-first), finalize category list, and set up a Groq API key to prototype the generation layer.*
