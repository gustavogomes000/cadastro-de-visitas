import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Search, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/masks";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "hzhxrkurljrogxtzxmmb";
const OWN_FUNCTIONS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const OWN_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface UsuarioExterno {
  id: string;
  nome: string;
  tipo: string;
  tag: string;
  subtitulo?: string;
  municipio?: string;
  fonte?: string;
}

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

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<VisitaComPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("todos");

  // External users for type matching
  const [externos, setExternos] = useState<UsuarioExterno[]>([]);
  const externosMapRef = useRef<Map<string, UsuarioExterno>>(new Map());

  useEffect(() => {
    fetchVisitas();
    fetchExternos();
  }, []);

  async function fetchExternos() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || OWN_ANON_KEY;
      const r = await fetch(`${OWN_FUNCTIONS_URL}/listar-usuarios-externos`, {
        headers: {
          "Content-Type": "application/json",
          apikey: OWN_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data)) {
        setExternos(data);
        const map = new Map<string, UsuarioExterno>();
        data.forEach((u: UsuarioExterno) => {
          map.set((u.nome || "").toLowerCase().trim(), u);
        });
        externosMapRef.current = map;
      }
    } catch (err) {
      console.error("[Dashboard] Erro ao buscar externos:", err);
    }
  }

  async function fetchVisitas() {
    setLoading(true);
    const { data } = await supabase
      .from("visitas")
      .select("id, data_hora, assunto, status, quem_indicou, cadastrado_por, observacoes, origem_visita, pessoas(id, nome, cpf, whatsapp, municipio, uf, email, telefone, titulo_eleitor, zona_eleitoral, secao_eleitoral)")
      .order("data_hora", { ascending: false })
      .limit(500);
    setVisitas((data as any[]) || []);
    setLoading(false);
  }

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

  const filtered = visitas.filter((v) => {
    // Tab filter
    if (activeTab !== "todos") {
      const tipo = getIndicadorTipo(v.quem_indicou);
      if (activeTab === "suplente" && tipo !== "suplente") return false;
      if (activeTab === "lideranca" && tipo !== "lideranca" && tipo !== "lideranca_cadastrada") return false;
    }
    // Search filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.pessoas?.nome?.toLowerCase().includes(q) ||
      v.quem_indicou?.toLowerCase().includes(q) ||
      v.assunto?.toLowerCase().includes(q) ||
      v.cadastrado_por?.toLowerCase().includes(q)
    );
  });

  // Counts per tab
  const countSuplente = visitas.filter(v => getIndicadorTipo(v.quem_indicou) === "suplente").length;
  const countLideranca = visitas.filter(v => { const t = getIndicadorTipo(v.quem_indicou); return t === "lideranca" || t === "lideranca_cadastrada"; }).length;

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "Aguardando": return "bg-yellow-500/15 text-yellow-600";
      case "Em andamento": return "bg-blue-500/15 text-blue-600";
      case "Resolvido": return "bg-emerald-500/15 text-emerald-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: visitas.length },
    { key: "suplente", label: "Suplentes", count: countSuplente },
    { key: "lideranca", label: "Lideranças", count: countLideranca },
  ];

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-4">
        <Users size={22} className="text-primary" />
        <h2 className="text-xl font-bold">Dashboard</h2>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold ml-auto">
          {filtered.length} cadastros
        </span>
      </div>

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

      {/* Visits list */}
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
            {searchQuery ? "Tente outro termo de busca." : "Ainda não há cadastros nessa categoria."}
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
                        {v.status && (
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", getStatusColor(v.status))}>
                            {v.status}
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
