import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Search, ChevronRight, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/masks";

function getTagColor(tipo: string): string {
  switch (tipo) {
    case "suplente": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "lideranca":
    case "lideranca_cadastrada": return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    case "coordenador": return "bg-purple-500/15 text-purple-600 border-purple-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

function getTagLabel(tipo: string): string {
  switch (tipo) {
    case "suplente": return "Suplente";
    case "lideranca":
    case "lideranca_cadastrada": return "Liderança";
    case "coordenador": return "Coordenador";
    default: return tipo || "–";
  }
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

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<VisitaComPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchVisitas();
  }, []);

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

  const filtered = visitas.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.pessoas?.nome?.toLowerCase().includes(q) ||
      v.quem_indicou?.toLowerCase().includes(q) ||
      v.assunto?.toLowerCase().includes(q) ||
      v.cadastrado_por?.toLowerCase().includes(q)
    );
  });

  // Group by quem_indicou for summary
  const indicadorMap = new Map<string, { tipo: string; count: number }>();
  visitas.forEach((v) => {
    if (v.quem_indicou) {
      const key = v.quem_indicou;
      if (!indicadorMap.has(key)) {
        indicadorMap.set(key, { tipo: "suplente", count: 0 });
      }
      indicadorMap.get(key)!.count++;
    }
  });

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case "Aguardando": return "bg-yellow-500/15 text-yellow-600";
      case "Em andamento": return "bg-blue-500/15 text-blue-600";
      case "Resolvido": return "bg-emerald-500/15 text-emerald-600";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-4">
        <Users size={22} className="text-primary" />
        <h2 className="text-xl font-bold">Dashboard</h2>
        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold ml-auto">
          {visitas.length} cadastros
        </span>
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

      {/* Summary cards */}
      {!searchQuery && indicadorMap.size > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Por indicador</p>
          <div className="flex gap-2 flex-wrap">
            {Array.from(indicadorMap.entries())
              .sort((a, b) => b[1].count - a[1].count)
              .slice(0, 10)
              .map(([nome, info]) => (
                <button
                  key={nome}
                  onClick={() => setSearchQuery(nome)}
                  className="text-xs px-3 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  <span className="font-semibold">{nome}</span>
                  <span className="text-muted-foreground">({info.count})</span>
                </button>
              ))}
          </div>
        </div>
      )}

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
            {searchQuery ? "Tente outro termo de busca." : "Ainda não há cadastros."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v, i) => {
            const isExpanded = expandedId === v.id;
            const p = v.pessoas;
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
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                            {v.quem_indicou}
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

                {/* Expanded details */}
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
