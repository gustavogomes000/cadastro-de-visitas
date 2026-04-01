import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const EXTERNO_URL = Deno.env.get("SUPABASE_URL")!;
    const EXTERNO_KEY = Deno.env.get("EXTERNO_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { tipo, nome, cpf, whatsapp } = await req.json();

    if (!tipo || tipo === "eleitor" || !cpf) {
      return new Response(JSON.stringify({ ok: true, acao: "ignorado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tabela = tipo === "lideranca" ? "liderancas" : "fiscais";
    const externo = createClient(EXTERNO_URL, EXTERNO_KEY);

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
