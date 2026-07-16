import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.questions import CATEGORIES, get_round

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
