import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Loader2, Lock, CheckCircle2, User, Search, ExternalLink, X } from "lucide-react";
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
  colegio_eleitoral: string;
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
  indicador_tipo: string | null;
  indicador_id: string | null;
  indicador_nome: string | null;
  origem_visita: string;
  status: string;
  responsavel_tratativa: string;
  observacoes: string;
  tipo_visitante: "" | "lideranca" | "fiscal" | "eleitor";
}

interface UsuarioExterno {
  id: string;
  nome: string;
  tipo: string;
  tag: string;
  subtitulo?: string;
  municipio?: string;
  fonte?: string;
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

// Cache global para evitar re-fetch entre renders
let usuariosCacheGlobal: UsuarioExterno[] | null = null;
let usuariosCachePromise: Promise<UsuarioExterno[]> | null = null;

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "hzhxrkurljrogxtzxmmb";
const OWN_FUNCTIONS_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const OWN_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || OWN_ANON_KEY;
  return {
    "Content-Type": "application/json",
    apikey: OWN_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

async function fetchAllUsuariosExternos(): Promise<UsuarioExterno[]> {
  if (usuariosCacheGlobal) return usuariosCacheGlobal;
  if (usuariosCachePromise) return usuariosCachePromise;

  usuariosCachePromise = (async () => {
    const headers = await getAuthHeaders();
    const r = await fetch(`${OWN_FUNCTIONS_URL}/listar-usuarios-externos`, {
      method: "GET",
      headers,
    });
    if (!r.ok) throw new Error(`Status ${r.status}`);
    const data = await r.json();
    if (Array.isArray(data)) {
      usuariosCacheGlobal = data as UsuarioExterno[];
      return usuariosCacheGlobal;
    }
    return [] as UsuarioExterno[];
  })().catch((err) => {
    console.error("[fetchUsuarios] Erro:", err);
    usuariosCachePromise = null;
    return [] as UsuarioExterno[];
  });

  return usuariosCachePromise;
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
  titulo_eleitor: "", zona_eleitoral: "", secao_eleitoral: "", colegio_eleitoral: "",
  municipio: "", uf: "GO", situacao_titulo: "", observacoes_gerais: "",
};

export default function NovaVisita() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pessoaId } = useParams<{ pessoaId?: string }>();
  const { toast } = useToast();
  const { nomeUsuario, isAdmin } = useAuth();
  const isHomePage = location.pathname === "/";

