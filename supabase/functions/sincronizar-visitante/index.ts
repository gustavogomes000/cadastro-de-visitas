import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNO_URL = "https://yvdfdmyusdhgtzfguxbj.supabase.co";
const EXTERNO_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6aHhya3VybGpyb2d4dHp4bW1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQ5ODUzOCwiZXhwIjoyMDg5MDc0NTM4fQ.prn4QrBWUSEF-BdMh6jEMzlUJGS-TfXZMpuhE1ugu2E";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tipo, nome, cpf, whatsapp } = await req.json();

    // Eleitor não vai para o externo
    if (!tipo || tipo === "eleitor" || !cpf) {
      return new Response(JSON.stringify({ ok: true, acao: "ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tabela = tipo === "lideranca" ? "liderancas" : "fiscais";
    const externo = createClient(EXTERNO_URL, EXTERNO_KEY);

    // Verificar duplicata por CPF
    const cpfLimpo = cpf.replace(/\D/g, "");
    const { data: existente } = await externo.from(tabela).select("id").eq("cpf", cpfLimpo).maybeSingle();

    if (existente) {
      return new Response(JSON.stringify({ ok: true, acao: "ja_existe" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await externo.from(tabela).insert({ nome, cpf: cpfLimpo, whatsapp: whatsapp || null });

    if (error) {
      return new Response(JSON.stringify({ ok: false, erro: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, acao: "criado" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, erro: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
