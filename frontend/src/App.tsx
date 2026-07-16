import { useEffect, useState } from "react";
import { fetchCategories, fetchRound } from "./api";
import type { Category, Question } from "./api";
import SpinWheel from "./components/SpinWheel";
import Quiz from "./components/Quiz";
import Results from "./components/Results";

type Screen = "wheel" | "loading" | "quiz" | "results" | "error";

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [grade, setGrade] = useState(5);
  const [screen, setScreen] = useState<Screen>("wheel");
  const [category, setCategory] = useState<Category | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [source, setSource] = useState<"groq" | "fallback" | null>(null);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch(() => setError("Could not reach the KidGK backend. Is it running?"));
  }, []);

  const startRound = async (cat: Category) => {
    setCategory(cat);
    setScreen("loading");
    try {
      const round = await fetchRound(cat.id, grade, 5);
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

      {screen === "wheel" && categories.length > 0 && (
        <SpinWheel categories={categories} onSelect={startRound} />
      )}

      {screen === "loading" && <div className="loading">Fetching questions…</div>}

      {screen === "quiz" && category && questions.length > 0 && (
        <>
          <Quiz category={category} questions={questions} onFinish={finishQuiz} />
          {source === "fallback" && (
            <p className="source-note">
              Using the offline fallback bank — live Groq generation unavailable.
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
