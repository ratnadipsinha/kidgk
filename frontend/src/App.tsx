import { useState } from "react";
import { CATEGORIES } from "./lib/categories";
import { getRound } from "./lib/questions";
import type { Category, Question, RoundSource } from "./lib/types";
import SpinWheel from "./components/SpinWheel";
import CategoryCards from "./components/CategoryCards";
import CustomUpload from "./components/CustomUpload";
import Quiz from "./components/Quiz";
import Results from "./components/Results";
import ShootingStars from "./components/ShootingStars";

type Screen = "wheel" | "custom-upload" | "loading" | "quiz" | "results" | "error";

const MIN_GRADE = 4;
const MAX_GRADE = 10;

const CUSTOM_CATEGORY: Category = {
  id: "custom",
  name: "Custom",
  emoji: "📷",
  color: "#ff5da2",
};

function nextGrade(currentGrade: number, score: number, total: number): number {
  const pct = total > 0 ? score / total : 0;
  if (pct >= 0.9) return Math.min(MAX_GRADE, currentGrade + 1);
  if (pct <= 0.4) return Math.max(MIN_GRADE, currentGrade - 1);
  return currentGrade;
}

export default function App() {
  const [grade, setGrade] = useState(MIN_GRADE);
  const [gradeChange, setGradeChange] = useState<"up" | "down" | null>(null);
  const [screen, setScreen] = useState<Screen>("wheel");
  const [category, setCategory] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [source, setSource] = useState<RoundSource | "custom" | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startRound = async (cat: Category) => {
    setCategory(cat);
    setScreen("loading");
    try {
      const round = await getRound(cat.id, grade, 20);
      setQuestions(round.questions);
      setSource(round.source);
      setScreen("quiz");
    } catch {
      setError("Could not load questions for this round.");
      setScreen("error");
    }
  };

  // After the 5th question, adjust the rest of the round based on how the
  // student is doing: 4-5/5 correct -> remaining questions step up a grade,
  // 0-2/5 -> step down. Returns replacement questions for the rest of the
  // round, or null to keep going unchanged. Custom (photo) rounds are
  // excluded - their content comes from the uploaded text, not a grade pool.
  const midRoundAdjust = async (
    scoreSoFar: number,
    alreadySeen: string[]
  ): Promise<{ questions: Question[]; direction: "up" | "down" } | null> => {
    if (!category || category.id === "custom") return null;
    let delta = 0;
    if (scoreSoFar >= 4) delta = 1;
    else if (scoreSoFar <= 2) delta = -1;
    if (delta === 0) return null;
    const newGrade = Math.min(MAX_GRADE, Math.max(MIN_GRADE, grade + delta));
    if (newGrade === grade) return null;
    try {
      const round = await getRound(category.id, newGrade, 15, alreadySeen);
      if (round.questions.length === 0) return null;
      setGrade(newGrade);
      return { questions: round.questions, direction: delta > 0 ? "up" : "down" };
    } catch {
      return null;
    }
  };

  const startCustom = () => {
    setCategory(CUSTOM_CATEGORY);
    setScreen("custom-upload");
  };

  const onCustomReady = (qs: Question[]) => {
    setQuestions(qs);
    setSource("custom");
    setScreen("quiz");
  };

  const finishQuiz = (finalScore: number) => {
    setScore(finalScore);
    const updated = nextGrade(grade, finalScore, questions.length);
    setGradeChange(updated > grade ? "up" : updated < grade ? "down" : null);
    setGrade(updated);
    setScreen("results");
  };

  const backToWheel = () => {
    setScreen("wheel");
    setCategory(null);
    setQuestions([]);
    setGradeChange(null);
  };

  const playAgain = () => {
    if (!category) return;
    if (category.id === "custom") {
      setScreen("custom-upload");
    } else {
      startRound(category);
    }
  };

  return (
    <div className="page">
      <ShootingStars />
      <header>
        <div className="title-wrap">
          <span className="title-side" aria-hidden="true">🪐</span>
          <div className="title-banner">
            <p className="title-text">
              Kid<span className="accent">GK</span>
            </p>
          </div>
          <span className="title-side" aria-hidden="true">🚀</span>
        </div>
        <h1>
          {screen === "wheel" && "Spin the wheel, get your category"}
          {screen === "custom-upload" && "Make a quiz from your own photo"}
          {screen === "loading" && `Loading your ${category?.name} round…`}
          {screen === "quiz" && `${category?.emoji} ${category?.name} round`}
          {screen === "results" && "Round complete"}
          {screen === "error" && "Something went wrong"}
        </h1>
        {(screen === "wheel" || screen === "custom-upload") && (
          <div className="grade-select">
            <label htmlFor="grade">Grade:</label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
            >
              {Array.from({ length: MAX_GRADE - MIN_GRADE + 1 }, (_, i) => MIN_GRADE + i).map(
                (g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                )
              )}
            </select>
            <span className="grade-hint">Adjusts automatically as you play</span>
          </div>
        )}
      </header>

      {screen === "wheel" && (
        <div className="picker-row">
          <SpinWheel categories={CATEGORIES} onSelect={startRound} />
          <CategoryCards
            categories={CATEGORIES}
            onSelect={startRound}
            onCustomSelect={startCustom}
          />
        </div>
      )}

      {screen === "custom-upload" && (
        <CustomUpload grade={grade} onReady={onCustomReady} onCancel={backToWheel} />
      )}

      {screen === "loading" && <div className="loading">Fetching questions…</div>}

      {screen === "quiz" && category && questions.length > 0 && (
        <>
          <Quiz
            category={category}
            questions={questions}
            onFinish={finishQuiz}
            onCheckpoint={source === "custom" ? undefined : midRoundAdjust}
          />
          {source === "wikipedia" && (
            <p className="source-note">
              Groq is unavailable right now — these questions were built from Wikipedia instead.
            </p>
          )}
          {source === "fallback" && (
            <p className="source-note">
              Using the offline fallback bank — live question sources are unavailable.
            </p>
          )}
        </>
      )}

      {screen === "results" && category && (
        <Results
          category={category}
          score={score}
          total={questions.length}
          grade={grade}
          gradeChange={gradeChange}
          onPlayAgain={playAgain}
          onNewSpin={backToWheel}
        />
      )}

      {screen === "error" && (
        <div className="error-box">
          <p>{error}</p>
          <button className="primary" onClick={backToWheel}>
            Back to wheel
          </button>
        </div>
      )}
    </div>
  );
}
