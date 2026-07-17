import { useState } from "react";
import { CATEGORIES } from "./lib/categories";
import { getRound } from "./lib/questions";
import type { Category, Question, RoundSource } from "./lib/types";
import SpinWheel from "./components/SpinWheel";
import Quiz from "./components/Quiz";
import Results from "./components/Results";

type Screen = "wheel" | "loading" | "quiz" | "results" | "error";

export default function App() {
  const [grade, setGrade] = useState(5);
  const [screen, setScreen] = useState<Screen>("wheel");
  const [category, setCategory] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [source, setSource] = useState<RoundSource | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startRound = async (cat: Category) => {
    setCategory(cat);
    setScreen("loading");
    try {
      const round = await getRound(cat.id, grade, 5);
      setQuestions(round.questions);
      setSource(round.source);
      setScreen("quiz");
    } catch {
      setError("Could not load questions for this round.");
      setScreen("error");
    }
  };

  const finishQuiz = (finalScore: number) => {
    setScore(finalScore);
    setScreen("results");
  };

  const backToWheel = () => {
    setScreen("wheel");
    setCategory(null);
    setQuestions([]);
  };

  return (
    <div className="page">
      <header>
        <div className="eyebrow">KidGK</div>
        <h1>
          {screen === "wheel" && "Spin the wheel, get your category"}
          {screen === "loading" && `Loading your ${category?.name} round…`}
          {screen === "quiz" && `${category?.emoji} ${category?.name} round`}
          {screen === "results" && "Round complete"}
          {screen === "error" && "Something went wrong"}
        </h1>
        {screen === "wheel" && (
          <div className="grade-select">
            <label htmlFor="grade">Grade:</label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
            >
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
            </select>
          </div>
        )}
      </header>

      {screen === "wheel" && (
        <SpinWheel categories={CATEGORIES} onSelect={startRound} />
      )}

      {screen === "loading" && <div className="loading">Fetching questions…</div>}

      {screen === "quiz" && category && questions.length > 0 && (
        <>
          <Quiz category={category} questions={questions} onFinish={finishQuiz} />
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
          onPlayAgain={() => startRound(category)}
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
