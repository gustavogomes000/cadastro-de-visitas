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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    const { tipo, nome, cpf, whatsapp, telefone, email, regiao_atuacao,
      zona_eleitoral, secao_eleitoral, titulo_eleitor,
      indicador_id, indicador_tipo, indicador_nome } = body;

    if (!nome || typeof nome !== "string" || nome.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Nome é obrigatório (mín. 2 caracteres)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanNome = nome.trim().slice(0, 255);
    const cleanCpf = cpf ? String(cpf).replace(/\D/g, "").slice(0, 11) : null;

    // Check duplicates by CPF
    if (cleanCpf && cleanCpf.length >= 11) {
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

    if (tipo === "lideranca") {
      const { data, error } = await supabase.from("liderancas").insert({
        nome: cleanNome,
        cpf: cleanCpf,
        whatsapp: whatsapp ? String(whatsapp).slice(0, 20) : null,
        regiao: regiao_atuacao ? String(regiao_atuacao).slice(0, 255) : null,
        ligacao_politica: indicador_nome ? `Indicado por ${String(indicador_nome).slice(0, 200)}` : null,
      }).select("id").single();
      if (error) throw error;
      insertedId = data.id;

    } else if (tipo === "fiscal") {
      const { data, error } = await supabase.from("fiscais").insert({
        nome: cleanNome,
        cpf: cleanCpf,
        whatsapp: whatsapp ? String(whatsapp).slice(0, 20) : null,
      }).select("id").single();
      if (error) throw error;
      insertedId = data.id;

    } else {
      const cpfToSave = cleanCpf || `TEMP${Date.now()}`;
      // Check if pessoa already exists by CPF
      if (cleanCpf && cleanCpf.length >= 11) {
        const { data: existing } = await supabase.from("pessoas").select("id").eq("cpf", cleanCpf).maybeSingle();
        if (existing) {
          // Update existing pessoa instead of inserting
          await supabase.from("pessoas").update({
            nome: cleanNome,
            whatsapp: whatsapp ? String(whatsapp).slice(0, 20) : undefined,
            telefone: telefone ? String(telefone).slice(0, 20) : undefined,
            email: email ? String(email).slice(0, 255) : undefined,
            titulo_eleitor: titulo_eleitor ? String(titulo_eleitor).slice(0, 20) : undefined,
            zona_eleitoral: zona_eleitoral ? String(zona_eleitoral).slice(0, 10) : undefined,
            secao_eleitoral: secao_eleitoral ? String(secao_eleitoral).slice(0, 10) : undefined,
            municipio: regiao_atuacao ? String(regiao_atuacao).slice(0, 255) : undefined,
            atualizado_em: new Date().toISOString(),
          }).eq("id", existing.id);
          insertedId = existing.id;
          
          return new Response(JSON.stringify({
            aviso: "Pessoa já cadastrada, dados atualizados", id: existing.id,
          }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      const { data, error } = await supabase.from("pessoas").insert({
        nome: cleanNome,
        cpf: cpfToSave,
        whatsapp: whatsapp ? String(whatsapp).slice(0, 20) : null,
        telefone: telefone ? String(telefone).slice(0, 20) : null,
        email: email ? String(email).slice(0, 255) : null,
        titulo_eleitor: titulo_eleitor ? String(titulo_eleitor).slice(0, 20) : null,
        zona_eleitoral: zona_eleitoral ? String(zona_eleitoral).slice(0, 10) : null,
        secao_eleitoral: secao_eleitoral ? String(secao_eleitoral).slice(0, 10) : null,
        municipio: regiao_atuacao ? String(regiao_atuacao).slice(0, 255) : null,
        origem: `Indicado por ${indicador_nome ? String(indicador_nome).slice(0, 200) : "desconhecido"} (${indicador_tipo || "?"})`,
      }).select("id").single();
      if (error) throw error;
      insertedId = data.id;
    }

    // Fire-and-forget: encaminhar para o app principal de campanha
    const PRINCIPAL_TOKEN = Deno.env.get("CADASTRO_EXTERNO_TOKEN_PRINCIPAL");
    if (PRINCIPAL_TOKEN) {
      const forwardPayload = {
        tipo: tipo || "eleitor",
        nome: cleanNome,
        cpf: cleanCpf,
        whatsapp: whatsapp || null,
        telefone: telefone || null,
        indicador_nome: indicador_nome || null,
        indicador_id: indicador_id || null,
        indicador_tipo: indicador_tipo || "recepcao",
        origem: "visita_comite",
        observacoes: body.observacoes || null,
        email: email || null,
        zona_eleitoral: zona_eleitoral || null,
        secao_eleitoral: secao_eleitoral || null,
        titulo_eleitor: titulo_eleitor || null,
        regiao_atuacao: regiao_atuacao || null,
      };
      fetch("https://yvdfdmyusdhgtzfguxbj.supabase.co/functions/v1/receber-cadastro-externo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-token": PRINCIPAL_TOKEN,
        },
        body: JSON.stringify(forwardPayload),
      }).then(r => r.text()).then(t => {
        console.log("[SYNC PRINCIPAL] Resposta:", t);
      }).catch(err => {
        console.error("[SYNC PRINCIPAL] Erro:", err);
      });
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
