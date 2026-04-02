import { supabase } from "@/integrations/supabase/client";

export interface UsuarioExterno {
  id: string;
  nome: string;
  tipo: string;
  tag: string;
  subtitulo?: string;
  municipio?: string;
  fonte?: string;
}

let usuariosCacheGlobal: UsuarioExterno[] | null = null;
let usuariosCachePromise: Promise<UsuarioExterno[]> | null = null;
let lastFetchAt = 0;

const CACHE_TTL_MS = 10_000;

function normalizarUsuarios(suplentes: any[], liderancas: any[]): UsuarioExterno[] {
  const usuarios: UsuarioExterno[] = [];

  (suplentes || []).forEach((s: any) => {
    usuarios.push({
      id: s.id,
      nome: s.nome,
      tipo: "suplente",
      tag: "Suplente",
      subtitulo: [s.partido, s.regiao_atuacao, s.numero_urna].filter(Boolean).join(" · "),
      municipio: s.regiao_atuacao || "",
      fonte: "externo",
    });
  });

  (liderancas || []).forEach((l: any) => {
    usuarios.push({
      id: l.id,
      nome: l.nome,
      tipo: "lideranca_cadastrada",
      tag: "Liderança",
      subtitulo: [l.ligacao_politica, l.regiao].filter(Boolean).join(" · "),
      municipio: l.regiao || "",
      fonte: "externo",
    });
  });

  return usuarios.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

export function invalidateUsuariosExternosCache() {
  usuariosCacheGlobal = null;
  lastFetchAt = 0;
}

export async function fetchAllUsuariosExternos(options?: { force?: boolean }): Promise<UsuarioExterno[]> {
  const force = options?.force === true;
  const cacheValido = usuariosCacheGlobal && Date.now() - lastFetchAt < CACHE_TTL_MS;

  if (!force && cacheValido) {
    return usuariosCacheGlobal;
  }

  if (!force && usuariosCachePromise) {
    return usuariosCachePromise;
  }

  usuariosCachePromise = (async () => {
    const [suplRes, lidRes] = await Promise.all([
      supabase
        .from("suplentes")
        .select("id, nome, partido, numero_urna, cargo_disputado, telefone, municipio_id, situacao, regiao_atuacao"),
      supabase
        .from("liderancas")
        .select("id, nome, whatsapp, cpf, regiao, municipio_id, ligacao_politica"),
    ]);

    if (suplRes.error) throw suplRes.error;
    if (lidRes.error) throw lidRes.error;

    const usuarios = normalizarUsuarios(suplRes.data || [], lidRes.data || []);
    usuariosCacheGlobal = usuarios;
    lastFetchAt = Date.now();
    return usuarios;
  })();

  try {
    return await usuariosCachePromise;
  } finally {
    usuariosCachePromise = null;
  }
}

export function subscribeToUsuariosExternos(onChange: () => void, channelKey: string) {
  const handleChange = () => {
    invalidateUsuariosExternosCache();
    onChange();
  };

  const channel = supabase
    .channel(`usuarios-externos-${channelKey}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "suplentes" }, handleChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "liderancas" }, handleChange)
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
