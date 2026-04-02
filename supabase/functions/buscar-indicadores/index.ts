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

    // Debug mode - return empty results without leaking keys
    if (!termo || termo === "debug") {
      return new Response(
        JSON.stringify({ suplentes: [], liderancas: [], message: "Termo vazio" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (termo.length < 2) {
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

    const hierResp = await fetch(
      `${EXTERNAL_URL}/rest/v1/hierarquia_usuarios?select=id,nome,tipo&nome=ilike.${encoded}&limit=30`,
      { headers: restHeaders }
    );

    const hierData = hierResp.ok ? await hierResp.json() : [];

    const suplentes = Array.isArray(hierData)
      ? hierData.filter((h: any) => h.tipo === "suplente").map((h: any) => ({ id: h.id, nome: h.nome }))
      : [];

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
