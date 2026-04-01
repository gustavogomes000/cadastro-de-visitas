import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXTERNO_URL = "https://yvdfdmyusdhgtzfguxbj.supabase.co";
const EXTERNO_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aHhya3VybGpyb2d4dHp4bW1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5ODUzOCwiZXhwIjoyMDg5MDc0NTM4fQ.prn4QrBWUSEF-BdMh6jEMzlUJGS-TfXZMpuhE1ugu2E";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
