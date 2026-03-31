import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Loader2 } from "lucide-react";
import { STATUS_OPTIONS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

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

function toLocalDatetime(iso: string | null) {
  if (!iso) return getBrasiliaDateTime();
  const d = new Date(iso);
  const brasilia = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const y = brasilia.getFullYear();
  const m = String(brasilia.getMonth() + 1).padStart(2, "0");
  const day = String(brasilia.getDate()).padStart(2, "0");
  const h = String(brasilia.getHours()).padStart(2, "0");
  const min = String(brasilia.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-foreground">{label}</label>
    {children}
  </div>
);

const inputClass = "w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50";

export default function EditarVisita() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dataHora, setDataHora] = useState("");
  const [assunto, setAssunto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quemIndicou, setQuemIndicou] = useState("");
  const [origemVisita, setOrigemVisita] = useState("");
  const [status, setStatus] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [nomePessoa, setNomePessoa] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from("visitas")
          .select("*, pessoas(nome)")
          .eq("id", id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setDataHora(toLocalDatetime(data.data_hora));
          setAssunto(data.assunto || "");
          setDescricao(data.descricao_assunto || "");
          setQuemIndicou(data.quem_indicou || "");
          setOrigemVisita(data.origem_visita || "");
          setStatus(data.status || "Aguardando");
          setResponsavel(data.responsavel_tratativa || "");
          setObservacoes(data.observacoes || "");
          setNomePessoa(data.pessoas?.nome || "Visitante");
        }
      } catch {
        // handled silently — user sees empty form
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleSave = async () => {
    if (!assunto) {
      toast({ title: "Assunto obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("visitas").update({
        data_hora: dataHora ? new Date(dataHora).toISOString() : new Date().toISOString(),
        assunto,
        descricao_assunto: descricao || null,
        quem_indicou: quemIndicou || null,
        origem_visita: origemVisita || null,
        status,
        responsavel_tratativa: responsavel || null,
        observacoes: observacoes || null,
        atualizado_em: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast({ title: "✅ Visita atualizada!" });
      navigate(-1);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) return <AppLayout><div className="card-section animate-pulse h-40" /></AppLayout>;

  return (
    <AppLayout>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted active:scale-95 transition">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold">Editar Visita</h2>
          <p className="text-xs text-muted-foreground">{nomePessoa}</p>
        </div>
      </div>

      <div className="space-y-4 animate-fade-in">
        <div className="card-section space-y-4">
          <Field label="Data e hora">
            <input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Assunto *">
            <input type="text" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Motivo da visita" className={inputClass} />
          </Field>
          <Field label="Descrição">
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes..." rows={3}
              className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50 resize-none" />
          </Field>
          <Field label="Quem indicou">
            <input type="text" value={quemIndicou} onChange={(e) => setQuemIndicou(e.target.value)} placeholder="Nome" className={inputClass} />
          </Field>
          <Field label="Origem da visita">
            <input type="text" value={origemVisita} onChange={(e) => setOrigemVisita(e.target.value)} placeholder="Como chegou" className={inputClass} />
          </Field>
        </div>

        <div className="card-section space-y-4">
          <p className="text-sm font-bold text-primary uppercase tracking-wide">Tratativa</p>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none">
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Responsável pela tratativa">
            <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome" className={inputClass} />
          </Field>
          <Field label="Observações">
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações..." rows={3}
              className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50 resize-none" />
          </Field>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full h-12 rounded-lg font-bold text-white gradient-primary shadow-lg shadow-pink-500/25 active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2 text-base">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {saving ? "Salvando…" : "Salvar alterações"}
        </button>
        <button onClick={() => navigate(-1)} className="w-full h-10 rounded-lg text-sm text-muted-foreground active:scale-95 transition-transform mb-4">
          Cancelar
        </button>
        <div className="h-4" />
      </div>
    </AppLayout>
  );
}
