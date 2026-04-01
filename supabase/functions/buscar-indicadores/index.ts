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
        JSON.stringify({ error: "Secrets não configurados", hasUrl: !!EXTERNAL_URL, hasKey: !!EXTERNAL_KEY }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const termo = (body.termo || body.busca || "").trim();

    if (!termo || termo.length < 2) {
      return new Response(
        JSON.stringify({ suplentes: [], liderancas: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use REST API directly with service key
    const restHeaders = {
      apikey: EXTERNAL_KEY,
      Authorization: `Bearer ${EXTERNAL_KEY}`,
      "Content-Type": "application/json",
    };

    const encoded = encodeURIComponent(`%${termo}%`);

    // Query suplentes
    const supUrl = `${EXTERNAL_URL}/rest/v1/suplentes?select=id,nome&nome=ilike.${encoded}&limit=15`;
    const supResp = await fetch(supUrl, { headers: restHeaders });
    const supText = await supResp.text();
    console.log(`Suplentes [${supResp.status}]:`, supText.substring(0, 500));

    // Query hierarquia_usuarios
    const hierUrl = `${EXTERNAL_URL}/rest/v1/hierarquia_usuarios?select=id,nome,tipo&ativo=eq.true&tipo=in.(lideranca,suplente,coordenador)&nome=ilike.${encoded}&limit=15`;
    const hierResp = await fetch(hierUrl, { headers: restHeaders });
    const hierText = await hierResp.text();
    console.log(`Hierarquia [${hierResp.status}]:`, hierText.substring(0, 500));

    let supData = [];
    let hierData = [];
    try { supData = JSON.parse(supText); } catch {}
    try { hierData = JSON.parse(hierText); } catch {}

    const suplentes = Array.isArray(supData) ? supData.map((s: any) => ({ id: s.id, nome: s.nome })) : [];
    const liderancas = Array.isArray(hierData)
      ? hierData.filter((h: any) => h.tipo === "lideranca" || h.tipo === "coordenador").map((h: any) => ({ id: h.id, nome: h.nome }))
      : [];

    return new Response(
      JSON.stringify({ suplentes, liderancas, debug: { supStatus: supResp.status, hierStatus: hierResp.status, supCount: supData.length, hierCount: hierData.length } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
