import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for queries (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const [suplRes, lidRes, fiscRes, adminRes, usuariosRes] = await Promise.all([
      supabase.from("suplentes").select("id, nome, partido, regiao_atuacao"),
      supabase.from("liderancas").select("id, nome, ligacao_politica, regiao"),
      supabase.from("fiscais").select("id, nome"),
      supabase.from("administrativo").select("id, nome"),
      supabase.from("usuarios").select("id, user_id, nome_usuario, email"),
    ]);

    const result: any[] = [];

    (suplRes.data || []).forEach((s: any) => result.push({
      id: s.id, nome: s.nome, tipo: "suplente", tag: "Suplente",
      subtitulo: [s.partido, s.regiao_atuacao].filter(Boolean).join(" · "),
      municipio: s.regiao_atuacao || "", fonte: "local",
    }));

    (lidRes.data || []).forEach((l: any) => result.push({
      id: l.id, nome: l.nome, tipo: "lideranca_cadastrada", tag: "Liderança",
      subtitulo: [l.ligacao_politica, l.regiao].filter(Boolean).join(" · "),
      municipio: l.regiao || "", fonte: "local",
    }));

    (fiscRes.data || []).forEach((f: any) => result.push({
      id: f.id, nome: f.nome, tipo: "fiscal_cadastrado", tag: "Fiscal",
      subtitulo: "", municipio: "", fonte: "local",
    }));

    (adminRes.data || []).forEach((a: any) => result.push({
      id: a.id, nome: a.nome, tipo: "coordenador", tag: "Coordenador",
      subtitulo: "", municipio: "", fonte: "local",
    }));

    if (usuariosRes.data && usuariosRes.data.length > 0) {
      const userIds = usuariosRes.data.map((u: any) => u.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

      usuariosRes.data.forEach((u: any) => {
        const role = roleMap[u.user_id] || "recepcao";
        const tipo = role === "admin" ? "super_admin" : role;
        const tag = role === "admin" ? "Super Admin" : role === "recepcao" ? "Recepção" : role;
        result.push({
          id: u.id, nome: u.nome_usuario, tipo, tag,
          subtitulo: u.email, municipio: "", fonte: "local",
        });
      });
    }

    // Deduplicate by nome
    const seen = new Set<string>();
    const unique = result.filter(r => {
      const key = (r.nome || "").toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    return new Response(JSON.stringify(unique), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
