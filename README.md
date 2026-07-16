# KidGK — AI-Powered General Knowledge Quiz App

Spin a wheel to pick a category, then take a 5-question quiz. Questions are generated
live by Groq (`backend/services/groq_client.py`) with an offline fallback bank
(`backend/data/fallback_questions.json`) used if the API is unavailable or unconfigured.
See [GK-Quiz-App-Proposal.md](GK-Quiz-App-Proposal.md) for the full design.

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

Without a `GROQ_API_KEY`, every round automatically falls back to the offline question bank.

## Keeping a deployed (target) PC up to date

`scripts/update.ps1` pulls `origin/main` and reinstalls backend/frontend dependencies
if anything changed. Run it manually, or register it as a recurring scheduled task:

```
powershell -ExecutionPolicy Bypass -File scripts\register-auto-update.ps1
```

This creates a Windows Task Scheduler task (`KidGK-AutoUpdate`) that checks for and
pulls updates every 15 minutes. To remove it:

```
Unregister-ScheduledTask -TaskName "KidGK-AutoUpdate" -Confirm:$false
```

## Project structure

```
backend/    FastAPI app, Groq client, fallback question bank
frontend/   React + TypeScript (Vite) — spin wheel, quiz, results screens
scripts/    Update / auto-update tooling for deployed machines
```
