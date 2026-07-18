import { useEffect, useRef } from "react";

type Props = {
  burst: number; // bump this number to trigger a new fireworks show
};

const COLORS = ["#ff5da2", "#ff8a3d", "#f6c744", "#3fb8dd", "#8dc63f", "#8b5cf6", "#ff3d3d"];

type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  maxLife: number;
};

type Rocket = {
  x: number;
  y: number;
  targetY: number;
  vy: number;
  color: string;
  exploded: boolean;
  trail: { x: number; y: number }[];
  launchDelay: number;
};

/** A short rocket-launch + firework-burst show for a great score - bigger and
 * more dramatic than the plain confetti burst used for a single correct
 * answer. Canvas-based, no external library, cleans itself up. */
export default function Fireworks({ burst }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (burst === 0) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const rocketCount = 5;
    // launchDelay is in animation frames (~60fps), not wall-clock ms - a
    // plain incrementing frame counter (like Confetti.tsx uses) instead of
    // performance.now() timestamps, since headless-browser virtual time
    // doesn't reliably advance performance.now() in step with rAF callbacks.
    const rockets: Rocket[] = Array.from({ length: rocketCount }, (_, i) => {
      const x = width * (0.18 + Math.random() * 0.64);
      const targetY = height * (0.18 + Math.random() * 0.3);
      return {
        x,
        y: height + 20,
        targetY,
        vy: -(9 + Math.random() * 3),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        exploded: false,
        trail: [],
        launchDelay: i * 16 + Math.random() * 8,
      };
    });

    let sparks: Spark[] = [];
    let frameCount = 0;
    const gravity = 0.12;

    function explode(rocket: Rocket) {
      const count = 46;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15;
        const speed = 2.5 + Math.random() * 3.5;
        sparks.push({
          x: rocket.x,
          y: rocket.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: rocket.color,
          life: 0,
          maxLife: 50 + Math.random() * 20,
        });
      }
    }

    function tick() {
      frameCount++;
      ctx!.clearRect(0, 0, width, height);

      let anyActive = false;
      for (const rocket of rockets) {
        if (frameCount < rocket.launchDelay) {
          anyActive = true;
          continue;
        }
        if (!rocket.exploded) {
          anyActive = true;
          rocket.trail.push({ x: rocket.x, y: rocket.y });
          if (rocket.trail.length > 10) rocket.trail.shift();
          rocket.y += rocket.vy;
          if (rocket.y <= rocket.targetY) {
            rocket.exploded = true;
            explode(rocket);
          } else {
            ctx!.save();
            ctx!.strokeStyle = rocket.color;
            ctx!.lineWidth = 3;
            ctx!.lineCap = "round";
            ctx!.globalAlpha = 0.8;
            ctx!.beginPath();
            rocket.trail.forEach((p, i) => {
              if (i === 0) ctx!.moveTo(p.x, p.y);
              else ctx!.lineTo(p.x, p.y);
            });
            ctx!.stroke();
            ctx!.restore();
          }
        }
      }

      sparks = sparks.filter((s) => s.life < s.maxLife);
      for (const s of sparks) {
        s.vy += gravity;
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        const fade = 1 - s.life / s.maxLife;
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, fade);
        ctx!.fillStyle = s.color;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, 2.6, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }
      if (sparks.length > 0) anyActive = true;

      if (anyActive && frameCount < 400) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx!.clearRect(0, 0, width, height);
      }
    }

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burst]);

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
