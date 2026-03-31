import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { ASSUNTOS } from "@/lib/constants";
import { getStatusColor } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

function getBrasiliaDateTime() {
  const now = new Date();
  const brasilia = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = brasilia.getFullYear();
  const m = String(brasilia.getMonth() + 1).padStart(2, "0");
  const d = String(brasilia.getDate()).padStart(2, "0");
  const h = String(brasilia.getHours()).padStart(2, "0");
  const min = String(brasilia.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

export default function NovaVisitaExistente() {
  const { pessoaId } = useParams<{ pessoaId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { nomeUsuario } = useAuth();

  const [pessoa, setPessoa] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visitHistory, setVisitHistory] = useState<any[]>([]);

  const [dataHora, setDataHora] = useState(getBrasiliaDateTime());
  const [assunto, setAssunto] = useState("");

  useEffect(() => {
    if (pessoaId) {
      Promise.all([
        supabase.from("pessoas").select("*").eq("id", pessoaId).maybeSingle(),
        supabase.from("visitas").select("id, data_hora, assunto, status").eq("pessoa_id", pessoaId).order("data_hora", { ascending: false }).limit(5),
      ]).then(([{ data: p }, { data: v }]) => {
        setPessoa(p);
        setVisitHistory(v || []);
        setLoading(false);
      });
    }
  }, [pessoaId]);

  const handleSave = async () => {
    if (!assunto) {
      toast({ title: "Selecione o motivo", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("visitas").insert({
        pessoa_id: pessoaId,
        data_hora: dataHora ? new Date(dataHora).toISOString() : new Date().toISOString(),
        assunto,
        status: "Aguardando",
        cadastrado_por: nomeUsuario || "",
      });
      if (error) throw error;
      toast({ title: "✅ Visita registrada!" });
      navigate(-1);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return <AppLayout><div className="card-section animate-pulse h-32" /></AppLayout>;
  }

  if (!pessoa) {
    return <AppLayout><p className="text-center py-16 text-muted-foreground">Pessoa não encontrada.</p></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted active:scale-95 transition">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold">Nova Visita</h2>
      </div>

      {/* Pessoa info */}
      <div className="card-section mb-4 animate-fade-in">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold">{pessoa.nome}</p>
            {pessoa.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {pessoa.whatsapp}</p>}
            {pessoa.municipio && <p className="text-xs text-muted-foreground">{pessoa.municipio}{pessoa.uf ? ` - ${pessoa.uf}` : ""}</p>}
          </div>
        </div>
      </div>

      {/* Histórico */}
      {visitHistory.length > 0 && (
        <div className="card-section mb-4 animate-fade-in">
          <p className="text-sm font-bold text-primary uppercase tracking-wide mb-2">
            📋 Histórico ({visitHistory.length} visita{visitHistory.length !== 1 ? "s" : ""})
          </p>
          <div className="space-y-2">
            {visitHistory.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div>
                  <p className="text-xs font-semibold">{v.assunto || "–"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.data_hora ? new Date(v.data_hora).toLocaleDateString("pt-BR") : "–"}
                  </p>
                </div>
                <span className={cn("text-[10px] font-bold", getStatusColor(v.status))}>{v.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulário simples: só data + motivo */}
      <div className="card-section animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-primary">📝</span>
          <p className="text-sm font-bold text-primary uppercase tracking-wide">Registrar Visita</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Data e hora</label>
            <input
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Motivo / Assunto *</label>
            <input
              type="text"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Descreva o motivo da visita"
              className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full h-12 rounded-lg font-bold text-white gradient-primary shadow-lg shadow-pink-500/25 active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2 text-base"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Salvando…" : "Salvar visita"}
        </button>
        <button onClick={() => navigate(-1)} className="w-full h-10 rounded-lg text-sm text-muted-foreground active:scale-95 transition-transform">
          Cancelar
        </button>
      </div>
    </AppLayout>
  );
}
