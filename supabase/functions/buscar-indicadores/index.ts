const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!EXTERNAL_URL || !EXTERNAL_KEY) {
      return new Response(
        JSON.stringify({ error: "Secrets não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const termo = (body.termo || body.busca || "").trim();
    const debug = body.debug === true;

    // Debug mode: return raw table contents
    if (debug) {
      const restHeaders = {
        apikey: EXTERNAL_KEY,
        Authorization: `Bearer ${EXTERNAL_KEY}`,
      };
      const supResp = await fetch(`${EXTERNAL_URL}/rest/v1/suplentes?select=id,nome&limit=5`, { headers: restHeaders });
      const supData = await supResp.json();
      
      // Also try hierarquia_usuarios
      const hierResp = await fetch(`${EXTERNAL_URL}/rest/v1/hierarquia_usuarios?select=id,nome,tipo&limit=5`, { headers: restHeaders });
      const hierText = await hierResp.text();
      
      return new Response(
        JSON.stringify({ 
          external_url: EXTERNAL_URL,
          key_prefix: EXTERNAL_KEY.substring(0, 50) + "...",
          suplentes_status: supResp.status,
          suplentes_data: supData,
          hierarquia_status: hierResp.status,
          hierarquia_raw: hierText.substring(0, 500),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!termo || termo.length < 2) {
      return new Response(
        JSON.stringify({ suplentes: [], liderancas: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const restHeaders = {
      apikey: EXTERNAL_KEY,
      Authorization: `Bearer ${EXTERNAL_KEY}`,
    };

    const encoded = encodeURIComponent(`%${termo}%`);

    const [supResp, hierResp] = await Promise.all([
      fetch(`${EXTERNAL_URL}/rest/v1/suplentes?select=id,nome&nome=ilike.${encoded}&limit=15`, { headers: restHeaders }),
      fetch(`${EXTERNAL_URL}/rest/v1/hierarquia_usuarios?select=id,nome,tipo&ativo=eq.true&tipo=in.(lideranca,suplente,coordenador)&nome=ilike.${encoded}&limit=15`, { headers: restHeaders }),
    ]);

    const supData = supResp.ok ? await supResp.json() : [];
    const hierData = hierResp.ok ? await hierResp.json() : [];

    const suplentes = Array.isArray(supData) ? supData.map((s: any) => ({ id: s.id, nome: s.nome })) : [];
    const liderancas = Array.isArray(hierData)
      ? hierData.filter((h: any) => h.tipo === "lideranca" || h.tipo === "coordenador").map((h: any) => ({ id: h.id, nome: h.nome }))
      : [];

    return new Response(
      JSON.stringify({ suplentes, liderancas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
