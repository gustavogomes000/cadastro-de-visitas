import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import candidataImg from "@/assets/candidata.jpg";
import logoImg from "@/assets/Logo_Sarelli.png";

const APP_TITLE = "Painel de Pagamentos";

/* ── Constellation / Network background ── */
function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    interface Dot { x: number; y: number; vx: number; vy: number }
    const dots: Dot[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // gradient bg
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0, "#fef2f2");
      g.addColorStop(1, "#fdf2f8");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // move dots
      for (const d of dots) {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
      }

      // lines
      const maxDist = 140;
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.strokeStyle = `rgba(236,72,153,${0.12 * (1 - dist / maxDist)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }

      // dots
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(236,72,153,0.25)";
        ctx.fill();
      }

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
