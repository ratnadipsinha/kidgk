import { useState } from "react";
import type { Category, Question } from "../lib/types";

type Props = {
  category: Category;
  questions: Question[];
  onFinish: (score: number) => void;
};

export default function Quiz({ category, questions, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);

  const item = questions[index];
  const isLast = index === questions.length - 1;
  const letters = ["A", "B", "C", "D"];

  const select = (i: number) => {
    if (choice !== null) return;
    setChoice(i);
    if (i === item.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (!isLast) {
      setIndex((i) => i + 1);
      setChoice(null);
    } else {
      onFinish(score);
    }
  };

  return (
    <div className="quiz">
      <div className="quiz-top">
        <div className="quiz-cat">
          <span className="swatch" style={{ background: category.color }} />
          {category.emoji} {category.name}
        </div>
        <div className="quiz-score">
          Question {index + 1} of {questions.length} · Score {score}
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
