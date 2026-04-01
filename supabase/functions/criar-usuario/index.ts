// v10 - criar, atualizar, deletar usuario - generateLink workaround
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ===== DELETE USER =====
    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id é obrigatório' }, 400);

      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
      await supabaseAdmin.from('usuarios').delete().eq('user_id', user_id);
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: 'Erro ao deletar usuário: ' + error.message }, 500);
      return json({ success: true, message: 'Usuário deletado com sucesso' });
    }

    // ===== CREATE / UPDATE USER =====
    const { nome, senha, tipo } = body;

    if (!nome || !senha) return json({ error: 'Nome e senha são obrigatórios' }, 400);
    if (senha.length < 6) return json({ error: 'Senha deve ter pelo menos 6 caracteres' }, 400);

    const nomeNorm = nome.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const email = `${nomeNorm}@sistema.local`;
    const role = tipo === 'admin' ? 'admin' : 'recepcao';

    // Check if user already exists in usuarios by nome_usuario
    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id, user_id')
      .eq('nome_usuario', nome)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin.auth.admin.updateUserById(existing.user_id, { password: senha });
      await supabaseAdmin.from('user_roles').delete().eq('user_id', existing.user_id);
      await supabaseAdmin.from('user_roles').insert({ user_id: existing.user_id, role });
      return json({ success: true, message: 'Senha e perfil atualizados' });
    }

    // Try to create new auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    let authUserId: string;

    if (authError) {
      console.error('Auth create failed:', authError.message);

      // Use generateLink to discover existing user's ID
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email,
      });

      if (linkError || !linkData?.user?.id) {
        console.error('generateLink failed:', linkError?.message);
        return json({ error: 'Erro ao criar usuário. Tente outro nome.' }, 500);
      }

      authUserId = linkData.user.id;
      console.log('Found existing auth user via generateLink:', authUserId);

      // Update password
      await supabaseAdmin.auth.admin.updateUserById(authUserId, { password: senha });
    } else {
      authUserId = authUser.user.id;
    }

    // Insert into usuarios table
    const { error: userError } = await supabaseAdmin.from('usuarios').insert({
      user_id: authUserId,
      nome_usuario: nome,
      email,
    });

    if (userError) {
      console.error('Usuarios insert error:', userError);
      if (!authError) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      }
      return json({ error: 'Erro ao criar registro: ' + userError.message }, 500);
    }

    // Set role
    await supabaseAdmin.from('user_roles').delete().eq('user_id', authUserId);
    await supabaseAdmin.from('user_roles').insert({ user_id: authUserId, role });

    return json({ success: true, message: `Usuário "${nome}" criado com sucesso` });
  } catch (error) {
    console.error('criar-usuario error:', error);
    return json({ error: 'Erro interno no servidor' }, 500);
  }
});
