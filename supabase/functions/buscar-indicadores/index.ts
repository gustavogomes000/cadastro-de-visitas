import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!EXTERNAL_URL || !EXTERNAL_KEY) {
      return new Response(
        JSON.stringify({ error: "Secrets EXTERNAL_SUPABASE_URL ou EXTERNAL_SUPABASE_SERVICE_KEY não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const termo = body.termo || body.busca || "";

    if (!termo || termo.trim().length < 2) {
      return new Response(
        JSON.stringify({ suplentes: [], liderancas: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Proxy para a Edge Function do banco externo
    const response = await fetch(`${EXTERNAL_URL}/functions/v1/buscar-indicadores`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EXTERNAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ busca: termo.trim() }),
    });

    const data = await response.json();

    // Normalizar resposta: a função externa pode retornar { resultados: [...] } ou { suplentes, liderancas }
    let suplentes: any[] = [];
    let liderancas: any[] = [];

    if (data.resultados && Array.isArray(data.resultados)) {
      // Formato com lista unificada com campo "tipo"
      for (const item of data.resultados) {
        if (item.tipo === "suplente") {
          suplentes.push(item);
        } else if (item.tipo === "lideranca") {
          liderancas.push(item);
        }
      }
    } else {
      suplentes = data.suplentes || [];
      liderancas = data.liderancas || [];
    }

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
