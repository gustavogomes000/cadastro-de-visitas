import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Plus, Pencil, Calendar, ChevronDown, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/masks";
import { cn } from "@/lib/utils";

export default function PessoaDetalhePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pessoa, setPessoa] = useState<any>(null);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [{ data: p, error: pErr }, { data: v, error: vErr }] = await Promise.all([
          supabase.from("pessoas").select("*").eq("id", id).maybeSingle(),
          supabase.from("visitas").select("*").eq("pessoa_id", id).order("data_hora", { ascending: false }).limit(100),
        ]);
        if (pErr) throw pErr;
        if (vErr) throw vErr;
        setPessoa(p);
        setVisitas(v || []);
      } catch {
        // pessoa ficará null → UI mostra "Pessoa não encontrada"
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <AppLayout><div className="card-section animate-pulse h-40" /></AppLayout>;
  if (!pessoa) return <AppLayout><p className="text-center py-16 text-muted-foreground">Pessoa não encontrada.</p></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted active:scale-95">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">{pessoa.nome || "Sem nome"}</h2>
      </div>

      <div className="space-y-4">
        {/* Editar dados */}
        <button
          onClick={() => navigate(`/editar-pessoa/${id}`)}
          className="w-full card-section flex items-center justify-between active:scale-[0.98] transition-transform"
        >
          <div>
            <p className="text-sm font-semibold">Dados Pessoais e Eleitorais</p>
            <p className="text-xs text-muted-foreground">Toque para visualizar e editar</p>
          </div>
          <Pencil size={16} className="text-muted-foreground" />
        </button>

        {/* Histórico de visitas */}
        <div className="card-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              <p className="text-sm font-bold text-primary uppercase tracking-wide">
                Histórico de Visitas
              </p>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {visitas.length}
            </span>
          </div>

          {/* Nova visita */}
          <button
            onClick={() => navigate(`/nova-visita-existente/${id}`)}
            className="w-full h-11 mb-4 rounded-lg text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/5 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
          >
            <Plus size={16} />
            Registrar nova visita
          </button>

          {visitas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhuma visita registrada.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visitas.map((v, i) => {
                const num = visitas.length - i;
                const dataFormatada = v.data_hora
                  ? new Date(v.data_hora).toLocaleDateString("pt-BR", {
                      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
                    })
                  : "–";
                const hora = v.data_hora
                  ? new Date(v.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                  : "";
                return (
                  <div key={v.id} className="p-3 rounded-lg border border-border/50">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[11px] font-bold text-primary">{num}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-[11px] text-muted-foreground capitalize">{dataFormatada}{hora ? ` • ${hora}` : ""}</p>
                        <p className="text-sm font-semibold">{v.assunto || "–"}</p>
                        {v.quem_indicou && (
                          <p className="text-[11px] text-muted-foreground">Indicação: {v.quem_indicou}</p>
                        )}
                        {v.descricao_assunto && (
                          <p className="text-[11px] text-muted-foreground">{v.descricao_assunto}</p>
                        )}
                        {v.observacoes && (
                          <p className="text-[11px] text-muted-foreground">Obs: {v.observacoes}</p>
                        )}
                        {v.cadastrado_por && (
                          <p className="text-[10px] text-muted-foreground/50">Por: {v.cadastrado_por}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
