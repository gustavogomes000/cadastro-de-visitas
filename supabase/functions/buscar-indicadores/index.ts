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
    const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL");
    const EXTERNAL_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY");

    if (!EXTERNAL_URL || !EXTERNAL_KEY) {
      return new Response(
        JSON.stringify({ error: "Secrets não configurados" }),
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

    console.log("External URL:", EXTERNAL_URL);
    console.log("Key length:", EXTERNAL_KEY?.length);

    const supabase = createClient(EXTERNAL_URL, EXTERNAL_KEY);

    // First test: query all suplentes without filter to check connection
    const testResult = await supabase.from("suplentes").select("id, nome").limit(5);
    console.log("Test query (no filter):", JSON.stringify(testResult));

    // Query suplentes (has nome column directly)
    const supResult = await supabase
      .from("suplentes")
      .select("id, nome")
      .ilike("nome", `%${termo}%`)
      .limit(15);

    console.log("Suplentes result:", JSON.stringify(supResult));

    // Query hierarquia_usuarios (has nome column directly)
    const hierResult = await supabase
      .from("hierarquia_usuarios")
      .select("id, nome, tipo")
      .eq("ativo", true)
      .in("tipo", ["lideranca", "suplente", "coordenador"])
      .ilike("nome", `%${termo}%`)
      .limit(15);

    console.log("Hierarquia result:", JSON.stringify(hierResult));

    const suplentes = (supResult.data || []).map((s: any) => ({ id: s.id, nome: s.nome }));
    
    // From hierarquia, separate liderancas (exclude suplente type to avoid duplicates)
    const liderancas = (hierResult.data || [])
      .filter((h: any) => h.tipo === "lideranca" || h.tipo === "coordenador")
      .map((h: any) => ({ id: h.id, nome: h.nome }));

    console.log(`Busca "${termo}": ${suplentes.length} suplentes, ${liderancas.length} liderancas`);

    return new Response(
      JSON.stringify({ suplentes, liderancas }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro buscar-indicadores:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
