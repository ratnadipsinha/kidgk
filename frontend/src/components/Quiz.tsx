import { useState } from "react";
import type { Category, Question } from "../lib/types";
import { fetchHintText } from "../lib/hint";

type Props = {
  category: Category;
  questions: Question[];
  onFinish: (score: number) => void;
};

type HintState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; text: string }
  | { status: "empty" };

export default function Quiz({ category, questions, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [hint, setHint] = useState<HintState>({ status: "idle" });

  const item = questions[index];
  const isLast = index === questions.length - 1;
  const letters = ["A", "B", "C", "D"];

  const select = (i: number) => {
    if (choice !== null) return;
    setChoice(i);
    if (i === item.answer) setScore((s) => s + 1);
  };

  const next = () => {
    setHint({ status: "idle" });
    if (!isLast) {
      setIndex((i) => i + 1);
      setChoice(null);
    } else {
      onFinish(score);
    }
  };

  const toggleHint = async () => {
    if (hint.status === "loading") return;
    if (hint.status === "ready" || hint.status === "empty") {
      setHint({ status: "idle" });
      return;
    }
    setHint({ status: "loading" });
    const term = item.image_keyword ?? item.options[item.answer];
    const text = await fetchHintText(term);
    setHint(text ? { status: "ready", text } : { status: "empty" });
  };

  return (
    <div className="quiz">
      <div className="quiz-top">
        <div className="quiz-cat">
          <span className="swatch" style={{ background: category.color }} />
          {category.emoji} {category.name}
        </div>
        <div className="quiz-top-right">
          <div className="quiz-score">
            Question {index + 1} of {questions.length} · Score {score}
          </div>
          <button
            type="button"
            className="hint-btn"
            aria-expanded={hint.status === "ready" || hint.status === "empty"}
            onClick={toggleHint}
          >
            {hint.status === "loading" ? "Loading…" : "💡 Hint"}
          </button>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${(index / questions.length) * 100}%` }}
        />
      </div>

      {item.image_url && (
        <img
          className="question-image"
          src={item.image_url}
          alt=""
          loading="lazy"
        />
      )}

      <p className="question-text">{item.question}</p>

      {(hint.status === "ready" || hint.status === "empty") && (
        <div className="hint-panel">
          {hint.status === "ready" ? hint.text : "No extra description found for this one."}
        </div>
      )}

      <div className="options">
        {item.options.map((opt, i) => {
          let cls = "option";
          if (choice !== null) {
            if (i === item.answer) cls += " correct";
            else if (i === choice) cls += " wrong";
          }
          return (
            <button
              key={i}
              type="button"
              className={cls}
              disabled={choice !== null}
              onClick={() => select(i)}
            >
              <span className="key">{letters[i]}</span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {choice !== null && (
        <div className="explain show">
          {choice === item.answer ? "✅ " : "❌ "}
          <b>{choice === item.answer ? "Correct!" : "Not quite."}</b>{" "}
          {item.explanation}
        </div>
      )}

      <div className="quiz-nav">
        <button className="primary" disabled={choice === null} onClick={next}>
          {isLast ? "See results" : "Next question"}
        </button>
      </div>
    </div>
  );
}
