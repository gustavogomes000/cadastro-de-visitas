import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import candidataImg from "@/assets/candidata.jpg";
import logoImg from "@/assets/Logo_Sarelli.png";

const APP_TITLE = "Cadastro de Visitas";

/* ── Constellation / Network background ── */
function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let mouse = { x: -9999, y: -9999 };

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

    const w = () => canvas.width / (window.devicePixelRatio || 1);
    const h = () => canvas.height / (window.devicePixelRatio || 1);

    const handleMouse = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const handleTouch = (e: TouchEvent) => { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; };
    const handleLeave = () => { mouse.x = -9999; mouse.y = -9999; };
    window.addEventListener("mousemove", handleMouse);
    window.addEventListener("touchmove", handleTouch, { passive: true });
    window.addEventListener("mouseleave", handleLeave);
    window.addEventListener("touchend", handleLeave);

    interface Node {
      x: number; y: number; vx: number; vy: number;
      radius: number; pulseOffset: number; layer: number;
    }

    const count = Math.min(160, Math.floor((w() * h()) / 5500));
    const nodes: Node[] = Array.from({ length: count }, () => ({
      x: Math.random() * w(),
      y: Math.random() * h(),
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      radius: Math.random() * 1.8 + 0.8,
      pulseOffset: Math.random() * Math.PI * 2,
      layer: Math.random(), // 0=back, 1=front for parallax
    }));

    // Data packets traveling along edges
    interface Packet { from: number; to: number; t: number; speed: number }
    const packets: Packet[] = [];
    const spawnPacket = () => {
      const from = Math.floor(Math.random() * nodes.length);
      let to = Math.floor(Math.random() * nodes.length);
      if (to === from) to = (to + 1) % nodes.length;
      packets.push({ from, to, t: 0, speed: 0.005 + Math.random() * 0.01 });
    };
    for (let i = 0; i < 15; i++) spawnPacket();

    const maxDist = 160;
    const mouseRadius = 220;
    let time = 0;

    const draw = () => {
      time += 0.008;
      const W = w(), H = h();
      ctx.clearRect(0, 0, W, H);

      // gradient bg with subtle animated shift
      const gAngle = Math.sin(time * 0.3) * 0.1;
      const g = ctx.createLinearGradient(
        W * (0.3 + gAngle), 0, W * (0.7 - gAngle), H
      );
      g.addColorStop(0, "#fef2f2");
      g.addColorStop(0.4, "#fdf2f8");
      g.addColorStop(0.7, "#fce7f3");
      g.addColorStop(1, "#fef2f2");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // subtle hexagonal grid pattern in background
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = "#ec4899";
      ctx.lineWidth = 0.5;
      const hexSize = 60;
      for (let row = -1; row < H / (hexSize * 0.86) + 1; row++) {
        for (let col = -1; col < W / hexSize + 1; col++) {
          const cx = col * hexSize * 1.5 + (row % 2 ? hexSize * 0.75 : 0);
          const cy = row * hexSize * 0.866;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const angle = (Math.PI / 3) * s + Math.PI / 6;
            const px = cx + Math.cos(angle) * hexSize * 0.4;
            const py = cy + Math.sin(angle) * hexSize * 0.4;
            s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // move nodes with slight wave
      for (const n of nodes) {
        n.x += n.vx + Math.sin(time + n.pulseOffset) * 0.03;
        n.y += n.vy + Math.cos(time * 0.7 + n.pulseOffset) * 0.03;
        if (n.x < -10) n.x = W + 10;
        if (n.x > W + 10) n.x = -10;
        if (n.y < -10) n.y = H + 10;
        if (n.y > H + 10) n.y = -10;

        // mouse attraction (gentle pull instead of repulsion)
        const mdx = mouse.x - n.x;
        const mdy = mouse.y - n.y;
        const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mDist < mouseRadius && mDist > 30) {
          const force = (1 - mDist / mouseRadius) * 0.15;
          n.x += (mdx / mDist) * force;
          n.y += (mdy / mDist) * force;
        }
      }

      // connections with animated dash for "data flow" feel
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist);
            const wave = Math.sin(time * 3 + i * 0.5 + j * 0.3) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(236,72,153,${(0.08 + wave * 0.12) * alpha})`;
            ctx.lineWidth = alpha * 1.0 + wave * 0.3;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      // mouse connection web
      if (mouse.x > -9000) {
        // glow around cursor
        const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, mouseRadius * 0.6);
        mg.addColorStop(0, "rgba(236,72,153,0.04)");
        mg.addColorStop(1, "rgba(236,72,153,0)");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, mouseRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();

        for (const n of nodes) {
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouseRadius) {
            const alpha = (1 - dist / mouseRadius) * 0.35;
            ctx.strokeStyle = `rgba(244,114,182,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // animate data packets
      for (let p = packets.length - 1; p >= 0; p--) {
        const pkt = packets[p];
        pkt.t += pkt.speed;
        if (pkt.t >= 1) {
          packets.splice(p, 1);
          spawnPacket();
          continue;
        }
        const a = nodes[pkt.from], b = nodes[pkt.to];
        const px = a.x + (b.x - a.x) * pkt.t;
        const py = a.y + (b.y - a.y) * pkt.t;

        const pg = ctx.createRadialGradient(px, py, 0, px, py, 5);
        pg.addColorStop(0, "rgba(236,72,153,0.6)");
        pg.addColorStop(0.5, "rgba(244,114,182,0.2)");
        pg.addColorStop(1, "rgba(236,72,153,0)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
      }

      // draw nodes with pulse and rings
      for (const n of nodes) {
        const pulse = Math.sin(time * 2 + n.pulseOffset) * 0.5 + 0.5;
        const r = n.radius + pulse * 0.6;

        // outer glow
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 5);
        glow.addColorStop(0, `rgba(236,72,153,${0.08 + pulse * 0.04})`);
        glow.addColorStop(1, "rgba(236,72,153,0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r * 5, 0, Math.PI * 2);
        ctx.fill();

        // pulsing ring on some nodes
        if (n.layer > 0.7) {
          const ringR = r * 2 + pulse * 6;
          ctx.strokeStyle = `rgba(236,72,153,${0.08 * (1 - pulse)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // core dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        const coreGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        coreGrad.addColorStop(0, `rgba(255,255,255,${0.7 + pulse * 0.3})`);
        coreGrad.addColorStop(1, `rgba(236,72,153,${0.5 + pulse * 0.2})`);
        ctx.fillStyle = coreGrad;
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      window.removeEventListener("touchmove", handleTouch);
      window.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("touchend", handleLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full z-0" />;
}

/* ── Login ── */
export default function Login() {
  const { signIn } = useAuth();

  const [username, setUsername] = useState(() => localStorage.getItem("saved_user") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("saved_user"));

  if (typeof window !== "undefined" && localStorage.getItem("saved_pass")) {
    localStorage.removeItem("saved_pass");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Digite o nome de usuário"); return; }
    setLoading(true);
    const { error } = await signIn(username.trim(), password);
    if (error) setError(error);
    else {
      if (remember) localStorage.setItem("saved_user", username.trim());
      else localStorage.removeItem("saved_user");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center sm:justify-center overflow-y-auto relative">
      <ConstellationBg />

      <div className="w-full max-w-sm space-y-4 sm:space-y-5 relative z-10 px-4 py-8 sm:py-0">
        {/* ── Photo + Logo ── */}
        <div className="flex flex-col items-center">
          {/* Photo */}
          <div className="w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] rounded-full border-4 border-pink-400 overflow-hidden shadow-lg">
            <img src={candidataImg} alt="Dra. Fernanda Sarelli" className="w-full h-full object-cover" loading="eager" />
          </div>
          {/* Logo overlapping */}
          <img src={logoImg} alt="Logo Sarelli" className="h-36 sm:h-44 -mt-6 object-contain" />
          {/* Subtitle */}
          <p className="text-sm font-semibold tracking-widest uppercase mt-1" style={{ color: "#c8aa64" }}>
            {APP_TITLE}
          </p>
        </div>

        {/* ── Card with animated border ── */}
        <div className="relative rounded-2xl p-[2px] animate-border-glow">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 text-center">{error}</div>
              )}

              {/* Email / Username */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-gray-500 font-medium block">Usuário</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Nome de usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoComplete="username"
                    className="w-full bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-pink-400 h-11 pl-10 pr-4 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-gray-500 font-medium block">Senha</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white border border-gray-200 text-gray-800 placeholder:text-gray-400 focus:border-pink-400 h-11 pl-10 pr-10 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-200 transition-all"
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-pink-500 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-gray-500 cursor-pointer select-none">
                  Lembrar meus dados
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg font-semibold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg"
                style={{ background: "linear-gradient(to right, #ec4899, #f43f5e)", boxShadow: "0 4px 20px rgba(236,72,153,0.35)" }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Entrar
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1 pb-4">
          <p className="text-[10px] text-gray-400">Pré-candidata a Deputada Estadual — GO 2026</p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-pink-400 hover:text-pink-500 transition-colors"
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>

      {/* CSS for animated border glow */}
      <style>{`
        @keyframes border-rotate {
          0% { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
        .animate-border-glow {
          background: conic-gradient(from var(--angle, 0deg), #ec4899, #f9a8d4, #ec4899, #f472b6, #ec4899);
          animation: border-rotate 3s linear infinite;
        }
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `}</style>
    </div>
  );
}
