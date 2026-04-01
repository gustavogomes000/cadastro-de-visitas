import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import QuemIndicouSelector from "@/components/QuemIndicouSelector";
import { ArrowLeft, Loader2, Lock, CheckCircle2, AlertCircle, User, Search, ExternalLink } from "lucide-react";
import { maskCPF, unmaskCPF, maskPhone, maskTitulo, validateCPF } from "@/lib/masks";
import { ASSUNTOS, ORIGENS_VISITA, STATUS_OPTIONS, UF_OPTIONS } from "@/lib/constants";
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

interface DadosPessoa {
  cpf: string;
  nome: string;
  data_nascimento: string;
  telefone: string;
  email: string;
  whatsapp: string;
  instagram: string;
  outras_redes: string;
  titulo_eleitor: string;
  zona_eleitoral: string;
  secao_eleitoral: string;
  municipio: string;
  uf: string;
  situacao_titulo: string;
  observacoes_gerais: string;
}

interface DadosVisita {
  data_hora: string;
  assunto: string;
  descricao_assunto: string;
  quem_indicou: string;
  indicador_tipo: "suplente" | "lideranca" | null;
  indicador_id: string | null;
  origem_visita: string;
  status: string;
  responsavel_tratativa: string;
  observacoes: string;
}

const InputField = ({ label, value, onChange, placeholder, type = "text", readonly = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; readonly?: boolean;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-foreground">{label}</label>
    <div className="relative">
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        readOnly={readonly} placeholder={placeholder}
        className={cn(
          "w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50",
          readonly && "opacity-60 bg-muted"
        )} />
      {readonly && <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-foreground">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none">
      <option value="">{placeholder || "Selecione…"}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const EMPTY_PESSOA: DadosPessoa = {
  cpf: "", nome: "", data_nascimento: "", telefone: "", email: "",
  whatsapp: "", instagram: "", outras_redes: "",
  titulo_eleitor: "", zona_eleitoral: "", secao_eleitoral: "",
  municipio: "", uf: "", situacao_titulo: "", observacoes_gerais: "",
};

export default function NovaVisita() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pessoaId } = useParams<{ pessoaId?: string }>();
  const { toast } = useToast();
  const { nomeUsuario, isAdmin } = useAuth();
  const isHomePage = location.pathname === "/";

  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(searchInput);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingPessoaId, setExistingPessoaId] = useState<string | null>(pessoaId || null);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [pessoaStatus, setPessoaStatus] = useState<"idle" | "found" | "new" | "api">("idle");
  const [visitHistory, setVisitHistory] = useState<any[]>([]);

  const formMode = pessoaStatus === "found" ? "visit_only" : "full";

  const [pessoa, setPessoa] = useState<DadosPessoa>({ ...EMPTY_PESSOA });
  const [visita, setVisita] = useState<DadosVisita>({
    data_hora: getBrasiliaDateTime(),
    assunto: "", descricao_assunto: "", quem_indicou: "",
    indicador_tipo: null, indicador_id: null,
    origem_visita: "", status: "Aguardando",
    responsavel_tratativa: "", observacoes: "",
  });

  useEffect(() => {
    if (pessoaId) loadExistingPessoa(pessoaId);
  }, [pessoaId]);

  async function loadExistingPessoa(id: string) {
    const { data } = await supabase.from("pessoas").select("*").eq("id", id).maybeSingle();
    if (data) {
      fillPessoa(data);
      setExistingPessoaId(id);
      setPessoaStatus("found");
      setLocked(true);
      setShowForm(true);
      setSearchInput(data.cpf && !data.cpf.startsWith("TEMP") ? maskCPF(data.cpf) : data.nome || "");
      loadVisitHistory(id);
    }
  }

  function fillPessoa(data: any) {
    setPessoa({
      cpf: data.cpf || "", nome: data.nome || "", data_nascimento: data.data_nascimento || "",
      telefone: data.telefone || "", email: data.email || "", whatsapp: data.whatsapp || "",
      instagram: data.instagram || "", outras_redes: data.outras_redes || "",
      titulo_eleitor: data.titulo_eleitor || "", zona_eleitoral: data.zona_eleitoral || "",
      secao_eleitoral: data.secao_eleitoral || "", municipio: data.municipio || "",
      uf: data.uf || "", situacao_titulo: data.situacao_titulo || "",
      observacoes_gerais: data.observacoes_gerais || "",
    });
  }

  async function loadVisitHistory(pessoaId: string) {
    const { data } = await supabase
      .from("visitas")
      .select("id, data_hora, assunto, status")
      .eq("pessoa_id", pessoaId)
      .order("data_hora", { ascending: false })
      .limit(5);
    setVisitHistory(data || []);
  }

  searchInputRef.current = searchInput;

  const handleSearch = useCallback(async () => {
    const trimmed = searchInputRef.current.trim();
    if (!trimmed) return;
    setSearching(true);
    const raw = unmaskCPF(trimmed);
    const isCPF = raw.length >= 11 && /^\d{11}$/.test(raw.slice(0, 11));

    if (isCPF) {
      if (!validateCPF(raw.slice(0, 11))) {
        toast({ title: "CPF inválido", variant: "destructive" });
        setSearching(false);
        return;
      }
      const { data: existente } = await supabase.from("pessoas").select("*").eq("cpf", raw.slice(0, 11)).maybeSingle();
      if (existente) {
        fillPessoa(existente);
        setExistingPessoaId(existente.id);
        setPessoaStatus("found");
        setLocked(true);
        setShowForm(true);
        loadVisitHistory(existente.id);
        setSearching(false);
        return;
      }
      try {
        const resp = await fetch(`https://brasilapi.com.br/api/cpf/v1/${raw.slice(0, 11)}`);
        if (resp.ok) {
          const data = await resp.json();
          setPessoa(prev => ({ ...prev, cpf: raw.slice(0, 11), nome: data.nome || "", data_nascimento: data.data_nascimento ? data.data_nascimento.slice(0, 10) : "" }));
          setPessoaStatus("api");
        } else {
          setPessoa(prev => ({ ...prev, cpf: raw.slice(0, 11) }));
          setPessoaStatus("new");
        }
      } catch {
        setPessoa(prev => ({ ...prev, cpf: raw.slice(0, 11) }));
        setPessoaStatus("new");
      }
      setLocked(true);
      setShowForm(true);
    } else {
      const { data: matches } = await supabase.from("pessoas").select("*").ilike("nome", `%${trimmed}%`).limit(1);
      if (matches && matches.length > 0) {
        fillPessoa(matches[0]);
        setExistingPessoaId(matches[0].id);
        setPessoaStatus("found");
        setLocked(true);
        setShowForm(true);
        loadVisitHistory(matches[0].id);
      } else {
        setPessoa(prev => ({ ...prev, nome: trimmed }));
        setPessoaStatus("new");
        setLocked(true);
        setShowForm(true);
      }
    }
    setSearching(false);
  }, [toast]);

  const handleInputChange = (value: string) => {
    const raw = unmaskCPF(value);
    if (/^\d+$/.test(raw) && raw.length <= 11) {
      const masked = maskCPF(value);
      setSearchInput(masked);
      // Auto-search when 11 digits
      if (raw.length === 11) {
        setPessoa(prev => ({ ...prev, cpf: raw }));
        searchInputRef.current = masked;
        handleSearch();
      }
    } else {
      setSearchInput(value);
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    setLocked(false);
    setPessoaStatus("idle");
    setShowForm(true);
    setExistingPessoaId(null);
    setPessoa({ ...EMPTY_PESSOA });
    setVisitHistory([]);
    setVisita({
      data_hora: getBrasiliaDateTime(),
      assunto: "", descricao_assunto: "", quem_indicou: "",
      indicador_tipo: null, indicador_id: null,
      origem_visita: "", status: "Aguardando",
      responsavel_tratativa: "", observacoes: "",
    });
  };

  const handleSave = async () => {
    if (!pessoa.nome && formMode === "full") {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (!visita.assunto) {
      toast({ title: "Assunto obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let pid: string;
      if (existingPessoaId) {
        pid = existingPessoaId;
        if (isAdmin || formMode === "full") {
          await supabase.from("pessoas").update({
            nome: pessoa.nome, telefone: pessoa.telefone || null, email: pessoa.email || null,
            whatsapp: pessoa.whatsapp || null, instagram: pessoa.instagram || null,
            outras_redes: pessoa.outras_redes || null, titulo_eleitor: pessoa.titulo_eleitor || null,
            zona_eleitoral: pessoa.zona_eleitoral || null, secao_eleitoral: pessoa.secao_eleitoral || null,
            municipio: pessoa.municipio || null, uf: pessoa.uf || null,
            data_nascimento: pessoa.data_nascimento || null, situacao_titulo: pessoa.situacao_titulo || null,
            observacoes_gerais: pessoa.observacoes_gerais || null, atualizado_em: new Date().toISOString(),
          }).eq("id", pid);
        }
      } else {
        const cpfToSave = pessoa.cpf || `TEMP${Date.now()}`;
        const { data: novaPessoa, error } = await supabase.from("pessoas").insert({
          cpf: cpfToSave, nome: pessoa.nome, telefone: pessoa.telefone || null, email: pessoa.email || null,
          whatsapp: pessoa.whatsapp || null, instagram: pessoa.instagram || null,
          outras_redes: pessoa.outras_redes || null, titulo_eleitor: pessoa.titulo_eleitor || null,
          zona_eleitoral: pessoa.zona_eleitoral || null, secao_eleitoral: pessoa.secao_eleitoral || null,
          municipio: pessoa.municipio || null, uf: pessoa.uf || null,
          data_nascimento: pessoa.data_nascimento || null, situacao_titulo: pessoa.situacao_titulo || null,
          observacoes_gerais: pessoa.observacoes_gerais || null,
        }).select("id").single();
        if (error) throw error;
        pid = novaPessoa.id;
      }

      const visitaPayload: Record<string, any> = {
        pessoa_id: pid,
        data_hora: visita.data_hora ? new Date(visita.data_hora).toISOString() : new Date().toISOString(),
        assunto: visita.assunto, descricao_assunto: visita.descricao_assunto || null,
        quem_indicou: visita.quem_indicou || null, origem_visita: visita.origem_visita || null,
        status: visita.status, responsavel_tratativa: visita.responsavel_tratativa || null,
        observacoes: visita.observacoes || null, cadastrado_por: nomeUsuario || "",
      };
      // Add indicador fields only if columns exist (silently ignore if they don't)
      if (visita.indicador_tipo && visita.indicador_id) {
        visitaPayload.indicador_tipo = visita.indicador_tipo;
        visitaPayload.indicador_id = visita.indicador_id;
      }
      const { error: visitaError } = await supabase.from("visitas").insert(visitaPayload);
      if (visitaError) {
        // If error is about unknown columns, retry without them
        if (visitaError.message?.includes("indicador_tipo") || visitaError.message?.includes("indicador_id")) {
          delete visitaPayload.indicador_tipo;
          delete visitaPayload.indicador_id;
          const { error: retryError } = await supabase.from("visitas").insert(visitaPayload);
          if (retryError) throw retryError;
        } else {
          throw visitaError;
        }
      }

      toast({ title: "✅ Visita registrada!" });
      clearSearch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  // getStatusColor moved here, InputField/SelectField moved outside component
  const localGetStatusColor = (status: string) => {
    switch (status) {
      case "Aguardando": return "text-yellow-600 dark:text-yellow-400";
      case "Em andamento": return "text-blue-600 dark:text-blue-400";
      case "Resolvido": return "text-emerald-600 dark:text-emerald-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <AppLayout>
      {/* Header - show back arrow only when not home */}
      {!isHomePage && (
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted active:scale-95 transition">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">Nova Visita</h2>
        </div>
      )}

      {/* Status badges */}
      {pessoaStatus === "found" && (
        <div className="card-section mb-4 animate-fade-in">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">{pessoa.nome}</p>
              <p className="text-xs text-muted-foreground">Pessoa cadastrada — registre a visita abaixo</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Visit History ── */}
      {pessoaStatus === "found" && visitHistory.length > 0 && (
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
                <span className={cn("text-[10px] font-bold", localGetStatusColor(v.status))}>{v.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Registration Form ── */}
      {showForm && (
        <div className="space-y-4 animate-fade-in">

          {/* DADOS PESSOAIS */}
          {(formMode === "full" || isAdmin) && (
            <div className="card-section">
              <div className="flex items-center gap-2 mb-4">
                <User size={16} className="text-primary" />
                <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados Pessoais</p>
              </div>
              <div className="space-y-4">
                <InputField label="Nome completo *" value={pessoa.nome} onChange={(v) => setPessoa({ ...pessoa, nome: v })} placeholder="Nome da liderança" />
                <InputField label="CPF" value={maskCPF(pessoa.cpf)} onChange={(v) => {
                  const raw = unmaskCPF(v);
                  if (raw.length <= 11) setPessoa({ ...pessoa, cpf: raw });
                }} placeholder="000.000.000-00" />
                <InputField label="WhatsApp" value={pessoa.whatsapp} onChange={(v) => setPessoa({ ...pessoa, whatsapp: maskPhone(v) })} placeholder="(00) 00000-0000" />
                
                <InputField label="Rede social (Instagram ou Facebook)" value={pessoa.instagram} onChange={(v) => setPessoa({ ...pessoa, instagram: v })} placeholder="@usuario ou link" />
                <InputField label="Data de nascimento" value={pessoa.data_nascimento} onChange={(v) => setPessoa({ ...pessoa, data_nascimento: v })} type="date" />
              </div>
            </div>
          )}

          {/* DADOS ELEITORAIS */}
          {(formMode === "full" || isAdmin) && (
            <div className="card-section">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-primary">🗳️</span>
                  <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados Eleitorais</p>
                </div>
                <a href="https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor"
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline active:scale-95 transition-transform">
                  <ExternalLink size={13} />
                  Consultar TSE
                </a>
              </div>
              <div className="space-y-4">
                <InputField label="Título de eleitor" value={pessoa.titulo_eleitor} onChange={(v) => setPessoa({ ...pessoa, titulo_eleitor: maskTitulo(v) })} placeholder="0000 0000 0000" />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Zona eleitoral" value={pessoa.zona_eleitoral} onChange={(v) => setPessoa({ ...pessoa, zona_eleitoral: v.replace(/\D/g, "") })} placeholder="Ex: 42" />
                  <InputField label="Seção" value={pessoa.secao_eleitoral} onChange={(v) => setPessoa({ ...pessoa, secao_eleitoral: v.replace(/\D/g, "") })} placeholder="Ex: 123" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Município" value={pessoa.municipio} onChange={(v) => setPessoa({ ...pessoa, municipio: v })} placeholder="Cidade" />
                  <SelectField label="UF" value={pessoa.uf} onChange={(v) => setPessoa({ ...pessoa, uf: v })} options={UF_OPTIONS} />
                </div>
                <SelectField label="Situação do título" value={pessoa.situacao_titulo} onChange={(v) => setPessoa({ ...pessoa, situacao_titulo: v })} options={["Regular", "Cancelado", "Suspenso", "Não possui"]} />
              </div>
            </div>
          )}

          {/* Person summary for recepcao when person already exists */}
          {formMode === "visit_only" && !isAdmin && (
            <div className="card-section">
              <div className="flex items-center gap-2 mb-2">
                <User size={16} className="text-primary" />
                <p className="text-sm font-bold text-primary uppercase tracking-wide">Visitante</p>
              </div>
              <p className="text-sm font-semibold">{pessoa.nome}</p>
              {pessoa.telefone && <p className="text-xs text-muted-foreground">Tel: {pessoa.telefone}</p>}
              {pessoa.municipio && <p className="text-xs text-muted-foreground">{pessoa.municipio} - {pessoa.uf}</p>}
            </div>
          )}

          {/* DADOS DA VISITA */}
          <div className="card-section">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-primary">📝</span>
              <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados da Visita</p>
            </div>
            <div className="space-y-4">
              <InputField label="Data e hora" value={visita.data_hora} onChange={(v) => setVisita({ ...visita, data_hora: v })} type="datetime-local" />
              <InputField label="Assunto *" value={visita.assunto} onChange={(v) => setVisita({ ...visita, assunto: v })} placeholder="Descreva o motivo da visita" />
              <QuemIndicouSelector
                value={visita.quem_indicou}
                onChange={(nome, tipo, id) => setVisita({ ...visita, quem_indicou: nome, indicador_tipo: tipo, indicador_id: id })}
              />
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-lg font-bold text-white gradient-primary shadow-lg shadow-pink-500/25 active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2 text-base">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Salvando…" : "Salvar visita"}
          </button>

          {!isHomePage && (
            <button onClick={() => navigate(-1)} className="w-full h-10 rounded-lg text-sm text-muted-foreground active:scale-95 transition-transform mb-4">
              Cancelar
            </button>
          )}

          <div className="h-4" />
        </div>
      )}
    </AppLayout>
  );
}
