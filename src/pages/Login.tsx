import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/Logo_Sarelli.png";

const APP_TITLE = "Painel de Pagamentos";

/* ── Constellation Network Background ── */
function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let width = 0;
    let height = 0;

    interface Dot { x: number; y: number; vx: number; vy: number; r: number; pulse: number; pulseSpeed: number }

    let dots: Dot[] = [];

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const count = Math.floor((width * height) / 12000);
      dots = Array.from({ length: Math.min(count, 120) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 1.5,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.01 + Math.random() * 0.02,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Soft gradient background
      const bg = ctx.createRadialGradient(width / 2, height * 0.3, 0, width / 2, height / 2, Math.max(width, height) * 0.8);
      bg.addColorStop(0, "#fdf2f8");
      bg.addColorStop(0.5, "#fce7f3");
      bg.addColorStop(1, "#fdf2f8");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Update dots
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        d.pulse += d.pulseSpeed;
        if (d.x < -10) d.x = width + 10;
        if (d.x > width + 10) d.x = -10;
        if (d.y < -10) d.y = height + 10;
        if (d.y > height + 10) d.y = -10;
      }

      // Draw lines
      const maxDist = 160;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = 0.08 * (1 - dist / maxDist);
            ctx.strokeStyle = `rgba(236,72,153,${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing dots
      for (const d of dots) {
        const glow = 0.4 + Math.sin(d.pulse) * 0.3;
        const r = d.r + Math.sin(d.pulse) * 0.5;

        // Outer glow
        const grad = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, r * 4);
        grad.addColorStop(0, `rgba(236,72,153,${glow * 0.4})`);
        grad.addColorStop(1, "rgba(236,72,153,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r * 4, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = `rgba(236,72,153,${glow})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full" style={{ zIndex: 0 }} />;
}

/* ── Login Page ── */
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

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Digite o nome de usuário"); return; }
    setLoading(true);
    const { error: err } = await signIn(username.trim(), password);
    if (err) setError(err);
    else {
      if (remember) localStorage.setItem("saved_user", username.trim());
      else localStorage.removeItem("saved_user");
    }
    setLoading(false);
  }, [username, password, remember, signIn]);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center sm:justify-center overflow-y-auto relative">
      <ConstellationBg />

      <div className="w-full max-w-[420px] relative z-10 px-5 py-10 sm:py-0 flex flex-col items-center">

        {/* ── Logo ── */}
        <img
          src={logoImg}
          alt="Dra. Fernanda Sarelli"
          className="h-28 sm:h-36 object-contain mb-2 drop-shadow-sm"
        />

        {/* ── Subtitle ── */}
        <p
          className="text-[13px] sm:text-sm font-medium tracking-[0.25em] uppercase mb-8"
          style={{ color: "#c8aa64" }}
        >
          {APP_TITLE}
        </p>

        {/* ── Card with animated glow border ── */}
        <div className="w-full relative group">
          {/* Animated border glow */}
          <div
            className="absolute -inset-[1px] rounded-2xl opacity-60 blur-[1px]"
            style={{
              background: "conic-gradient(from var(--angle, 0deg), rgba(236,72,153,0.5), rgba(251,191,36,0.3), rgba(236,72,153,0.5), rgba(249,168,212,0.4), rgba(236,72,153,0.5))",
              animation: "border-spin 4s linear infinite",
            }}
          />

          <div className="relative bg-white/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-[0_8px_40px_rgba(236,72,153,0.08)] p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="text-sm text-red-600 bg-red-50/80 rounded-xl p-3 text-center font-medium animate-fade-in">
                  {error}
                </div>
              )}

              {/* Username */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-700 block">
                  Usuário
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Ex: Administrador"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoCapitalize="none"
                    autoComplete="username"
                    className="w-full bg-white/60 border border-pink-100 text-gray-700 placeholder:text-gray-300 focus:border-pink-300 focus:bg-white/80 h-12 pl-12 pr-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-100 transition-all duration-200"
                    style={{ fontSize: "16px" }}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-700 block">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-300">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/60 border border-pink-100 text-gray-700 placeholder:text-gray-300 focus:border-pink-300 focus:bg-white/80 h-12 pl-12 pr-12 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-100 transition-all duration-200"
                    style={{ fontSize: "16px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-300 hover:text-pink-500 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.878" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="remember"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-pink-200 accent-pink-500 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-gray-500 cursor-pointer select-none">
                  Lembrar meus dados
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-[15px] text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-60 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #ec4899 0%, #f43f5e 40%, #c8aa64 100%)",
                  boxShadow: "0 4px 20px rgba(236,72,153,0.3), 0 1px 3px rgba(0,0,0,0.08)",
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    Entrando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Entrar
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 space-y-1.5">
          <p className="text-[11px] text-gray-400 font-light">Pré-candidata a Deputada Estadual — GO 2026</p>
          <a
            href="https://drafernandasarelli.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-pink-400/70 hover:text-pink-500 transition-colors"
          >
            drafernandasarelli.com.br
          </a>
        </div>
      </div>

      <style>{`
        @property --angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes border-spin {
          to { --angle: 360deg; }
        }
        div[style*="border-spin"] {
          --angle: 0deg;
        }
      `}</style>
    </div>
  );
}
