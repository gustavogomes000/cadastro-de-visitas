import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNO_URL = Deno.env.get("SUPABASE_URL") ?? "https://hzhxrkurljrogxtzxmmb.supabase.co";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const EXTERNO_KEY = Deno.env.get("EXTERNO_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Chave do Supabase externo não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { termo } = await req.json();
    if (!termo || termo.trim().length < 2) {
      return new Response(JSON.stringify({ suplentes: [], liderancas: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externo = createClient(EXTERNO_URL, EXTERNO_KEY);

    const [{ data: suplentes }, { data: liderancas }] = await Promise.all([
      externo.from("suplentes").select("id, nome, numero_urna, partido").ilike("nome", `%${termo}%`).limit(6),
      externo.from("liderancas").select("id, nome, regiao, whatsapp").ilike("nome", `%${termo}%`).limit(6),
    ]);

    return new Response(
      JSON.stringify({ suplentes: suplentes ?? [], liderancas: liderancas ?? [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
