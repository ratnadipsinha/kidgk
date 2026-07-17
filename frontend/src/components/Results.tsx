import type { Category } from "../lib/types";

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

  return (
    <div className="results">
      <div className="result-label">
        {category.emoji} {category.name.toUpperCase()} ROUND COMPLETE
      </div>
      <div className="score-big">
        {score}
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
