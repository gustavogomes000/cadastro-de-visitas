import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import candidataImg from "@/assets/candidata.jpg";
import logoImg from "@/assets/Logo_Sarelli.png";

const APP_TITLE = "Painel de Pagamentos";

/* ── Futuristic Particle Grid Background ── */
function FuturisticBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let time = 0;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number; y: number; vx: number; vy: number; size: number; pulse: number;
    }
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const particles: Particle[] = Array.from({ length: 100 }, () => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 0.5,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      const w = W(), h = H();
      time += 0.008;

      // Dark gradient background
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a0a1a");
      bg.addColorStop(0.5, "#0d0820");
      bg.addColorStop(1, "#0a0a1a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Subtle hex grid
      const hexSize = 60;
      const hexH = hexSize * Math.sqrt(3);
      ctx.strokeStyle = "rgba(236, 72, 153, 0.04)";
      ctx.lineWidth = 0.5;
      for (let row = -1; row < h / hexH + 1; row++) {
        for (let col = -1; col < w / hexSize + 1; col++) {
          const cx = col * hexSize * 1.5 + Math.sin(time * 0.5 + row * 0.1) * 2;
          const cy = row * hexH + (col % 2 ? hexH / 2 : 0) + Math.cos(time * 0.3 + col * 0.1) * 2;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const px = cx + hexSize * 0.4 * Math.cos(angle);
            const py = cy + hexSize * 0.4 * Math.sin(angle);
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }

      // Horizontal scan lines
      ctx.fillStyle = "rgba(236, 72, 153, 0.015)";
      const scanY = (time * 80) % h;
      ctx.fillRect(0, scanY - 2, w, 4);
      ctx.fillRect(0, scanY + h * 0.5 - 1, w, 2);

      // Move & draw particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.pulse += 0.02;

        const alpha = 0.3 + Math.sin(p.pulse) * 0.2;
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
        glow.addColorStop(0, `rgba(236, 72, 153, ${alpha})`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(236, 72, 153, ${alpha + 0.2})`;
        ctx.fill();
      }

      // Connect nearby particles
      const maxDist = 120;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const a = 0.08 * (1 - dist / maxDist);
            ctx.strokeStyle = `rgba(236, 72, 153, ${a})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Center glow
      const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6);
      cg.addColorStop(0, "rgba(236, 72, 153, 0.03)");
      cg.addColorStop(0.5, "rgba(139, 92, 246, 0.02)");
      cg.addColorStop(1, "transparent");
      ctx.fillStyle = cg;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
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
      <FuturisticBg />

      <div className="w-full max-w-sm space-y-4 sm:space-y-5 relative z-10 px-4 py-8 sm:py-0">
        {/* ── Photo + Logo ── */}
        <div className="flex flex-col items-center">
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 w-[98px] h-[98px] sm:w-[118px] sm:h-[118px] -translate-x-1 -translate-y-1 rounded-full animate-pulse"
              style={{ background: "conic-gradient(from 0deg, #ec4899, #8b5cf6, #ec4899)", filter: "blur(6px)", opacity: 0.5 }}
            />
            <div className="relative w-[90px] h-[90px] sm:w-[110px] sm:h-[110px] rounded-full border-2 border-pink-400/60 overflow-hidden shadow-[0_0_30px_rgba(236,72,153,0.3)]">
              <img src={candidataImg} alt="Dra. Fernanda Sarelli" className="w-full h-full object-cover" loading="eager" />
            </div>
          </div>
          <img src={logoImg} alt="Logo Sarelli" className="h-36 sm:h-44 -mt-6 object-contain drop-shadow-[0_0_12px_rgba(236,72,153,0.3)]" />
          <p className="text-sm font-semibold tracking-[0.2em] uppercase mt-1" style={{ color: "#c8aa64" }}>
            {APP_TITLE}
          </p>
        </div>

        {/* ── Futuristic Card ── */}
        <div className="relative rounded-2xl p-[1px] overflow-hidden">
          {/* Animated border */}
          <div className="absolute inset-0 rounded-2xl animate-border-glow opacity-60" />
          
          {/* Card body */}
          <div className="relative rounded-2xl p-5 sm:p-8"
            style={{
              background: "linear-gradient(135deg, rgba(15,10,30,0.92), rgba(20,12,35,0.95))",
              backdropFilter: "blur(20px)",
              boxShadow: "0 0 40px rgba(236,72,153,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-8 h-[1px] bg-gradient-to-r from-pink-500/60 to-transparent" />
            <div className="absolute top-0 left-0 w-[1px] h-8 bg-gradient-to-b from-pink-500/60 to-transparent" />
            <div className="absolute bottom-0 right-0 w-8 h-[1px] bg-gradient-to-l from-pink-500/60 to-transparent" />
            <div className="absolute bottom-0 right-0 w-[1px] h-8 bg-gradient-to-t from-pink-500/60 to-transparent" />

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">{error}</div>
              )}

              {/* Username */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-pink-300/60 font-medium block">Usuário</label>
                <div className="relative group">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400/40 w-4 h-4 group-focus-within:text-pink-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Nome de usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoComplete="username"
                    className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-pink-500/50 h-11 pl-10 pr-4 rounded-lg text-sm outline-none focus:ring-1 focus:ring-pink-500/30 transition-all"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-[0.2em] text-pink-300/60 font-medium block">Senha</label>
                <div className="relative group">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400/40 w-4 h-4 group-focus-within:text-pink-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:border-pink-500/50 h-11 pl-10 pr-10 rounded-lg text-sm outline-none focus:ring-1 focus:ring-pink-500/30 transition-all"
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-pink-400 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                  className="w-4 h-4 rounded border-white/20 accent-pink-500 cursor-pointer bg-transparent"
                />
                <label htmlFor="remember" className="text-xs text-white/40 cursor-pointer select-none">
                  Lembrar meus dados
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg font-semibold text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60 relative overflow-hidden group"
                style={{
                  background: "linear-gradient(135deg, #ec4899, #8b5cf6)",
                  boxShadow: "0 0 30px rgba(236,72,153,0.3), 0 0 60px rgba(139,92,246,0.1)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                {loading ? (
                  <span className="flex items-center justify-center gap-2 relative">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2 relative">
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
          <p className="text-[10px] text-white/25 tracking-wider">Pré-candidata a Deputada Estadual — GO 2026</p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-pink-400/50 hover:text-pink-400 transition-colors"
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>

      <style>{`
        @keyframes border-rotate {
          0% { --angle: 0deg; }
          100% { --angle: 360deg; }
        }
        .animate-border-glow {
          background: conic-gradient(from var(--angle, 0deg), #ec4899, #8b5cf6, #ec4899, #6366f1, #ec4899);
          animation: border-rotate 4s linear infinite;
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
