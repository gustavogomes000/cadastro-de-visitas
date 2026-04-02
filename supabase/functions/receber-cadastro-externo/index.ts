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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { tipo, nome, cpf, whatsapp, telefone, email, regiao_atuacao,
      zona_eleitoral, secao_eleitoral, titulo_eleitor,
      indicador_id, indicador_tipo, indicador_nome } = body;

    if (!nome) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check duplicates by CPF if provided
    if (cpf && cpf.length >= 11) {
      const cleanCpf = cpf.replace(/\D/g, "");

      if (tipo === "lideranca") {
        const { data: existing } = await supabase.from("liderancas").select("id").eq("cpf", cleanCpf).maybeSingle();
        if (existing) {
          return new Response(JSON.stringify({ aviso: "Pessoa já cadastrada como liderança", id: existing.id }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (tipo === "fiscal") {
        const { data: existing } = await supabase.from("fiscais").select("id").eq("cpf", cleanCpf).maybeSingle();
        if (existing) {
          return new Response(JSON.stringify({ aviso: "Pessoa já cadastrada como fiscal", id: existing.id }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    let insertedId: string | null = null;
    const cleanCpf = cpf ? cpf.replace(/\D/g, "") : null;

    if (tipo === "lideranca") {
      const { data, error } = await supabase.from("liderancas").insert({
        nome,
        cpf: cleanCpf,
        whatsapp: whatsapp || null,
        regiao: regiao_atuacao || null,
        ligacao_politica: indicador_nome ? `Indicado por ${indicador_nome}` : null,
      }).select("id").single();
      if (error) throw error;
      insertedId = data.id;

    } else if (tipo === "fiscal") {
      const { data, error } = await supabase.from("fiscais").insert({
        nome,
        cpf: cleanCpf,
        whatsapp: whatsapp || null,
      }).select("id").single();
      if (error) throw error;
      insertedId = data.id;

    } else {
      // eleitor → pessoas
      const cpfToSave = cleanCpf || `TEMP${Date.now()}`;
      const { data, error } = await supabase.from("pessoas").insert({
        nome,
        cpf: cpfToSave,
        whatsapp: whatsapp || null,
        telefone: telefone || null,
        email: email || null,
        titulo_eleitor: titulo_eleitor || null,
        zona_eleitoral: zona_eleitoral || null,
        secao_eleitoral: secao_eleitoral || null,
        municipio: regiao_atuacao || null,
        origem: `Indicado por ${indicador_nome || "desconhecido"} (${indicador_tipo || "?"})`,
      }).select("id").single();
      if (error) throw error;
      insertedId = data.id;
    }

    return new Response(JSON.stringify({
      sucesso: true, tipo: tipo || "eleitor", id: insertedId,
    }), {
      status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro receber-cadastro-externo:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
