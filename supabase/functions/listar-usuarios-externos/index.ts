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
    // Also try the alternate secret name
    const EXTERNO_KEY = Deno.env.get("EXTERNO_SUPABASE_SERVICE_ROLE_KEY");
    const TOKEN = EXTERNAL_KEY || EXTERNO_KEY;

    if (!EXTERNAL_URL || !TOKEN) {
      return new Response(
        JSON.stringify({ error: "Secrets não configurados", hasUrl: !!EXTERNAL_URL, hasKey: !!TOKEN }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Calling external endpoint:", `${EXTERNAL_URL}/functions/v1/listar-usuarios-externos`);

    // Try with x-api-token header
    const response = await fetch(`${EXTERNAL_URL}/functions/v1/listar-usuarios-externos`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-token": TOKEN,
        "Authorization": `Bearer ${TOKEN}`,
        "apikey": TOKEN,
      },
    });

    const data = await response.text();
    console.log("External response status:", response.status, "body preview:", data.substring(0, 200));

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
