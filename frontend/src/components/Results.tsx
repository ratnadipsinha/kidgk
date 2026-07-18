import { useEffect, useState } from "react";
import type { Category } from "../lib/types";
import Confetti from "./Confetti";
import Fireworks from "./Fireworks";

type Props = {
  category: Category;
  score: number;
  total: number;
  grade: number;
  gradeChange: "up" | "down" | null;
  onPlayAgain: () => void;
  onNewSpin: () => void;
};

const FIREWORKS_THRESHOLD = 0.8;

export default function Results({
  category,
  score,
  total,
  grade,
  gradeChange,
  onPlayAgain,
  onNewSpin,
}: Props) {
  const pct = score / total;
  const isBlast = pct > FIREWORKS_THRESHOLD;
  const msg =
    pct === 1
      ? `Perfect score! You know your ${category.name.toLowerCase()} facts inside out.`
      : isBlast
      ? `Amazing! You really nailed ${category.name.toLowerCase()}.`
      : pct >= 0.6
      ? `Nice work — solid grasp of ${category.name.toLowerCase()}.`
      : "Good try — spin again and give it another go!";

  const [confettiBurst, setConfettiBurst] = useState(0);
  const [fireworksBurst, setFireworksBurst] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // Scores above 80% get a rocket-launch fireworks show; a solid but lower
    // score still gets a lighter confetti pop instead.
    if (isBlast) {
      setFireworksBurst(1);
    } else if (pct >= 0.6) {
      setConfettiBurst(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Count the score up instead of just showing the final number.
    if (score === 0) {
      setDisplayScore(0);
      return;
    }
    let n = 0;
    const step = () => {
      n += 1;
      setDisplayScore(n);
      if (n < score) requestAnimationFrame(step);
    };
    const start = requestAnimationFrame(step);
    return () => cancelAnimationFrame(start);
  }, [score]);

  return (
    <div className={`results ${isBlast ? "results-perfect" : ""}`}>
      {confettiBurst > 0 && <Confetti burst={confettiBurst} originY={0.3} />}
      {fireworksBurst > 0 && <Fireworks burst={fireworksBurst} />}
      <div className="result-label">
        {category.emoji} {category.name.toUpperCase()} ROUND COMPLETE
      </div>
      <div className="score-big score-pop">
        {displayScore}
        <span className="score-of">/{total}</span>
      </div>
      <p className="score-msg">{msg}</p>
      {gradeChange && (
        <p className={`grade-change grade-change-${gradeChange}`}>
          {gradeChange === "up"
            ? `Nice! Moving up to Grade ${grade} next round.`
            : `Stepping back to Grade ${grade} next round.`}
        </p>
      )}
      <div className="actions">
        <button className="primary" onClick={onPlayAgain}>
          Play again — same category
        </button>
        <button className="ghost" onClick={onNewSpin}>
          Spin a new category
        </button>
      </div>
    </div>
  );
}
