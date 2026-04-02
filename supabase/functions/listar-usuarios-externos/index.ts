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

    // Fetch from EXTERNAL bank
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") || Deno.env.get("EXTERNO_SUPABASE_SERVICE_ROLE_KEY");

    const result: any[] = [];

    if (EXTERNAL_URL && EXTERNAL_KEY) {
      const restHeaders = {
        apikey: EXTERNAL_KEY,
        Authorization: `Bearer ${EXTERNAL_KEY}`,
      };

      // Fetch suplentes and liderancas from external bank
      const [suplRes, lidRes] = await Promise.all([
        fetch(`${EXTERNAL_URL}/rest/v1/suplentes?select=id,nome,partido,regiao_atuacao,numero_urna`, { headers: restHeaders }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`${EXTERNAL_URL}/rest/v1/liderancas?select=id,nome,ligacao_politica,regiao`, { headers: restHeaders }).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);

      // Also try hierarquia_usuarios if available
      const hierRes = await fetch(`${EXTERNAL_URL}/rest/v1/hierarquia_usuarios?select=id,nome,tipo&limit=500`, { headers: restHeaders }).then(r => r.ok ? r.json() : []).catch(() => []);

      if (Array.isArray(suplRes)) {
        suplRes.forEach((s: any) => result.push({
          id: s.id, nome: s.nome, tipo: "suplente", tag: "Suplente",
          subtitulo: [s.partido, s.regiao_atuacao, s.numero_urna].filter(Boolean).join(" · "),
          municipio: s.regiao_atuacao || "", fonte: "externo",
        }));
      }

      if (Array.isArray(lidRes)) {
        lidRes.forEach((l: any) => result.push({
          id: l.id, nome: l.nome, tipo: "lideranca_cadastrada", tag: "Liderança",
          subtitulo: [l.ligacao_politica, l.regiao].filter(Boolean).join(" · "),
          municipio: l.regiao || "", fonte: "externo",
        }));
      }

      // Add hierarquia data if not already present
      if (Array.isArray(hierRes)) {
        const existingNames = new Set(result.map(r => (r.nome || "").toLowerCase().trim()));
        hierRes.forEach((h: any) => {
          const nameLower = (h.nome || "").toLowerCase().trim();
          if (!existingNames.has(nameLower)) {
            const tipo = h.tipo === "suplente" ? "suplente" : "lideranca_cadastrada";
            const tag = h.tipo === "suplente" ? "Suplente" : "Liderança";
            result.push({
              id: h.id, nome: h.nome, tipo, tag,
              subtitulo: "", municipio: "", fonte: "externo",
            });
            existingNames.add(nameLower);
          }
        });
      }
    }

    // Fallback: also fetch from LOCAL tables if external didn't return results
    if (result.length === 0) {
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const [suplRes, lidRes] = await Promise.all([
        supabase.from("suplentes").select("id, nome, partido, regiao_atuacao"),
        supabase.from("liderancas").select("id, nome, ligacao_politica, regiao"),
      ]);

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
