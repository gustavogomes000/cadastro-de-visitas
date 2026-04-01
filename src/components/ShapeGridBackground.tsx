import { useEffect, useRef } from "react";

export function ShapeGridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const SQUARE_SIZE = 48;
    let animId: number;
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      time += 0.006;

      ctx.clearRect(0, 0, w, h);

      // Subtle moving offset for diagonal drift
      const drift = time * 12;
      const offsetX = drift % SQUARE_SIZE;
      const offsetY = drift % SQUARE_SIZE;

      const cols = Math.ceil(w / SQUARE_SIZE) + 2;
      const rows = Math.ceil(h / SQUARE_SIZE) + 2;

      // Draw grid lines (very subtle)
      ctx.strokeStyle = "rgba(236, 72, 153, 0.06)";
      ctx.lineWidth = 0.5;

      for (let col = -1; col <= cols; col++) {
        const x = col * SQUARE_SIZE + offsetX - SQUARE_SIZE;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let row = -1; row <= rows; row++) {
        const y = row * SQUARE_SIZE + offsetY - SQUARE_SIZE;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Animated glow cells — multiple soft waves
      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * SQUARE_SIZE + offsetX - SQUARE_SIZE;
          const y = row * SQUARE_SIZE + offsetY - SQUARE_SIZE;

          // Layered sine waves for organic feel
          const wave1 = Math.sin(col * 0.3 + time * 1.2) * Math.cos(row * 0.25 + time * 0.8);
          const wave2 = Math.sin((col + row) * 0.15 + time * 0.6) * 0.5;
          const wave3 = Math.cos(col * 0.12 - row * 0.18 + time * 1.5) * 0.3;
          const combined = (wave1 + wave2 + wave3) / 1.8;

          if (combined > 0.15) {
            const alpha = (combined - 0.15) * 0.18;
            ctx.fillStyle = `rgba(236, 72, 153, ${Math.min(alpha, 0.12)})`;
            ctx.fillRect(x + 1, y + 1, SQUARE_SIZE - 2, SQUARE_SIZE - 2);
          }
        }
      }

      // Center radial vignette
      const cx = w / 2;
      const cy = h / 2;
      const grad = ctx.createRadialGradient(cx, cy, h * 0.15, cx, cy, h * 0.85);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(1, "rgba(7, 5, 16, 0.6)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ background: "#070510" }}
    />
  );
}
