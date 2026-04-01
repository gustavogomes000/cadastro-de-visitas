import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import { maskCPF, unmaskCPF, maskPhone, maskTitulo } from "@/lib/masks";
import { UF_OPTIONS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-foreground">{label}</label>
    {children}
  </div>
);

const inputClass = "w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50";

export default function EditarPessoa() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [instagram, setInstagram] = useState("");
  const [outrasRedes, setOutrasRedes] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [tituloEleitor, setTituloEleitor] = useState("");
  const [zonaEleitoral, setZonaEleitoral] = useState("");
  const [secaoEleitoral, setSecaoEleitoral] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("GO");
  const [colegioEleitoral, setColegioEleitoral] = useState("");
  const [situacaoTitulo, setSituacaoTitulo] = useState("");
  const [observacoesGerais, setObservacoesGerais] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase.from("pessoas").select("*").eq("id", id).maybeSingle();
        if (error) throw error;
        if (data) {
          setNome(data.nome || "");
          setCpf(data.cpf || "");
          setTelefone(data.telefone || "");
          setWhatsapp(data.whatsapp || "");
          setEmail(data.email || "");
          setInstagram(data.instagram || "");
          setOutrasRedes(data.outras_redes || "");
          setDataNascimento(data.data_nascimento || "");
          setTituloEleitor(data.titulo_eleitor || "");
          setZonaEleitoral(data.zona_eleitoral || "");
          setSecaoEleitoral(data.secao_eleitoral || "");
          setMunicipio(data.municipio || "");
          setUf(data.uf || "");
          setSituacaoTitulo(data.situacao_titulo || "");
          setObservacoesGerais(data.observacoes_gerais || "");
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
    if (!nome) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("pessoas").update({
        nome,
        telefone: telefone || null,
        whatsapp: whatsapp || null,
        email: email || null,
        instagram: instagram || null,
        outras_redes: outrasRedes || null,
        data_nascimento: dataNascimento || null,
        titulo_eleitor: tituloEleitor || null,
        zona_eleitoral: zonaEleitoral || null,
        secao_eleitoral: secaoEleitoral || null,
        municipio: municipio || null,
        uf: uf || null,
        situacao_titulo: situacaoTitulo || null,
        observacoes_gerais: observacoesGerais || null,
        atualizado_em: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      toast({ title: "✅ Dados atualizados!" });
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
        <h2 className="text-xl font-bold">Editar Pessoa</h2>
      </div>

      <div className="space-y-4 animate-fade-in">
        {/* Dados Pessoais */}
        <div className="card-section space-y-4">
          <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados Pessoais</p>
          <Field label="Nome completo *">
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className={inputClass} />
          </Field>
          <Field label="CPF">
            <input type="text" value={maskCPF(cpf)} onChange={(e) => {
              const raw = unmaskCPF(e.target.value);
              if (raw.length <= 11) setCpf(raw);
            }} placeholder="000.000.000-00" className={inputClass} />
          </Field>
          <Field label="WhatsApp">
            <input type="text" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputClass} />
          </Field>
          <Field label="Telefone">
            <input type="text" value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputClass} />
          </Field>
          <Field label="E-mail">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className={inputClass} />
          </Field>
          <Field label="Rede social (Instagram ou Facebook)">
            <input type="text" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@usuario ou link" className={inputClass} />
          </Field>
          <Field label="Data de nascimento">
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Observações gerais">
            <textarea value={observacoesGerais} onChange={(e) => setObservacoesGerais(e.target.value)} placeholder="Observações..." rows={3}
              className="w-full rounded-lg bg-background border border-border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow placeholder:text-muted-foreground/50 resize-none" />
          </Field>
        </div>

        {/* Dados Eleitorais */}
        <div className="card-section space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-primary uppercase tracking-wide">Dados Eleitorais</p>
            <a href="https://www.tse.jus.br/servicos-eleitorais/autoatendimento-eleitoral#/atendimento-eleitor"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline active:scale-95 transition-transform">
              <ExternalLink size={13} />
              Consultar TSE
            </a>
          </div>
          <Field label="Título de eleitor">
            <input type="text" value={tituloEleitor} onChange={(e) => setTituloEleitor(maskTitulo(e.target.value))} placeholder="0000 0000 0000" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Zona eleitoral">
              <input type="text" value={zonaEleitoral} onChange={(e) => setZonaEleitoral(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 42" className={inputClass} />
            </Field>
            <Field label="Seção">
              <input type="text" value={secaoEleitoral} onChange={(e) => setSecaoEleitoral(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 123" className={inputClass} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Município">
              <input type="text" value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Cidade" className={inputClass} />
            </Field>
            <Field label="UF">
              <select value={uf} onChange={(e) => setUf(e.target.value)}
                className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none">
                <option value="">Selecione…</option>
                {UF_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Situação do título">
            <select value={situacaoTitulo} onChange={(e) => setSituacaoTitulo(e.target.value)}
              className="w-full h-12 rounded-lg bg-background border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow appearance-none">
              <option value="">Selecione…</option>
              {["Regular", "Cancelado", "Suspenso", "Não possui"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