  const [cpfInput, setCpfInput] = useState("");
  const [cpfChecked, setCpfChecked] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(searchInput);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingPessoaId, setExistingPessoaId] = useState<string | null>(pessoaId || null);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pessoaStatus, setPessoaStatus] = useState<"idle" | "found" | "new" | "api">("idle");
  const [visitHistory, setVisitHistory] = useState<any[]>([]);

  // Indicador states
  const [indicadorBusca, setIndicadorBusca] = useState("");
  const [indicadorSelecionado, setIndicadorSelecionado] = useState<UsuarioExterno | null>(null);
  const [indicadorResultados, setIndicadorResultados] = useState<UsuarioExterno[]>([]);
  const [indicadorBuscando, setIndicadorBuscando] = useState(false);
  const [indicadorDropdownAberto, setIndicadorDropdownAberto] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicadorContainerRef = useRef<HTMLDivElement>(null);

  const formMode = pessoaStatus === "found" ? "visit_only" : "full";

  const [pessoa, setPessoa] = useState<DadosPessoa>({ ...EMPTY_PESSOA });
  const [visita, setVisita] = useState<DadosVisita>({
    data_hora: getBrasiliaDateTime(),
    assunto: "", descricao_assunto: "", quem_indicou: "",
    indicador_tipo: null, indicador_id: null, indicador_nome: null,
    origem_visita: "", status: "Aguardando",
    responsavel_tratativa: "", observacoes: "",
    tipo_visitante: "",
  });

  // Close indicador dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (indicadorContainerRef.current && !indicadorContainerRef.current.contains(e.target as Node)) {
        setIndicadorDropdownAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Preload usuarios on mount
  const allUsuariosRef = useRef<UsuarioExterno[]>([]);
  useEffect(() => {
    fetchAllUsuariosExternos()
      .then(data => { allUsuariosRef.current = data; })
      .catch(err => console.error("[NovaVisita] Erro ao carregar usuarios:", err));
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
      setCpfInput(data.cpf && !data.cpf.startsWith("TEMP") ? maskCPF(data.cpf) : "");
      setCpfChecked(true);
      loadVisitHistory(id);
    }
  }

  function fillPessoa(data: any) {
    setPessoa({
      cpf: data.cpf || "", nome: data.nome || "", data_nascimento: data.data_nascimento || "",
      telefone: data.telefone || "", email: data.email || "", whatsapp: data.whatsapp || "",
      instagram: data.instagram || "", outras_redes: data.outras_redes || "",
      titulo_eleitor: data.titulo_eleitor || "", zona_eleitoral: data.zona_eleitoral || "",
      secao_eleitoral: data.secao_eleitoral || "", colegio_eleitoral: data.colegio_eleitoral || "",
      municipio: data.municipio || "", uf: data.uf || "GO", situacao_titulo: data.situacao_titulo || "",
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

  // CPF input handler — auto-check when 11 digits
  const handleCpfInput = async (value: string) => {
    const raw = unmaskCPF(value);
    if (raw.length > 11) return;
    setCpfInput(maskCPF(value));
    setCpfChecked(false);
    setShowForm(false);
    setPessoaStatus("idle");
    setExistingPessoaId(null);
    setPessoa({ ...EMPTY_PESSOA });
    setVisitHistory([]);

    if (raw.length === 11) {
      if (!validateCPF(raw)) {
        toast({ title: "CPF inválido", variant: "destructive" });
        return;
      }
      setSearching(true);
      const { data: existente } = await supabase.from("pessoas").select("*").eq("cpf", raw).maybeSingle();
      if (existente) {
        fillPessoa(existente);
        setExistingPessoaId(existente.id);
        setPessoaStatus("found");
        setCpfChecked(true);
        setShowDuplicateDialog(true);
        loadVisitHistory(existente.id);
        setSearching(false);
        return;
      }
      // Try BrasilAPI
      try {
        const resp = await fetch(`https://brasilapi.com.br/api/cpf/v1/${raw}`);
        if (resp.ok) {
          const data = await resp.json();
          setPessoa(prev => ({ ...prev, cpf: raw, nome: data.nome || "", data_nascimento: data.data_nascimento ? data.data_nascimento.slice(0, 10) : "" }));
          setPessoaStatus("api");
        } else {
          setPessoa(prev => ({ ...prev, cpf: raw }));
          setPessoaStatus("new");
        }
      } catch {
        setPessoa(prev => ({ ...prev, cpf: raw }));
        setPessoaStatus("new");
      }
      setCpfChecked(true);
      setShowForm(true);
      setSearching(false);
    }
  };

  const handleSearch = useCallback(async () => {
    // kept for compatibility but main flow is via CPF
  }, [toast]);

  const handleInputChange = (value: string) => {
    setSearchInput(value);
  };

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setCpfInput("");
    setCpfChecked(false);
    setShowDuplicateDialog(false);
    setSearchInput("");
    setLocked(false);
    setPessoaStatus("idle");
    setShowForm(false);
    setExistingPessoaId(null);
    setPessoa({ ...EMPTY_PESSOA });
    setVisitHistory([]);
    setIndicadorBusca("");
    setIndicadorSelecionado(null);
    setIndicadorResultados([]);
    setIndicadorBuscando(false);
    setIndicadorDropdownAberto(false);
    setVisita({
      data_hora: getBrasiliaDateTime(),
      assunto: "", descricao_assunto: "", quem_indicou: "",
      indicador_tipo: null, indicador_id: null, indicador_nome: null,
      origem_visita: "", status: "Aguardando",
      responsavel_tratativa: "", observacoes: "",
      tipo_visitante: "",
    });
  };

  // ── Indicador search ──
  const handleIndicadorInput = (valor: string) => {
    const termo = valor.trim().toLowerCase();

    setIndicadorBusca(valor);
    setIndicadorSelecionado(null);
    setVisita(prev => ({ ...prev, quem_indicou: valor, indicador_tipo: null, indicador_id: null, indicador_nome: null }));

    if (termo.length < 2) {
      setIndicadorBuscando(false);
      setIndicadorResultados([]);
      setIndicadorDropdownAberto(false);
      return;
    }

    const all = allUsuariosRef.current;
    if (all.length > 0) {
      const filtered = all.filter(u => u.nome?.toLowerCase().includes(termo));
      setIndicadorResultados(filtered);
      setIndicadorDropdownAberto(filtered.length > 0);
      setIndicadorBuscando(false);
      return;
    }

    setIndicadorBuscando(true);
    fetchAllUsuariosExternos().then(data => {
      allUsuariosRef.current = data;
      const filtered = data.filter(u => u.nome?.toLowerCase().includes(termo));
      setIndicadorResultados(filtered);
      setIndicadorDropdownAberto(filtered.length > 0);
      setIndicadorBuscando(false);
    });
  };

  const selecionarIndicador = (item: UsuarioExterno) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIndicadorBuscando(false);
    setIndicadorSelecionado(item);
    setIndicadorBusca(item.nome);
    setIndicadorDropdownAberto(false);
    setVisita(prev => ({ ...prev, quem_indicou: item.nome, indicador_tipo: item.tipo, indicador_id: item.id, indicador_nome: item.nome }));
  };

  const limparIndicador = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIndicadorBuscando(false);
    setIndicadorSelecionado(null);
    setIndicadorBusca("");
    setVisita(prev => ({ ...prev, quem_indicou: "", indicador_tipo: null, indicador_id: null, indicador_nome: null }));
    setIndicadorResultados([]);
    setIndicadorDropdownAberto(false);
  };

  const handleSave = async () => {
    const rawCpf = unmaskCPF(cpfInput);
    if (rawCpf.length !== 11 || !validateCPF(rawCpf)) {
      toast({ title: "CPF obrigatório e válido", variant: "destructive" });
      return;
    }
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
      if (visita.indicador_tipo && visita.indicador_id) {
        visitaPayload.indicador_tipo = visita.indicador_tipo;
        visitaPayload.indicador_id = visita.indicador_id;
      }
      const { error: visitaError } = await supabase.from("visitas").insert(visitaPayload);
      if (visitaError) {
        if (visitaError.message?.includes("indicador_tipo") || visitaError.message?.includes("indicador_id")) {
          delete visitaPayload.indicador_tipo;
          delete visitaPayload.indicador_id;
          const { error: retryError } = await supabase.from("visitas").insert(visitaPayload);
          if (retryError) throw retryError;
        } else {
          throw visitaError;
        }
      }

      // Sincronização fire-and-forget com sistema principal via receber-cadastro-externo
      if (visita.tipo_visitante && visita.indicador_tipo && visita.indicador_id) {
        const cadastroPayload: Record<string, any> = {
          indicador_id: visita.indicador_id,
          indicador_tipo: visita.indicador_tipo,
          indicador_nome: visita.indicador_nome || visita.quem_indicou,
          tipo: visita.tipo_visitante,
          nome: pessoa.nome,
          cpf: pessoa.cpf || null,
          whatsapp: pessoa.whatsapp || null,
          telefone: pessoa.telefone || null,
          email: pessoa.email || null,
          zona_eleitoral: pessoa.zona_eleitoral || null,
          secao_eleitoral: pessoa.secao_eleitoral || null,
          colegio_eleitoral: (pessoa as any).colegio_eleitoral || null,
          municipio_eleitoral: pessoa.municipio || null,
          titulo_eleitor: pessoa.titulo_eleitor || null,
          regiao_atuacao: pessoa.municipio || null,
        };
        getAuthHeaders().then(headers => {
          fetch(`${OWN_FUNCTIONS_URL}/receber-cadastro-externo`, {
            method: "POST",
            headers,
            body: JSON.stringify(cadastroPayload),
          }).then(r => r.json()).then(data => {
            if (data.sucesso) {
              toast({ title: "🔗 Sincronizado!", description: `${pessoa.nome} cadastrado(a) no sistema principal.` });
            } else if (data.aviso) {
              toast({ title: "ℹ️ Aviso", description: data.aviso });
            }
          }).catch(err => {
            console.error("Erro na sincronização:", err);
          });
        });
      }

      toast({ title: "✅ Visita registrada!" });
      clearSearch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

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
      {!isHomePage && (
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted active:scale-95 transition">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">Nova Visita</h2>
        </div>
      )}

      {/* CPF Field — always visible */}
      <div className="card-section mb-4 animate-fade-in">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">CPF *</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={cpfInput}
              onChange={(e) => handleCpfInput(e.target.value)}
              placeholder="000.000.000-00"
              disabled={pessoaId ? true : false}
              className={cn(
                "w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50",
                pessoaId && "opacity-60 bg-muted"
              )}
            />
            {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />}
            {cpfChecked && !searching && pessoaStatus !== "idle" && (
              <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Duplicate person dialog */}
      {showDuplicateDialog && pessoaStatus === "found" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowDuplicateDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <p className="text-base font-bold">Pessoa já cadastrada</p>
                <p className="text-xs text-muted-foreground">Este CPF já existe no sistema</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-bold">{pessoa.nome}</p>
              {pessoa.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {pessoa.whatsapp}</p>}
              {pessoa.municipio && <p className="text-xs text-muted-foreground">{pessoa.municipio}{pessoa.uf ? ` - ${pessoa.uf}` : ""}</p>}
              {visitHistory.length > 0 && (
                <p className="text-xs text-primary font-semibold mt-1">📋 {visitHistory.length} visita{visitHistory.length !== 1 ? "s" : ""} registrada{visitHistory.length !== 1 ? "s" : ""}</p>
              )}
            </div>
            <div className="space-y-2">
              <button
                onClick={() => { setShowDuplicateDialog(false); setShowForm(true); }}
                className="w-full h-11 rounded-lg font-bold text-white gradient-primary active:scale-[0.98] transition-transform text-sm"
              >
                Registrar nova visita
              </button>
              <button
                onClick={() => { setShowDuplicateDialog(false); navigate(`/pessoa/${existingPessoaId}`); }}
                className="w-full h-10 rounded-lg text-sm text-primary font-semibold border border-primary/30 hover:bg-primary/5 active:scale-95 transition"
              >
                Ver cadastro completo
              </button>
              <button
                onClick={() => { setShowDuplicateDialog(false); clearSearch(); }}
                className="w-full h-9 rounded-lg text-xs text-muted-foreground active:scale-95 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {pessoaStatus === "found" && !showDuplicateDialog && showForm && (
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

      {pessoaStatus === "found" && !showDuplicateDialog && showForm && visitHistory.length > 0 && (
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

      {showForm && (
        <div className="space-y-4 animate-fade-in">

          {(formMode === "full" || isAdmin) && (
            <div className="card-section">
              <div className="flex items-center gap-2 mb-4">
                <User size={16} className="text-primary" />
                <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados Pessoais</p>
              </div>
              <div className="space-y-4">
                <InputField label="Nome completo *" value={pessoa.nome} onChange={(v) => setPessoa({ ...pessoa, nome: v })} placeholder="Nome completo" />
                <InputField label="WhatsApp" value={pessoa.whatsapp} onChange={(v) => setPessoa({ ...pessoa, whatsapp: maskPhone(v) })} placeholder="(00) 00000-0000" />
                <InputField label="Rede social (Instagram ou Facebook)" value={pessoa.instagram} onChange={(v) => setPessoa({ ...pessoa, instagram: v })} placeholder="@usuario ou link" />
                <InputField label="Data de nascimento" value={pessoa.data_nascimento} onChange={(v) => setPessoa({ ...pessoa, data_nascimento: v })} type="date" />
              </div>
            </div>
          )}

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
                <InputField label="Colégio eleitoral" value={pessoa.colegio_eleitoral || ""} onChange={(v) => setPessoa({ ...pessoa, colegio_eleitoral: v })} placeholder="Nome do colégio eleitoral" />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Município" value={pessoa.municipio} onChange={(v) => setPessoa({ ...pessoa, municipio: v })} placeholder="Cidade" />
                  <SelectField label="UF" value={pessoa.uf} onChange={(v) => setPessoa({ ...pessoa, uf: v })} options={UF_OPTIONS} />
                </div>
                
              </div>
            </div>
          )}

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

              {/* Quem indicou — busca via Edge Function */}
              <div className="space-y-1.5 relative" ref={indicadorContainerRef}>
                <label className="text-xs font-bold text-foreground">Quem indicou / Responsável</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={indicadorBusca}
                    onChange={(e) => handleIndicadorInput(e.target.value)}
                    onFocus={() => indicadorResultados.length > 0 && setIndicadorDropdownAberto(true)}
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
                          {u.subtitulo && (
                            <p className="text-xs text-muted-foreground">{u.subtitulo}</p>
                          )}
                        </div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0", getTagColor(u.tipo))}>
                          {u.tag}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tipo do visitante */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Tipo do visitante</label>
                <div className="flex gap-2">
                  {([
                    { valor: "lideranca", emoji: "🤝", label: "Liderança" },
                    { valor: "fiscal", emoji: "🗳️", label: "Fiscal" },
                    { valor: "eleitor", emoji: "👤", label: "Eleitor" },
                  ] as const).map((op) => (
                    <button
                      key={op.valor}
                      type="button"
                      onClick={() => setVisita(prev => ({
                        ...prev,
                        tipo_visitante: prev.tipo_visitante === op.valor ? "" : op.valor
                      }))}
                      className={cn(
                        "flex-1 h-10 rounded-lg text-xs font-semibold border transition-all active:scale-95",
                        visita.tipo_visitante === op.valor
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-background border-border text-muted-foreground"
                      )}
                    >
                      {op.emoji} {op.label}
                    </button>
                  ))}
                </div>
              </div>
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
