import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Loader2, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  fetchAllUsuariosExternos,
  filterUsuariosExternos,
  subscribeToUsuariosExternos,
  type UsuarioExterno,
} from "@/lib/indicadoresExternos";

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

function getTagColor(tipo: string): string {
  switch (tipo) {
    case "suplente": return "bg-emerald-500/15 text-emerald-600";
    case "super_admin":
    case "coordenador": return "bg-purple-500/15 text-purple-600";
    case "lideranca":
    case "lideranca_cadastrada": return "bg-blue-500/15 text-blue-600";
    case "fiscal":
    case "fiscal_cadastrado": return "bg-orange-500/15 text-orange-600";
    case "eleitor_cadastrado": return "bg-gray-500/15 text-gray-500";
    default: return "bg-muted text-muted-foreground";
  }
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
  const [nomePessoa, setNomePessoa] = useState("");

  // Indicador autocomplete states
  const [indicadorBusca, setIndicadorBusca] = useState("");
  const [indicadorSelecionado, setIndicadorSelecionado] = useState<UsuarioExterno | null>(null);
  const [indicadorResultados, setIndicadorResultados] = useState<UsuarioExterno[]>([]);
  const [indicadorBuscando, setIndicadorBuscando] = useState(false);
  const [indicadorDropdownAberto, setIndicadorDropdownAberto] = useState(false);
  const indicadorContainerRef = useRef<HTMLDivElement>(null);
  const allUsuariosRef = useRef<UsuarioExterno[]>([]);
  const indicadorBuscaRef = useRef("");

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (indicadorContainerRef.current && !indicadorContainerRef.current.contains(e.target as Node)) {
        setIndicadorDropdownAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const refreshUsuariosExternos = useCallback(async (force = false) => {
    try {
      const data = await fetchAllUsuariosExternos({ force });
      allUsuariosRef.current = data;
      const termoAtual = indicadorBuscaRef.current.trim();
      if (termoAtual.length >= 2) {
        const filtrados = filterUsuariosExternos(data, termoAtual);
        setIndicadorResultados(filtrados);
        setIndicadorDropdownAberto((aberto) => aberto && filtrados.length > 0);
      }
    } catch (err) {
      console.error("[EditarVisita] Erro ao carregar usuarios:", err);
    } finally {
      setIndicadorBuscando(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsuariosExternos(true);
    const unsubscribe = subscribeToUsuariosExternos(() => {
      void refreshUsuariosExternos(true);
    }, "editar-visita");
    return () => unsubscribe();
  }, [refreshUsuariosExternos]);

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
          // Set initial indicador search text
          if (data.quem_indicou) {
            setIndicadorBusca(data.quem_indicou);
            indicadorBuscaRef.current = data.quem_indicou;
          }
        }
      } catch {
        // handled silently
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleIndicadorInput = (valor: string) => {
    const termo = valor.trim();
    indicadorBuscaRef.current = valor;
    setIndicadorBusca(valor);
    setIndicadorSelecionado(null);
    setQuemIndicou(valor);

    if (termo.length < 2) {
      setIndicadorBuscando(false);
      setIndicadorResultados([]);
      setIndicadorDropdownAberto(false);
      return;
    }

    const filtrados = filterUsuariosExternos(allUsuariosRef.current, termo);
    setIndicadorResultados(filtrados);
    setIndicadorDropdownAberto(true);

    if (allUsuariosRef.current.length === 0 || filtrados.length === 0) {
      setIndicadorBuscando(true);
      void refreshUsuariosExternos(true);
      return;
    }
    setIndicadorBuscando(false);
  };

  const selecionarIndicador = (item: UsuarioExterno) => {
    setIndicadorBuscando(false);
    setIndicadorSelecionado(item);
    indicadorBuscaRef.current = item.nome;
    setIndicadorBusca(item.nome);
    setIndicadorDropdownAberto(false);
    setQuemIndicou(item.nome);
  };

  const limparIndicador = () => {
    setIndicadorBuscando(false);
    setIndicadorSelecionado(null);
    indicadorBuscaRef.current = "";
    setIndicadorBusca("");
    setQuemIndicou("");
    setIndicadorResultados([]);
    setIndicadorDropdownAberto(false);
  };

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

  if (loading) {
    return <AppLayout><div className="card-section animate-pulse h-32" /></AppLayout>;
  }

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

          {/* Quem indicou — busca com autocomplete */}
          <div className="space-y-1.5 relative" ref={indicadorContainerRef}>
            <label className="text-xs font-bold text-foreground">Quem indicou (Suplente / Liderança)</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={indicadorBusca}
                onChange={(e) => handleIndicadorInput(e.target.value)}
                onFocus={() => {
                  if (indicadorBusca.trim().length >= 2 || indicadorResultados.length > 0) {
                    setIndicadorDropdownAberto(true);
                  }
                  void refreshUsuariosExternos(true);
                }}
                placeholder="Buscar por nome..."
                className="w-full h-12 rounded-lg bg-background border border-border pl-9 pr-10 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50"
              />
              {indicadorBuscando && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
              {indicadorSelecionado && !indicadorBuscando && (
                <button type="button" onClick={limparIndicador} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>

            {indicadorSelecionado && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold", getTagColor(indicadorSelecionado.tipo))}>
                  {indicadorSelecionado.tag}
                </span>
                <span className="text-xs text-muted-foreground">{indicadorSelecionado.subtitulo || indicadorSelecionado.nome}</span>
              </div>
            )}

            {indicadorDropdownAberto && indicadorResultados.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
                {indicadorResultados.map((u) => (
                  <button key={`${u.id}-${u.tipo}`} type="button" onClick={() => selecionarIndicador(u)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center justify-between transition-colors cursor-pointer border-b border-border/30 last:border-0">
                    <div>
                      <span className="text-sm font-semibold">{u.nome}</span>
                      {u.subtitulo && <p className="text-xs text-muted-foreground">{u.subtitulo}</p>}
                    </div>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0", getTagColor(u.tipo))}>
                      {u.tag}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
