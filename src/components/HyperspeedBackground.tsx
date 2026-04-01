import { useEffect, useRef } from "react";

export function HyperspeedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const lines: { x: number; y: number; z: number; color: string }[] = [];
    const colors = ["#ec4899", "#f43f5e", "#c026d3", "#e879f9", "#fb7185"];
    const NUM_LINES = 120;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    for (let i = 0; i < NUM_LINES; i++) {
      lines.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.65;

      ctx.fillStyle = "rgba(7, 5, 16, 0.15)";
      ctx.fillRect(0, 0, w, h);

      for (const line of lines) {
        line.z -= 0.02;
        if (line.z <= 0) {
          line.z = 3;
          line.x = (Math.random() - 0.5) * 2;
          line.y = (Math.random() - 0.5) * 1.2;
          line.color = colors[Math.floor(Math.random() * colors.length)];
        }

        const fov = 100;
        const scale1 = fov / line.z;
        const scale2 = fov / (line.z + 0.06);

        const x1 = cx + line.x * scale1;
        const y1 = cy + line.y * scale1;
        const x2 = cx + line.x * scale2;
        const y2 = cy + line.y * scale2;

        const alpha = Math.min(1, (3 - line.z) / 2);

        ctx.strokeStyle = line.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.lineWidth = Math.max(1, (3 - line.z) * 1.5);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Road effect
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 2, cy);
      ctx.lineTo(cx - w * 0.4, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 2, cy);
      ctx.lineTo(cx + w * 0.4, h);
      ctx.stroke();

      ctx.globalAlpha = 1;

      // Vignette
      const grad = ctx.createRadialGradient(cx, h / 2, h * 0.2, cx, h / 2, h * 0.9);
      grad.addColorStop(0, "transparent");
      grad.addColorStop(1, "rgba(7, 5, 16, 0.5)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    };

    // Clear initial
    ctx.fillStyle = "#070510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
