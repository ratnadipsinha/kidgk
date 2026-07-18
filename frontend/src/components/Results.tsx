import { useEffect, useState } from "react";
import type { Category } from "../lib/types";
import Confetti from "./Confetti";

type Props = {
  category: Category;
  score: number;
  total: number;
  grade: number;
  gradeChange: "up" | "down" | null;
  onPlayAgain: () => void;
  onNewSpin: () => void;
};

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
  const msg =
    pct === 1
      ? `Perfect score! You know your ${category.name.toLowerCase()} facts inside out.`
      : pct >= 0.6
      ? `Nice work — solid grasp of ${category.name.toLowerCase()}.`
      : "Good try — spin again and give it another go!";

  const [burst, setBurst] = useState(0);
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    // Celebrate good rounds with confetti (great scores get two bursts).
    if (pct >= 0.6) {
      setBurst(1);
      if (pct === 1) {
        const t = setTimeout(() => setBurst(2), 350);
        return () => clearTimeout(t);
      }
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
    <div className={`results ${pct === 1 ? "results-perfect" : ""}`}>
      {burst > 0 && <Confetti burst={burst} originY={0.3} />}
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
