import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIOD_FILTERS = ["Hoje", "Esta semana", "Este mês", "Todas"];

export default function HomePage() {
  const navigate = useNavigate();
  const [visitas, setVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [periodFilter, setPeriodFilter] = useState("Hoje");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVisitas();
  }, [periodFilter]);

  async function fetchVisitas() {
    setLoading(true);
    let query = supabase
      .from("visitas")
      .select("*, pessoas(nome, cpf)")
      .order("data_hora", { ascending: false });


    const now = new Date();
    if (periodFilter === "Hoje") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte("data_hora", start);
    } else if (periodFilter === "Esta semana") {
      const day = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - day);
      start.setHours(0, 0, 0, 0);
      query = query.gte("data_hora", start.toISOString());
    } else if (periodFilter === "Este mês") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte("data_hora", start);
    }

    const { data } = await query;
    setVisitas(data || []);
    setLoading(false);
  }

  const filtered = visitas.filter((v) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.pessoas?.nome?.toLowerCase().includes(q) ||
      v.assunto?.toLowerCase().includes(q) ||
      v.quem_indicou?.toLowerCase().includes(q)
    );
  });

  return (
    <AppLayout>
      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar visita…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-11 rounded-xl bg-card border border-border pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
      </div>


      {/* Period filter */}
      <div className="flex gap-2 mb-4">
        {PERIOD_FILTERS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodFilter(p)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-lg transition-colors active:scale-95",
              periodFilter === p
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground"
            )}
          >
            {p}
          </button>
        ))}
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
          <p className="text-lg mb-1">Nenhuma visita encontrada</p>
          <p className="text-sm">
            {searchQuery
              ? "Tente outro termo de busca."
              : "Nenhuma visita neste período."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((v, i) => (
            <button
              key={v.id}
              onClick={() => navigate(`/visita/${v.id}`)}
              className="w-full text-left card-section hover:shadow-md transition-shadow active:scale-[0.98]"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between">
                <p className="font-semibold text-sm">{v.pessoas?.nome || "Sem nome"}</p>
                <span className="text-[10px] text-muted-foreground">
                  {v.data_hora ? new Date(v.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {v.data_hora ? new Date(v.data_hora).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : ""}
              </p>
              <p className="text-xs text-muted-foreground">Assunto: {v.assunto || "–"}</p>
              {v.quem_indicou && (
                <p className="text-xs text-muted-foreground">Indicado por: {v.quem_indicou}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate("/nova-visita")}
        className="fixed bottom-20 right-4 z-40 gradient-primary text-white rounded-2xl px-5 h-12 shadow-lg shadow-pink-500/25 flex items-center gap-2 font-semibold active:scale-95 transition-transform"
      >
        <Plus size={20} />
        Nova visita
      </button>
    </AppLayout>
  );
}
