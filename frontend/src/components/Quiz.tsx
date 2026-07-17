import { useState } from "react";
import type { Category, Question } from "../lib/types";
import { fetchHintDetails } from "../lib/hint";
import type { HintDetails } from "../lib/hint";

type Props = {
  category: Category;
  questions: Question[];
  onFinish: (score: number) => void;
};

type HintState =
  | { status: "closed" }
  | { status: "loading" }
  | { status: "open"; details: HintDetails };

function hintTerm(item: Question): string {
  return item.topic ?? item.image_keyword ?? item.options[item.answer];
}

// Splits the question text around the topic word/phrase (case-insensitive,
// preserving the original casing from the question) so it can be rendered
// as a distinct clickable span, e.g. "What is a **cosmonaut**?" - null if
// the topic doesn't appear verbatim (paraphrased by the model), in which
// case the question renders as plain text and the hint button still works.
function splitOnTopic(question: string, topic: string | null): [string, string, string] | null {
  if (!topic) return null;
  const idx = question.toLowerCase().indexOf(topic.toLowerCase());
  if (idx === -1) return null;
  return [question.slice(0, idx), question.slice(idx, idx + topic.length), question.slice(idx + topic.length)];
}

export default function Quiz({ category, questions, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [hint, setHint] = useState<HintState>({ status: "closed" });

  const item = questions[index];
  const isLast = index === questions.length - 1;
  const letters = ["A", "B", "C", "D"];
  const hintOpen = hint.status !== "closed";
  const split = splitOnTopic(item.question, item.topic);

  const select = (i: number) => {
    if (choice !== null) return;
    setChoice(i);
    if (i === item.answer) setScore((s) => s + 1);
  };

  const next = () => {
    setHint({ status: "closed" });
    if (!isLast) {
      setIndex((i) => i + 1);
      setChoice(null);
    } else {
      onFinish(score);
    }
  };

  const openHint = async () => {
    if (hint.status === "loading") return;
    if (hint.status === "open") {
      setHint({ status: "closed" });
      return;
    }
    setHint({ status: "loading" });
    const details = await fetchHintDetails(hintTerm(item));
    setHint({ status: "open", details });
  };

  return (
    <div className={`quiz-layout ${hintOpen ? "hint-open" : ""}`}>
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
              aria-expanded={hintOpen}
              onClick={openHint}
            >
              {hint.status === "loading" ? "Loading…" : hintOpen ? "💡 Hide hint" : "💡 Hint"}
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

        <p className="question-text">
          {split ? (
            <>
              {split[0]}
              <button
                type="button"
                className="topic-highlight"
                aria-expanded={hintOpen}
                onClick={openHint}
                title="Get a hint about this"
              >
                {split[1]}
              </button>
              {split[2]}
            </>
          ) : (
            item.question
          )}
        </p>

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

      {hintOpen && (
        <aside className="hint-drawer">
          <div className="hint-drawer-header">
            <span>About this</span>
            <button
              type="button"
              className="hint-drawer-close"
              aria-label="Close hint"
              onClick={() => setHint({ status: "closed" })}
            >
              ×
            </button>
          </div>
          {hint.status === "loading" && (
            <div className="hint-drawer-loading">Looking it up…</div>
          )}
          {hint.status === "open" && (
            <div className="hint-drawer-body">
              {hint.details.imageUrl && (
                <img
                  className="hint-drawer-image"
                  src={hint.details.imageUrl}
                  alt=""
                  loading="lazy"
                />
              )}
              <p>{hint.details.text ?? "No extra description found for this one."}</p>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}
