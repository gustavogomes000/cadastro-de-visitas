import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Search, Plus } from "lucide-react";
import { maskCPF } from "@/lib/masks";

export default function PessoasPage() {
  const navigate = useNavigate();
  const [pessoas, setPessoas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPessoas();
  }, []);

  async function fetchPessoas() {
    const { data } = await supabase
      .from("pessoas")
      .select("*, visitas(id, data_hora)")
      .order("nome");
    // Filtra: esconde pessoas marcadas como DESATIVADO
    setPessoas((data || []).filter((p: any) => p.origem !== "DESATIVADO"));
    setLoading(false);
  }

  const filtered = pessoas.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase().trim();
    const cpfDigits = q.replace(/\D/g, "");
    const words = q.split(/\s+/).filter(Boolean);
    const nome = (p.nome || "").toLowerCase();
    const nameMatch = words.length > 0 && words.every(w => nome.includes(w));
    return (
      nameMatch ||
      (cpfDigits.length > 0 && p.cpf?.includes(cpfDigits)) ||
      (q.length > 0 && p.telefone?.includes(q))
    );
  });

  return (
    <AppLayout>
      <h2 className="text-xl font-bold mb-4">Pessoas</h2>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nome, CPF ou telefone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-11 rounded-xl bg-card border border-border pl-10 pr-4 text-sm shadow-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card-section animate-pulse h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center py-16 text-muted-foreground">Nenhuma pessoa encontrada.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p, i) => {
            const visitCount = p.visitas?.length || 0;
            const lastVisit = p.visitas?.sort((a: any, b: any) =>
              new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
            )[0];

            return (
              <div
                key={p.id}
                className="card-section hover:shadow-md transition-all"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <button
                  onClick={() => navigate(`/pessoa/${p.id}`)}
                  className="w-full text-left"
                >
                  <p className="font-semibold text-sm">{p.nome || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground">
                    CPF: {p.cpf && !p.cpf.startsWith("TEMP") ? `${maskCPF(p.cpf).slice(0, 7)}•••-••` : "–"}
                  </p>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{visitCount} visita{visitCount !== 1 ? "s" : ""}</span>
                    {lastVisit && (
                      <span>Última: {new Date(lastVisit.data_hora).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/nova-visita-existente/${p.id}`); }}
                  className="mt-2 w-full h-9 rounded-lg text-xs font-semibold text-primary border border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} />
                  Nova Visita
                </button>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
