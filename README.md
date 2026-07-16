# KidGK — AI-Powered General Knowledge Quiz App

Spin a wheel to pick a category, then take a 5-question quiz. Questions are generated
live by Groq (`backend/services/groq_client.py`), falling back to Wikipedia-derived
facts (`backend/services/wikipedia_fallback.py`) if Groq is unavailable or rate-limited,
and finally to a small offline bank (`backend/data/fallback_questions.json`) as a last
resort. See [GK-Quiz-App-Proposal.md](GK-Quiz-App-Proposal.md) for the full design.

## Run locally

**Backend**

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # then add your GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

**Frontend**

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend on port 8000.

Without a `GROQ_API_KEY`, every round automatically falls back to Wikipedia, then the
offline question bank.

## Playing it day-to-day

`scripts\launch.ps1` is the normal way to run the app after initial setup: it starts
the backend/frontend if they're not already running, opens KidGK in its own app window
(no tabs/address bar), and **stops the backend/frontend automatically the moment that
window is closed** — nothing keeps running in the background afterward. The installer's
Desktop/Start Menu shortcut runs this same script.

`scripts\start-app.ps1` / `scripts\stop-app.ps1` are the lower-level building blocks if
you want to start/stop without the browser window (e.g. for scripting).

## Updating

There's no automatic polling — updates are pulled on demand via the **"Check for
updates"** button in the app's footer, which checks `origin/main` and, if there's
something new, stops the app, pulls, reinstalls any changed dependencies, and restarts
itself. You can also trigger the same thing manually:

```
powershell -ExecutionPolicy Bypass -File scripts\update.ps1
```

## One-click installer

`installer/kidgk-setup.iss` builds a self-contained Windows installer that bundles
Git/Python/Node so a target PC needs nothing pre-installed. See
[installer/README.md](installer/README.md) for how to build and distribute it.

## Project structure

```
backend/    FastAPI app, Groq client, Wikipedia fallback, offline question bank
frontend/   React + TypeScript (Vite) — spin wheel, quiz, results, update button
scripts/    launch/start/stop/update tooling
installer/  One-click Windows installer (Inno Setup)
```
