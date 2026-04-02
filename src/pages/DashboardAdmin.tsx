import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Search, ChevronRight, Users, Trophy, CalendarDays, BarChart3, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/masks";
import {
  fetchAllUsuariosExternos,
  subscribeToUsuariosExternos,
  type UsuarioExterno,
} from "@/lib/indicadoresExternos";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface VisitaComPessoa {
  id: string;
  data_hora: string | null;
  assunto: string | null;
  status: string | null;
  quem_indicou: string | null;
  cadastrado_por: string | null;
  observacoes: string | null;
  origem_visita: string | null;
  pessoas: {
    id: string;
    nome: string | null;
    cpf: string | null;
    whatsapp: string | null;
    municipio: string | null;
    uf: string | null;
    email: string | null;
    telefone: string | null;
    titulo_eleitor: string | null;
    zona_eleitoral: string | null;
    secao_eleitoral: string | null;
  } | null;
}

type TabType = "todos" | "suplente" | "lideranca";
type PeriodoType = "hoje" | "7dias" | "30dias" | "todos";

const PERIODO_LABELS: Record<PeriodoType, string> = {
  hoje: "Hoje",
  "7dias": "7 dias",
  "30dias": "30 dias",
  todos: "Tudo",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<VisitaComPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("todos");
  const [periodo, setPeriodo] = useState<PeriodoType>("todos");

  const [externos, setExternos] = useState<UsuarioExterno[]>([]);
  const externosMapRef = useRef<Map<string, UsuarioExterno>>(new Map());

  const fetchExternos = useCallback(async (force = false) => {
    try {
      const data = await fetchAllUsuariosExternos({ force });
      setExternos(data);
      const map = new Map<string, UsuarioExterno>();
      data.forEach((u) => map.set((u.nome || "").toLowerCase().trim(), u));
      externosMapRef.current = map;
    } catch (err) {
      console.error("[Dashboard] Erro ao buscar externos:", err);
    }
  }, []);

  const fetchVisitas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("visitas")
      .select("id, data_hora, assunto, status, quem_indicou, cadastrado_por, observacoes, origem_visita, pessoas(id, nome, cpf, whatsapp, municipio, uf, email, telefone, titulo_eleitor, zona_eleitoral, secao_eleitoral)")
      .order("data_hora", { ascending: false })
      .limit(500);
    setVisitas((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchVisitas();
    void fetchExternos(true);

    const unsubscribeIndicadores = subscribeToUsuariosExternos(() => {
      void fetchExternos(true);
    }, "dashboard-admin");

    const dashboardChannel = supabase
      .channel("dashboard-admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "visitas" }, () => {
        void fetchVisitas();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pessoas" }, () => {
        void fetchVisitas();
      })
      .subscribe();

    const intervalId = window.setInterval(() => {
      void fetchExternos(true);
      void fetchVisitas();
    }, 5000);

    return () => {
      unsubscribeIndicadores();
      window.clearInterval(intervalId);
      void supabase.removeChannel(dashboardChannel);
    };
  }, [fetchExternos, fetchVisitas]);

  function getIndicadorTipo(quemIndicou: string | null): string | null {
    if (!quemIndicou) return null;
    const ext = externosMapRef.current.get(quemIndicou.toLowerCase().trim());
    return ext?.tipo || null;
  }

  function getTagInfo(tipo: string | null): { label: string; className: string } {
    switch (tipo) {
      case "suplente":
        return { label: "Suplente", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" };
      case "lideranca":
      case "lideranca_cadastrada":
        return { label: "Liderança", className: "bg-blue-500/15 text-blue-600 border-blue-500/30" };
      default:
        return { label: "", className: "" };
    }
  }

  // Period filter
  const visitasFiltradas = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    return visitas.filter((v) => {
      if (periodo === "todos") return true;
      if (!v.data_hora) return false;
      const d = new Date(v.data_hora);
      switch (periodo) {
        case "hoje": return d >= today;
        case "7dias": return d >= subDays(today, 7);
        case "30dias": return d >= subDays(today, 30);
        default: return true;
      }
    });
  }, [visitas, periodo]);

  const filtered = useMemo(() => {
    return visitasFiltradas.filter((v) => {
      if (activeTab !== "todos") {
        const tipo = getIndicadorTipo(v.quem_indicou);
        if (activeTab === "suplente" && tipo !== "suplente") return false;
        if (activeTab === "lideranca" && tipo !== "lideranca" && tipo !== "lideranca_cadastrada") return false;
      }
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        v.pessoas?.nome?.toLowerCase().includes(q) ||
        v.quem_indicou?.toLowerCase().includes(q) ||
        v.assunto?.toLowerCase().includes(q) ||
        v.cadastrado_por?.toLowerCase().includes(q)
      );
    });
  }, [visitasFiltradas, activeTab, searchQuery]);

  // Counts
  const countSuplente = visitasFiltradas.filter(v => getIndicadorTipo(v.quem_indicou) === "suplente").length;
  const countLideranca = visitasFiltradas.filter(v => { const t = getIndicadorTipo(v.quem_indicou); return t === "lideranca" || t === "lideranca_cadastrada"; }).length;

  // Ranking de indicadores (só suplentes e lideranças reais)
  const ranking = useMemo(() => {
    const counts = new Map<string, { nome: string; tipo: string; count: number }>();
    visitasFiltradas.forEach((v) => {
      if (!v.quem_indicou) return;
      const tipo = getIndicadorTipo(v.quem_indicou);
      if (!tipo || tipo === "desconhecido") return; // Só mostra suplentes/lideranças reais
      const key = v.quem_indicou.toLowerCase().trim();
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, {
          nome: v.quem_indicou,
          tipo: tipo,
          count: 1,
        });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [visitasFiltradas, externos]);

  // Ranking de visitantes (pessoas com mais visitas)
  const rankingVisitantes = useMemo(() => {
    const counts = new Map<string, { nome: string; id: string; count: number }>();
    visitasFiltradas.forEach((v) => {
      if (!v.pessoas?.id || !v.pessoas?.nome) return;
      const key = v.pessoas.id;
      const existing = counts.get(key);
      if (existing) {
        existing.count++;
      } else {
        counts.set(key, { nome: v.pessoas.nome, id: v.pessoas.id, count: 1 });
      }
    });
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [visitasFiltradas]);


  const chartData = useMemo(() => {
    const days = periodo === "hoje" ? 1 : periodo === "7dias" ? 7 : periodo === "30dias" ? 30 : 14;
    const now = new Date();
    const today = startOfDay(now);

    const dayMap = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, 0);
    }

    visitasFiltradas.forEach((v) => {
      if (!v.data_hora) return;
      const key = v.data_hora.slice(0, 10);
      if (dayMap.has(key)) {
        dayMap.set(key, (dayMap.get(key) || 0) + 1);
      }
    });

    return Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      label: formatShortDate(date),
      cadastros: count,
    }));
  }, [visitasFiltradas, periodo]);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: visitasFiltradas.length },
    { key: "suplente", label: "Suplentes", count: countSuplente },
    { key: "lideranca", label: "Lideranças", count: countLideranca },
  ];

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Users size={22} className="text-primary" />
        <h2 className="text-xl font-bold">Dashboard</h2>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold ml-auto">
          {filtered.length} cadastros
        </span>
      </div>

      {/* Filtro de período */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        <CalendarDays size={14} className="text-muted-foreground mt-1.5 flex-shrink-0" />
        {(Object.keys(PERIODO_LABELS) as PeriodoType[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
              periodo === p
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {PERIODO_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Gráfico de cadastros por dia */}
      {periodo !== "hoje" && chartData.length > 1 && (
        <div className="card-section mb-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-primary" />
            <p className="text-xs font-bold text-primary uppercase tracking-wide">Cadastros por dia</p>
          </div>
          <div className="h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(label) => `Data: ${label}`}
                  formatter={(value: number) => [`${value} cadastro${value !== 1 ? "s" : ""}`, ""]}
                />
                <Bar
                  dataKey="cadastros"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ranking de indicadores */}
      {ranking.length > 0 && (
        <div className="card-section mb-4 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={14} className="text-amber-500" />
            <p className="text-xs font-bold text-primary uppercase tracking-wide">Top indicadores</p>
          </div>
          <div className="space-y-2">
            {ranking.map((r, i) => {
              const tag = getTagInfo(r.tipo);
              const barWidth = ranking[0].count > 0 ? Math.max((r.count / ranking[0].count) * 100, 8) : 8;
              return (
                <div key={r.nome} className="flex items-center gap-2">
                  <span className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                    i === 0 ? "bg-amber-500/20 text-amber-600" :
                    i === 1 ? "bg-gray-300/30 text-gray-500" :
                    i === 2 ? "bg-orange-400/20 text-orange-500" :
                    "bg-muted text-muted-foreground"
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate">{r.nome}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary flex-shrink-0 min-w-[28px] text-right">
                    {r.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {tab.label}
            <span className={cn(
              "ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full",
              activeTab === tab.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome, indicador, assunto…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 rounded-xl bg-card border border-border pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-section animate-pulse h-24" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg mb-1">Nenhum cadastro encontrado</p>
          <p className="text-sm">
            {searchQuery ? "Tente outro termo de busca." : "Ainda não há cadastros nesse período."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v, i) => {
            const isExpanded = expandedId === v.id;
            const p = v.pessoas;
            const tipo = getIndicadorTipo(v.quem_indicou);
            const tag = getTagInfo(tipo);
            return (
              <div
                key={v.id}
                className="card-section transition-all"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{p?.nome || "Sem nome"}</p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {v.quem_indicou && (
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-semibold border",
                            tag.className || "bg-muted text-muted-foreground border-border"
                          )}>
                            {tag.label ? `${tag.label}: ` : ""}{v.quem_indicou}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground">
                        {v.data_hora ? new Date(v.data_hora).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                      </span>
                      <ChevronRight size={14} className={cn("text-muted-foreground transition-transform mt-1 ml-auto", isExpanded && "rotate-90")} />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Assunto: {v.assunto || "–"}
                  </p>
                </button>

                {isExpanded && p && (
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2 animate-fade-in">
                    <p className="text-xs font-bold text-primary uppercase tracking-wide">Dados do Cadastro</p>
                    <InfoRow label="Nome" value={p.nome} />
                    <InfoRow label="CPF" value={p.cpf && !p.cpf.startsWith("TEMP") ? p.cpf : null} />
                    <InfoRow label="WhatsApp" value={p.whatsapp} />
                    <InfoRow label="Telefone" value={p.telefone} />
                    <InfoRow label="Email" value={p.email} />
                    <InfoRow label="Município/UF" value={[p.municipio, p.uf].filter(Boolean).join("/")} />
                    <InfoRow label="Título Eleitor" value={p.titulo_eleitor} />
                    <InfoRow label="Zona" value={p.zona_eleitoral} />
                    <InfoRow label="Seção" value={p.secao_eleitoral} />
                    <InfoRow label="Data/hora visita" value={v.data_hora ? formatDateTime(v.data_hora) : null} />
                    <InfoRow label="Origem" value={v.origem_visita} />
                    <InfoRow label="Observações" value={v.observacoes} />
                    <InfoRow label="Cadastrado por" value={v.cadastrado_por} />

                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/visita/${v.id}`); }}
                      className="w-full mt-2 h-9 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all"
                    >
                      Ver visita completa
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
