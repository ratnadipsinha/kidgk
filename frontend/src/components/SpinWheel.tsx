import { useEffect, useRef, useState } from "react";
import type { Category } from "../lib/types";

type Props = {
  categories: Category[];
  onSelect: (category: Category) => void;
};

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export default function SpinWheel({ categories, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const [spinning, setSpinning] = useState(false);

  const size = 800;
  const n = categories.length;
  const seg = (Math.PI * 2) / Math.max(n, 1);

  const drawWheel = (rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 6;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    categories.forEach((cat, i) => {
      const start = i * seg;
      const end = start + seg;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = cat.color;
      ctx.fill();

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.rotate(start + seg / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 34px 'Trebuchet MS', sans-serif";
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 4;
      ctx.fillText(`${cat.emoji}  ${cat.name}`, r - 26, 0);
      ctx.restore();
    });

    ctx.restore();
  };

  useEffect(() => {
    drawWheel(rotationRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const spin = () => {
    if (spinning || n === 0) return;
    setSpinning(true);

    const winnerIndex = Math.floor(Math.random() * n);
    const winnerMid = winnerIndex * seg + seg / 2;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = -Math.PI / 2 - winnerMid + Math.PI * 2 * extraSpins;

    const current = rotationRef.current;
    let delta = targetRotation - (current % (Math.PI * 2));
    while (delta < Math.PI * 2 * extraSpins) delta += Math.PI * 2;
    const finalRotation = current + delta;

    const duration = 4200;
    let startTime: number | null = null;

    const frame = (ts: number) => {
      if (startTime === null) startTime = ts;
      const t = Math.min((ts - startTime) / duration, 1);
      const eased = easeOutCubic(t);
      rotationRef.current = current + (finalRotation - current) * eased;
      drawWheel(rotationRef.current);

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        setSpinning(false);
        onSelect(categories[winnerIndex]);
      }
    };
    requestAnimationFrame(frame);
  };

  const skip = () => {
    if (spinning || n === 0) return;
    const winnerIndex = Math.floor(Math.random() * n);
    const angle = -Math.PI / 2 - (winnerIndex * seg + seg / 2);
    rotationRef.current = angle;
    drawWheel(angle);
    onSelect(categories[winnerIndex]);
  };

  return (
    <div className="wheel-block">
      <div className="wheel-wrap">
        <div className="pointer" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          role="img"
          aria-label="Category spin wheel"
        />
        <div
          className="hub"
          role="button"
          tabIndex={0}
          aria-disabled={spinning}
          aria-label="Spin the wheel"
          onClick={spin}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              spin();
            }
          }}
        >
          Spin
        </div>
      </div>
      <div className="actions">
        <button className="primary" disabled={spinning} onClick={spin}>
          Spin the wheel
        </button>
        <button className="ghost" disabled={spinning} onClick={skip}>
          Skip — pick for me
        </button>
      </div>
    </div>
  );
}
