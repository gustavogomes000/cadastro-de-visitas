import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Auth via Bearer token (service role key or a custom token)
  const authHeader = req.headers.get('Authorization')
  const apiKey = req.headers.get('x-api-key')
  
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!

  // Accept either Bearer token or x-api-key header
  const providedKey = apiKey || authHeader?.replace('Bearer ', '')
  
  if (!providedKey || providedKey !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Provide x-api-key or Bearer token with the service role key.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const url = new URL(req.url)

  // Query params
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '1000'), 5000)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const desde = url.searchParams.get('desde') // ISO date filter: created after
  const nome = url.searchParams.get('nome') // filter by person name (ilike)
  const endpoint = url.searchParams.get('endpoint') || 'visitas' // visitas | pessoas | resumo

  try {
    if (endpoint === 'pessoas') {
      let query = supabase
        .from('pessoas')
        .select('*', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .range(offset, offset + limit - 1)

      if (nome) query = query.ilike('nome', `%${nome}%`)
      if (desde) query = query.gte('criado_em', desde)

      const { data, error, count } = await query
      if (error) throw error

      return new Response(JSON.stringify({ total: count, limit, offset, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (endpoint === 'resumo') {
      const { count: totalPessoas } = await supabase.from('pessoas').select('*', { count: 'exact', head: true })
      const { count: totalVisitas } = await supabase.from('visitas').select('*', { count: 'exact', head: true })
      
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const { count: visitasHoje } = await supabase
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .gte('data_hora', hoje.toISOString())

      const semanaAtras = new Date()
      semanaAtras.setDate(semanaAtras.getDate() - 7)
      const { count: visitasSemana } = await supabase
        .from('visitas')
        .select('*', { count: 'exact', head: true })
        .gte('data_hora', semanaAtras.toISOString())

      return new Response(JSON.stringify({
        total_pessoas: totalPessoas,
        total_visitas: totalVisitas,
        visitas_hoje: visitasHoje,
        visitas_ultimos_7_dias: visitasSemana,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Default: visitas com dados da pessoa
    let query = supabase
      .from('visitas')
      .select('*, pessoas(*)', { count: 'exact' })
      .order('data_hora', { ascending: false })
      .range(offset, offset + limit - 1)

    if (nome) query = query.ilike('pessoas.nome', `%${nome}%`)
    if (desde) query = query.gte('data_hora', desde)

    const { data, error, count } = await query
    if (error) throw error

    return new Response(JSON.stringify({ total: count, limit, offset, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
