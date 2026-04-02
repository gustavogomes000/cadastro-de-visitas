import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { maskCPF, formatDateTime } from "@/lib/masks";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DetalheVisita() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [visita, setVisita] = useState<any>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVisita();
  }, [id]);

  async function fetchVisita() {
    try {
      const { data, error } = await supabase
        .from("visitas")
        .select("*, pessoas(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setVisita(data);
        if (data.pessoa_id) {
          const { data: hist } = await supabase
            .from("visitas")
            .select("id, data_hora, assunto, status")
            .eq("pessoa_id", data.pessoa_id)
            .neq("id", id!)
            .order("data_hora", { ascending: false });
          setHistorico(hist || []);
        }
      }
    } catch (err: any) {
      toast({ title: "Erro ao carregar visita", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async () => {
    const { error } = await supabase.from("visitas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Visita excluída" });
    navigate(-1);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="card-section animate-pulse h-32" />)}
        </div>
      </AppLayout>
    );
  }

  if (!visita) {
    return (
      <AppLayout>
        <p className="text-center py-16 text-muted-foreground">Visita não encontrada.</p>
      </AppLayout>
    );
  }

  const p = visita.pessoas;

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    value ? (
      <div className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-right">{value}</span>
      </div>
    ) : null
  );

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-muted active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-bold">{p?.nome || "Visitante"}</h2>
        </div>
        <button onClick={() => navigate(`/editar-visita/${id}`)} className="p-2 rounded-full hover:bg-muted active:scale-95">
          <Pencil size={18} />
        </button>
      </div>

      <div className="space-y-4">
        {/* Dados Pessoais */}
        <div className="card-section animate-fade-in">
          <p className="section-title">Dados Pessoais</p>
          <InfoRow label="Nome" value={p?.nome} />
          <InfoRow label="CPF" value={p?.cpf && !p.cpf.startsWith("TEMP") ? maskCPF(p.cpf) : "–"} />
          <InfoRow label="Telefone" value={p?.telefone} />
          
          <InfoRow label="Instagram" value={p?.instagram} />
          <InfoRow label="WhatsApp" value={p?.whatsapp} />
        </div>

        {/* Dados Eleitorais */}
        {(p?.titulo_eleitor || p?.zona_eleitoral || p?.secao_eleitoral) && (
          <div className="card-section animate-fade-in" style={{ animationDelay: "60ms" }}>
            <p className="section-title">Dados Eleitorais</p>
            <InfoRow label="Título" value={p?.titulo_eleitor} />
            <InfoRow label="Zona" value={p?.zona_eleitoral} />
            <InfoRow label="Seção" value={p?.secao_eleitoral} />
            <InfoRow label="Município/UF" value={[p?.municipio, p?.uf].filter(Boolean).join("/")} />
          </div>
        )}

        {/* Dados da Visita */}
        <div className="card-section animate-fade-in" style={{ animationDelay: "120ms" }}>
          <p className="section-title">Dados da Visita</p>
          <InfoRow label="Data/hora" value={formatDateTime(visita.data_hora)} />
          <InfoRow label="Assunto" value={visita.assunto} />
          <InfoRow label="Descrição" value={visita.descricao_assunto} />
          <InfoRow label="Quem indicou" value={visita.quem_indicou} />
          <InfoRow label="Como chegou" value={visita.origem_visita} />
          <InfoRow label="Cadastrado por" value={visita.cadastrado_por} />
        </div>

        {/* Histórico */}
        {historico.length > 0 && (
          <div className="card-section animate-fade-in" style={{ animationDelay: "240ms" }}>
            <p className="section-title">Histórico de Visitas</p>
            {historico.map((h) => (
              <button
                key={h.id}
                onClick={() => navigate(`/visita/${h.id}`)}
                className="w-full text-left py-2 border-b border-border last:border-0"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm">{h.assunto || "–"}</span>
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full", getStatusColor(h.status))}>
                    {h.status}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatDateTime(h.data_hora)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Delete */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full h-10 rounded-xl text-destructive border border-destructive/30 text-sm font-medium active:scale-95 transition-transform flex items-center justify-center gap-2">
              <Trash2 size={16} />
              Excluir visita
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir visita?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
