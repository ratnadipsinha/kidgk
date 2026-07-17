# KidGK — AI-Powered General Knowledge Quiz App

Spin a wheel to pick a category, then take a 5-question quiz. Questions are generated
live by Groq (`backend/services/groq_client.py`), falling back to Wikipedia-derived
facts (`backend/services/wikipedia_fallback.py`) if Groq is unavailable or rate-limited,
and finally to a small offline bank (`backend/data/fallback_questions.json`) as a last
resort. See [GK-Quiz-App-Proposal.md](GK-Quiz-App-Proposal.md) for the full design.

The app is a single Python process: the FastAPI backend serves both the API and the
pre-built frontend (`frontend/dist`) on one port. Node.js is only needed here on the
dev machine to build the frontend — never on a machine just running the app.

## Run locally

**Backend + frontend (single process, matches how it runs everywhere else)**

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # then add your GROQ_API_KEY
uvicorn main:app --reload --port 8000
```

Open http://localhost:8000 — the backend serves the already-built `frontend/dist`
directly, so this is all you need to play it.

Without a `GROQ_API_KEY`, every round automatically falls back to Wikipedia, then the
offline question bank.

**Frontend development (only if you're changing `frontend/src`)**

```
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 for hot-reload while developing — the Vite dev server
proxies `/api` to the backend on port 8000. When you're done, rebuild the static
bundle the backend actually serves and commit it:

```
npm run build
git add frontend/dist
```

## Playing it day-to-day

`scripts\launch.ps1` is the normal way to run the app after initial setup: it starts
the backend if it's not already running, opens KidGK in its own app window (no tabs/
address bar), and **stops the backend automatically the moment that window is
closed** — nothing keeps running in the background afterward. The installer's
Desktop/Start Menu shortcut runs this same script.

`scripts\start-app.ps1` / `scripts\stop-app.ps1` are the lower-level building blocks if
you want to start/stop without the browser window (e.g. for scripting).

## Updating

There's no automatic polling — updates are pulled on demand via the **"Check for
updates"** button in the app's footer, which checks `origin/main` and, if there's
something new, stops the app, pulls (this refreshes both backend code and the
pre-built frontend), reinstalls any changed Python dependencies, and restarts itself.
You can also trigger the same thing manually:

```
powershell -ExecutionPolicy Bypass -File scripts\update.ps1
```

## One-click installer

`installer/kidgk-setup.iss` builds a self-contained Windows installer that bundles
Git and Python (Node.js is not needed — see above) so a target PC needs nothing
pre-installed. See [installer/README.md](installer/README.md) for how to build and
distribute it, and [DEPLOYMENT.md](DEPLOYMENT.md) for the full source → GitHub →
target PC flow, exactly what the installer does step by step, and how the update
mechanism works end to end.

## Project structure

```
backend/        FastAPI app, Groq client, Wikipedia fallback, offline question bank
frontend/src/   React + TypeScript source — spin wheel, quiz, results, update button
frontend/dist/  Pre-built static bundle (npm run build), committed to git, served
                 directly by the backend
scripts/        launch/start/stop/update tooling
installer/      One-click Windows installer (Inno Setup)
```
