import { useState } from "react";
import type { Category, Question } from "../lib/types";
import { fetchHintDetails } from "../lib/hint";
import type { HintDetails } from "../lib/hint";
import Confetti from "./Confetti";

type Props = {
  category: Category;
  questions: Question[];
  onFinish: (score: number) => void;
  // Called once, right after the 5th question is answered, with the score so
  // far (0-5). May return replacement questions for the REST of the round
  // (harder or easier), or null to continue unchanged.
  onCheckpoint?: (
    scoreSoFar: number
  ) => Promise<{ questions: Question[]; direction: "up" | "down" } | null>;
};

const CHECKPOINT_AFTER = 5;

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

export default function Quiz({ category, questions, onFinish, onCheckpoint }: Props) {
  // Local copy so the checkpoint can swap the not-yet-seen remainder of the
  // round for harder/easier questions without the parent re-mounting us.
  const [items, setItems] = useState<Question[]>(questions);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [hint, setHint] = useState<HintState>({ status: "closed" });
  const [adjusting, setAdjusting] = useState(false);
  const [difficultyNote, setDifficultyNote] = useState<"up" | "down" | null>(null);
  // Count of consecutive questions on which the hint was used. Using it on 3
  // questions in a row locks the hint for the next question, to nudge the
  // student to try on their own. Answering a question without the hint resets
  // the streak.
  const [hintStreak, setHintStreak] = useState(0);
  const [usedHintThisQuestion, setUsedHintThisQuestion] = useState(false);
  const [confettiBurst, setConfettiBurst] = useState(0);
  const [shake, setShake] = useState(false);

  const item = items[index];
  const isLast = index === items.length - 1;
  const letters = ["A", "B", "C", "D"];
  const hintOpen = hint.status !== "closed";
  const split = splitOnTopic(item.question, item.topic);
  const hintLocked = hintStreak >= 3;

  const select = (i: number) => {
    if (choice !== null) return;
    setChoice(i);
    if (i === item.answer) {
      setScore((s) => s + 1);
      setConfettiBurst((b) => b + 1);
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 420);
    }
  };

  const next = async () => {
    setHint({ status: "closed" });
    // Update the consecutive-hint streak based on this question.
    setHintStreak((s) => (usedHintThisQuestion ? s + 1 : 0));
    setUsedHintThisQuestion(false);
    if (isLast) {
      onFinish(score);
      return;
    }

    // Checkpoint: just answered the 5th question of a longer round.
    if (index === CHECKPOINT_AFTER - 1 && onCheckpoint && items.length > CHECKPOINT_AFTER) {
      setAdjusting(true);
      const result = await onCheckpoint(score);
      setAdjusting(false);
      if (result) {
        const remaining = items.length - CHECKPOINT_AFTER;
        setItems([
          ...items.slice(0, CHECKPOINT_AFTER),
          ...result.questions.slice(0, remaining),
        ]);
        setDifficultyNote(result.direction);
      }
    }

    setIndex((i) => i + 1);
    setChoice(null);
  };

  const openHint = async () => {
    if (hint.status === "loading") return;
    if (hint.status === "open") {
      setHint({ status: "closed" });
      return;
    }
    if (hintLocked) return;
    setUsedHintThisQuestion(true);
    setHint({ status: "loading" });
    const details = await fetchHintDetails(hintTerm(item));
    setHint({ status: "open", details });
  };

  return (
    <div className={`quiz-layout ${hintOpen ? "hint-open" : ""}`}>
      <Confetti burst={confettiBurst} />
      <div className="quiz">
        <div className="quiz-top">
          <div className="quiz-cat">
            <span className="swatch" style={{ background: category.color }} />
            {category.emoji} {category.name}
          </div>
          <div className="quiz-top-right">
            <div className="quiz-score">
              Question {index + 1} of {items.length} · Score {score}
            </div>
            <button
              type="button"
              className="hint-btn"
              aria-expanded={hintOpen}
              onClick={openHint}
              disabled={hintLocked && !hintOpen}
              title={hintLocked ? "Try this one on your own!" : undefined}
            >
              {hintLocked && !hintOpen
                ? "💡 Try on your own"
                : hint.status === "loading"
                ? "Loading…"
                : hintOpen
                ? "💡 Hide hint"
                : "💡 Hint"}
            </button>
          </div>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(index / items.length) * 100}%` }}
          />
        </div>

        {difficultyNote && index >= CHECKPOINT_AFTER && (
          <div className={`difficulty-note difficulty-note-${difficultyNote}`}>
            {difficultyNote === "up"
              ? "🔥 Great start — the questions just got a bit harder!"
              : "💪 Adjusted — the questions are a bit easier from here."}
          </div>
        )}

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
                disabled={hintLocked && !hintOpen}
                title={hintLocked ? "Try this one on your own!" : "Get a hint about this"}
              >
                {split[1]}
              </button>
              {split[2]}
            </>
          ) : (
            item.question
          )}
        </p>

        <div className={`options ${shake ? "options-shake" : ""}`}>
          {item.options.map((opt, i) => {
            let cls = `option option--${letters[i].toLowerCase()}`;
            if (choice !== null) {
              if (i === item.answer) cls += " correct correct-blast";
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
                <span className="opt-check" aria-hidden="true" />
                <span>
                  {letters[i]}. {opt}
                </span>
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
          <button className="primary" disabled={choice === null || adjusting} onClick={next}>
            {adjusting ? "Adjusting difficulty…" : isLast ? "See results" : "Next question"}
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
