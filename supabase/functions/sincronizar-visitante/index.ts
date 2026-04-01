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
        JSON.stringify({ ok: false, erro: "Secrets EXTERNAL_SUPABASE_URL ou EXTERNAL_SUPABASE_SERVICE_KEY não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { tipo, nome, cpf, whatsapp, indicador_tipo, indicador_id } = body;

    // Proxy para a Edge Function do banco externo
    const response = await fetch(`${EXTERNAL_URL}/functions/v1/sincronizar-visitante`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${EXTERNAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tipo, nome, cpf, whatsapp, indicador_tipo, indicador_id }),
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      {
        status: response.ok ? 200 : response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ ok: false, erro: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
