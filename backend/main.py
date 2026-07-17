import logging
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from services.questions import CATEGORIES, get_round
from services.updater import check_for_update, trigger_update

load_dotenv()
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="KidGK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RoundRequest(BaseModel):
    category: str
    grade: int = 5
    count: int = 5


@app.get("/api/categories")
def list_categories():
    return CATEGORIES


@app.post("/api/round")
async def create_round(req: RoundRequest):
    try:
        return await get_round(req.category, req.grade, req.count)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/update/check")
def update_check():
    return check_for_update()


@app.post("/api/update/apply")
def update_apply():
    trigger_update()
    return {"status": "started"}


# Serves the pre-built frontend (frontend/dist, built via `npm run build`
# and committed to git - see DEPLOYMENT.md) so the app runs as a single
# process on one port with no Node.js needed at runtime. Mounted last so
# it never shadows the /api/* routes above: Starlette checks routes in
# registration order, and a "/" mount would otherwise match everything.
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
