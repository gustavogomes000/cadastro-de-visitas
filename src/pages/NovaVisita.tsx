import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Loader2, Lock, CheckCircle2, User, Search, ExternalLink, X } from "lucide-react";
import { maskCPF, unmaskCPF, maskPhone, maskTitulo, validateCPF } from "@/lib/masks";
import { ASSUNTOS, UF_OPTIONS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
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

  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicatePessoa, setDuplicatePessoa] = useState<any>(null);
  const [searchInput, setSearchInput] = useState("");
  const searchInputRef = useRef(searchInput);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingPessoaId, setExistingPessoaId] = useState<string | null>(pessoaId || null);
  const [locked, setLocked] = useState(false);
  const [showForm, setShowForm] = useState(true);
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

  // Nome autocomplete states
  const [nomeSugestoes, setNomeSugestoes] = useState<{ id: string; nome: string; cpf?: string; municipio?: string; uf?: string; whatsapp?: string }[]>([]);
  const [nomeBuscando, setNomeBuscando] = useState(false);
  const [nomeDropdownAberto, setNomeDropdownAberto] = useState(false);
  const nomeContainerRef = useRef<HTMLDivElement>(null);
  const nomeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CPF autocomplete states
  const [cpfSugestoes, setCpfSugestoes] = useState<{ id: string; nome: string; cpf: string; municipio?: string }[]>([]);
  const [cpfDropdownAberto, setCpfDropdownAberto] = useState(false);
  const cpfContainerRef = useRef<HTMLDivElement>(null);
  const cpfDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formMode = pessoaStatus === "found" ? "visit_only" : "full";

  const [pessoa, setPessoa] = useState<DadosPessoa>({ ...EMPTY_PESSOA });
  const [visita, setVisita] = useState<DadosVisita>({
    data_hora: getBrasiliaDateTime(),
    assunto: "", descricao_assunto: "", quem_indicou: "",
    indicador_tipo: null, indicador_id: null, indicador_nome: null,
    origem_visita: "",
  });

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (indicadorContainerRef.current && !indicadorContainerRef.current.contains(e.target as Node)) {
        setIndicadorDropdownAberto(false);
      }
      if (nomeContainerRef.current && !nomeContainerRef.current.contains(e.target as Node)) {
        setNomeDropdownAberto(false);
      }
      if (cpfContainerRef.current && !cpfContainerRef.current.contains(e.target as Node)) {
        setCpfDropdownAberto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Nome autocomplete search
  const handleNomeInput = (value: string) => {
    setPessoa(prev => ({ ...prev, nome: value }));
    const termo = value.trim();
    if (termo.length < 2) {
      setNomeSugestoes([]);
      setNomeDropdownAberto(false);
      return;
    }
    if (nomeDebounceRef.current) clearTimeout(nomeDebounceRef.current);
    setNomeBuscando(true);
    nomeDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("pessoas")
        .select("id, nome, cpf, municipio, uf, whatsapp")
        .or("origem.is.null,origem.neq.DESATIVADO")
        .ilike("nome", `%${termo}%`)
        .limit(8);
      setNomeSugestoes(data || []);
      setNomeDropdownAberto(true);
      setNomeBuscando(false);
    }, 150);
  };

  const allUsuariosRef = useRef<UsuarioExterno[]>([]);
  const indicadorBuscaRef = useRef("");

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
      console.error("[NovaVisita] Erro ao carregar usuarios:", err);
    } finally {
      setIndicadorBuscando(false);
    }
  }, []);

  useEffect(() => {
    void refreshUsuariosExternos(true);

    const unsubscribe = subscribeToUsuariosExternos(() => {
      void refreshUsuariosExternos(true);
    }, "nova-visita");

    const intervalId = window.setInterval(() => {
      void refreshUsuariosExternos(true);
    }, 5000);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [refreshUsuariosExternos]);

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

  const handleCpfChange = async (value: string) => {
    const raw = unmaskCPF(value);
    if (raw.length > 11) return;
    setPessoa(prev => ({ ...prev, cpf: raw }));

    // Search by partial CPF (at least 3 digits)
    if (raw.length >= 3 && raw.length < 11) {
      if (cpfDebounceRef.current) clearTimeout(cpfDebounceRef.current);
      cpfDebounceRef.current = setTimeout(async () => {
        const { data } = await supabase
          .from("pessoas")
          .select("id, nome, cpf, municipio")
          .or("origem.is.null,origem.neq.DESATIVADO")
          .ilike("cpf", `${raw}%`)
          .order("nome")
          .limit(5);
        setCpfSugestoes(data || []);
        setCpfDropdownAberto((data || []).length > 0);
      }, 300);
    } else {
      setCpfSugestoes([]);
      setCpfDropdownAberto(false);
    }

    if (raw.length === 11) {
      setCpfDropdownAberto(false);
      setCpfSugestoes([]);
      if (!validateCPF(raw)) {
        toast({ title: "CPF inválido", variant: "destructive" });
        return;
      }
      const { data: existente } = await supabase.from("pessoas").select("*").eq("cpf", raw).or("origem.is.null,origem.neq.DESATIVADO").maybeSingle();
      if (existente && existente.id !== existingPessoaId) {
        navigate(`/nova-visita-existente/${existente.id}`);
      }
    }
  };

  const handleDuplicateRegisterVisit = () => {
    if (duplicatePessoa) {
      fillPessoa(duplicatePessoa);
      setExistingPessoaId(duplicatePessoa.id);
      setPessoaStatus("found");
      setShowDuplicateDialog(false);
    }
  };

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
      const { data: existente } = await supabase.from("pessoas").select("*").eq("cpf", raw.slice(0, 11)).or("origem.is.null,origem.neq.DESATIVADO").maybeSingle();
      if (existente) {
        navigate(`/nova-visita-existente/${existente.id}`);
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
      const { data: matches } = await supabase.from("pessoas").select("*").or("origem.is.null,origem.neq.DESATIVADO").ilike("nome", `%${trimmed}%`).limit(1);
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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setShowDuplicateDialog(false);
    setDuplicatePessoa(null);
    setSearchInput("");
    setLocked(false);
    setPessoaStatus("idle");
    setShowForm(true);
    setExistingPessoaId(null);
    setPessoa({ ...EMPTY_PESSOA });
    setVisitHistory([]);
    indicadorBuscaRef.current = "";
    setIndicadorBusca("");
    setIndicadorSelecionado(null);
    setIndicadorResultados([]);
    setIndicadorBuscando(false);
    setIndicadorDropdownAberto(false);
    setVisita({
      data_hora: getBrasiliaDateTime(),
      assunto: "", descricao_assunto: "", quem_indicou: "",
      indicador_tipo: null, indicador_id: null, indicador_nome: null,
      origem_visita: "",
    });
  };

  // ── Indicador search ──
  const handleIndicadorInput = (valor: string) => {
    const termo = valor.trim();

    indicadorBuscaRef.current = valor;
    setIndicadorBusca(valor);
    setIndicadorSelecionado(null);
    setVisita(prev => ({ ...prev, quem_indicou: valor, indicador_tipo: null, indicador_id: null, indicador_nome: null }));

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIndicadorBuscando(false);
    setIndicadorSelecionado(item);
    indicadorBuscaRef.current = item.nome;
    setIndicadorBusca(item.nome);
    setIndicadorDropdownAberto(false);
    setVisita(prev => ({ ...prev, quem_indicou: item.nome, indicador_tipo: item.tipo, indicador_id: item.id, indicador_nome: item.nome }));
  };

  const limparIndicador = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIndicadorBuscando(false);
    setIndicadorSelecionado(null);
    indicadorBuscaRef.current = "";
    setIndicadorBusca("");
    setVisita(prev => ({ ...prev, quem_indicou: "", indicador_tipo: null, indicador_id: null, indicador_nome: null }));
    setIndicadorResultados([]);
    setIndicadorDropdownAberto(false);
  };

  const handleSave = async () => {
    if (pessoaStatus !== "found") {
      if (!pessoa.cpf || pessoa.cpf.length !== 11 || !validateCPF(pessoa.cpf)) {
        toast({ title: "CPF obrigatório e válido", variant: "destructive" });
        return;
      }
      if (!pessoa.nome) {
        toast({ title: "Nome obrigatório", variant: "destructive" });
        return;
      }
      if (!pessoa.whatsapp || pessoa.whatsapp.replace(/\D/g, "").length < 10) {
        toast({ title: "WhatsApp obrigatório", variant: "destructive" });
        return;
      }
      if (!pessoa.data_nascimento) {
        toast({ title: "Data de nascimento obrigatória", variant: "destructive" });
        return;
      }
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
        // Check if there's a DESATIVADO person with this CPF — reactivate instead of inserting
        const { data: desativado } = pessoa.cpf
          ? await supabase.from("pessoas").select("id").eq("cpf", pessoa.cpf).eq("origem", "DESATIVADO").maybeSingle()
          : { data: null };
        if (desativado) {
          await supabase.from("pessoas").update({
            nome: pessoa.nome, telefone: pessoa.telefone || null, email: pessoa.email || null,
            whatsapp: pessoa.whatsapp || null, instagram: pessoa.instagram || null,
            outras_redes: pessoa.outras_redes || null, titulo_eleitor: pessoa.titulo_eleitor || null,
            zona_eleitoral: pessoa.zona_eleitoral || null, secao_eleitoral: pessoa.secao_eleitoral || null,
            municipio: pessoa.municipio || null, uf: pessoa.uf || null,
            data_nascimento: pessoa.data_nascimento || null, situacao_titulo: pessoa.situacao_titulo || null,
            observacoes_gerais: pessoa.observacoes_gerais || null, origem: null,
            atualizado_em: new Date().toISOString(),
          }).eq("id", desativado.id);
          pid = desativado.id;
        } else {
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
      }

      const visitaPayload: Record<string, any> = {
        pessoa_id: pid,
        data_hora: visita.data_hora ? new Date(visita.data_hora).toISOString() : new Date().toISOString(),
        assunto: visita.assunto, descricao_assunto: visita.descricao_assunto || null,
        quem_indicou: visita.quem_indicou || null, origem_visita: visita.origem_visita || null,
        status: "Aguardando", cadastrado_por: nomeUsuario || "",
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

      toast({ title: "✅ Visita registrada!" });
      clearSearch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
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

      {/* Duplicate person dialog */}
      {showDuplicateDialog && duplicatePessoa && (
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
              <p className="text-sm font-bold">{duplicatePessoa.nome}</p>
              {duplicatePessoa.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {duplicatePessoa.whatsapp}</p>}
              {duplicatePessoa.municipio && <p className="text-xs text-muted-foreground">{duplicatePessoa.municipio}{duplicatePessoa.uf ? ` - ${duplicatePessoa.uf}` : ""}</p>}
              {visitHistory.length > 0 && (
                <p className="text-xs text-primary font-semibold mt-1">📋 {visitHistory.length} visita{visitHistory.length !== 1 ? "s" : ""} registrada{visitHistory.length !== 1 ? "s" : ""}</p>
              )}
            </div>
            <div className="space-y-2">
              <button
                onClick={handleDuplicateRegisterVisit}
                className="w-full h-11 rounded-lg font-bold text-white gradient-primary active:scale-[0.98] transition-transform text-sm"
              >
                Registrar nova visita
              </button>
              <button
                onClick={() => { setShowDuplicateDialog(false); navigate(`/pessoa/${duplicatePessoa.id}`); }}
                className="w-full h-10 rounded-lg text-sm text-primary font-semibold border border-primary/30 hover:bg-primary/5 active:scale-95 transition"
              >
                Ver cadastro completo
              </button>
              <button
                onClick={() => { setShowDuplicateDialog(false); setPessoa(prev => ({ ...prev, cpf: "" })); }}
                className="w-full h-9 rounded-lg text-xs text-muted-foreground active:scale-95 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {pessoaStatus === "found" && (
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
      )}

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
                <span className="text-[10px] font-bold text-muted-foreground">{v.assunto || ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simplified form for existing person — just date + assunto + save */}
      {pessoaStatus === "found" && (
        <div className="space-y-4 animate-fade-in">
          <div className="card-section">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-primary">📝</span>
              <p className="text-sm font-bold text-primary uppercase tracking-wide">Registrar Visita</p>
            </div>
            <div className="space-y-4">
              <InputField label="Data e hora" value={visita.data_hora} onChange={(v) => setVisita({ ...visita, data_hora: v })} type="datetime-local" />
              <InputField label="Motivo / Assunto *" value={visita.assunto} onChange={(v) => setVisita({ ...visita, assunto: v })} placeholder="Descreva o motivo da visita" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full h-12 rounded-lg font-bold text-white gradient-primary shadow-lg shadow-pink-500/25 active:scale-[0.98] transition-transform disabled:opacity-70 flex items-center justify-center gap-2 text-base">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Salvando…" : "Salvar visita"}
          </button>
          <div className="h-4" />
        </div>
      )}

      {/* Full form for new person */}
      {showForm && pessoaStatus !== "found" && (
        <div className="space-y-4 animate-fade-in">

          <div className="card-section">
            <div className="flex items-center gap-2 mb-4">
              <User size={16} className="text-primary" />
              <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados Pessoais</p>
            </div>
            <div className="space-y-4">
              {/* Nome com autosugestão */}
              <div className="space-y-1.5 relative" ref={nomeContainerRef}>
                <label className="text-xs font-bold text-foreground">Nome completo *</label>
                <div className="relative">
                  <input
                    value={pessoa.nome}
                    onChange={(e) => handleNomeInput(e.target.value)}
                    onFocus={() => {
                      if (pessoa.nome.trim().length >= 2 && nomeSugestoes.length > 0) {
                        setNomeDropdownAberto(true);
                      }
                    }}
                    placeholder="Nome completo"
                    className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50"
                  />
                  {nomeBuscando && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                  )}
                </div>
                {nomeDropdownAberto && pessoa.nome.trim().length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-[280px] overflow-y-auto">
                    {nomeSugestoes.length > 0 ? (
                      nomeSugestoes.map((p) => (
                        <button key={p.id} type="button" onClick={() => { setNomeDropdownAberto(false); navigate(`/nova-visita-existente/${p.id}`); }}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center justify-between transition-colors cursor-pointer border-b border-border/30 last:border-0">
                          <div>
                            <span className="text-sm font-semibold">{p.nome}</span>
                            {p.whatsapp && <p className="text-xs text-muted-foreground">WhatsApp: {p.whatsapp}</p>}
                            {p.municipio && <p className="text-xs text-muted-foreground">{p.municipio}{p.uf ? ` - ${p.uf}` : ""}</p>}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-600 flex-shrink-0">
                            Registrar visita
                          </span>
                        </button>
                      ))
                    ) : !nomeBuscando ? (
                      <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                        Nenhum cadastro encontrado para "<span className="font-semibold">{pessoa.nome.trim()}</span>"
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              {/* CPF com autosugestão */}
              <div className="space-y-1.5 relative" ref={cpfContainerRef}>
                <label className="text-xs font-bold text-foreground">CPF *</label>
                <input
                  value={maskCPF(pessoa.cpf)}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50"
                />
                {cpfDropdownAberto && cpfSugestoes.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-[220px] overflow-y-auto">
                    {cpfSugestoes.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setCpfDropdownAberto(false); navigate(`/nova-visita-existente/${p.id}`); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-muted flex items-center justify-between transition-colors cursor-pointer border-b border-border/30 last:border-0">
                        <div>
                          <span className="text-sm font-semibold">{p.nome}</span>
                          <p className="text-xs text-muted-foreground">CPF: {maskCPF(p.cpf)}</p>
                          {p.municipio && <p className="text-xs text-muted-foreground">{p.municipio}</p>}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-600 flex-shrink-0">
                          Registrar visita
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <InputField label="WhatsApp *" value={pessoa.whatsapp} onChange={(v) => setPessoa({ ...pessoa, whatsapp: maskPhone(v) })} placeholder="(00) 00000-0000" />
              <InputField label="Rede social (Instagram ou Facebook)" value={pessoa.instagram} onChange={(v) => setPessoa({ ...pessoa, instagram: v })} placeholder="@usuario ou link" />
              <InputField label="Data de nascimento *" value={pessoa.data_nascimento} onChange={(v) => setPessoa({ ...pessoa, data_nascimento: v })} type="date" />
            </div>
          </div>

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

          {/* DADOS DA VISITA */}
          <div className="card-section">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-primary">📝</span>
              <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados da Visita</p>
            </div>
            <div className="space-y-4">
              <InputField label="Data e hora" value={visita.data_hora} onChange={(v) => setVisita({ ...visita, data_hora: v })} type="datetime-local" />
              <InputField label="Assunto *" value={visita.assunto} onChange={(v) => setVisita({ ...visita, assunto: v })} placeholder="Descreva o motivo da visita" />

              {/* Quem indicou — busca em tempo real */}
              <div className="space-y-1.5 relative" ref={indicadorContainerRef}>
                <label className="text-xs font-bold text-foreground">Vinculado a (Suplente / Liderança)</label>
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
