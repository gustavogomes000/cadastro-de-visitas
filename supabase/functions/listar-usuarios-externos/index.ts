const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-token",
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
        JSON.stringify({ error: "Secrets EXTERNAL_SUPABASE_URL ou EXTERNAL_SUPABASE_SERVICE_KEY não configurados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Proxy GET para o endpoint externo
    const response = await fetch(`${EXTERNAL_URL}/functions/v1/listar-usuarios-externos`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": EXTERNAL_KEY,
        "Authorization": `Bearer ${EXTERNAL_KEY}`,
        "apikey": EXTERNAL_KEY,
      },
    });

    const data = await response.text();

    return new Response(data, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
