import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  life: number;
  maxLife: number;
};

/** Ambient shooting stars that streak across the background every so often,
 * on every screen - ​a small always-on flourish for the space theme, distinct
 * from the celebratory Confetti/Fireworks bursts. */
export default function ShootingStars() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let stars: Star[] = [];
    let frameCount = 0;
    let nextSpawnFrame = 60 + Math.random() * 120;

    function spawn() {
      const fromLeft = Math.random() > 0.5;
      const y = height * (0.05 + Math.random() * 0.4);
      const speed = 6 + Math.random() * 4;
      stars.push({
        x: fromLeft ? -20 : width + 20,
        y,
        vx: fromLeft ? speed : -speed,
        vy: speed * 0.45,
        len: 70 + Math.random() * 50,
        life: 0,
        maxLife: 40,
      });
    }

    function tick() {
      frameCount++;
      ctx!.clearRect(0, 0, width, height);

      if (frameCount >= nextSpawnFrame) {
        spawn();
        nextSpawnFrame = frameCount + 90 + Math.random() * 180;
      }

      stars = stars.filter((s) => s.life < s.maxLife);
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        s.life++;
        const fade = s.life < 8 ? s.life / 8 : Math.max(0, 1 - (s.life - 8) / (s.maxLife - 8));
        const dirX = s.vx > 0 ? -1 : 1;
        const tailX = s.x + dirX * s.len;
        const tailY = s.y - s.vy * (s.len / Math.abs(s.vx));

        const grad = ctx!.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");

        ctx!.save();
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 2;
        ctx!.lineCap = "round";
        ctx!.beginPath();
        ctx!.moveTo(s.x, s.y);
        ctx!.lineTo(tailX, tailY);
        ctx!.stroke();

        ctx!.globalAlpha = fade;
        ctx!.fillStyle = "#fff";
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, 1.8, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.restore();
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="shooting-star-canvas" aria-hidden="true" />;
}
