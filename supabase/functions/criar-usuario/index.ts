// v8 - criar, atualizar, deletar usuario
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
      if (error) {
        console.error('Delete user error:', error);
        return json({ error: 'Erro ao deletar usuário: ' + error.message }, 500);
      }
      return json({ success: true, message: 'Usuário deletado com sucesso' });
    }

    // ===== CREATE / UPDATE USER =====
    const { nome, senha, tipo } = body;

    if (!nome || !senha) {
      return json({ error: 'Nome e senha são obrigatórios' }, 400);
    }
    if (senha.length < 6) {
      return json({ error: 'Senha deve ter pelo menos 6 caracteres' }, 400);
    }

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
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existing.user_id,
        { password: senha }
      );
      if (updateError) {
        return json({ error: 'Erro ao atualizar senha: ' + updateError.message }, 500);
      }
      await supabaseAdmin.from('user_roles').delete().eq('user_id', existing.user_id);
      await supabaseAdmin.from('user_roles').insert({ user_id: existing.user_id, role });
      return json({ success: true, message: 'Senha e perfil atualizados' });
    }

    // Helper: find auth user by email and link
    async function findAndLinkAuthUser(): Promise<Response | null> {
      // Use the Supabase Auth Admin API to get user by email
      // We need to query the auth.users via SQL since listUsers has issues
      const { data: authUsers, error: queryErr } = await supabaseAdmin
        .rpc('find_auth_user_by_email', { _email: email });
      
      // Fallback: try direct REST
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
        },
      });

      if (!res.ok) {
        console.error('Admin users endpoint failed:', res.status);
        return null;
      }

      const data = await res.json();
      const users = data.users || [];
      console.log(`Found ${users.length} auth users total`);
      
      const found = users.find((u: any) => u.email === email);
      if (!found) {
        console.log(`No auth user found with email: ${email}`);
        return null;
      }

      console.log(`Found auth user ${found.id} for email ${email}`);

      // Update password
      await supabaseAdmin.auth.admin.updateUserById(found.id, { password: senha });

      // Insert into usuarios
      await supabaseAdmin.from('usuarios').insert({
        user_id: found.id,
        nome_usuario: nome,
        email,
      });

      // Set role
      await supabaseAdmin.from('user_roles').delete().eq('user_id', found.id);
      await supabaseAdmin.from('user_roles').insert({ user_id: found.id, role });

      return json({ success: true, message: `Usuário "${nome}" criado com sucesso` });
    }

    // Try to create new auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      console.error('Auth create failed:', authError.message);

      // Try to recover by finding existing auth user
      const recovered = await findAndLinkAuthUser();
      if (recovered) return recovered;

      return json({ error: 'Erro ao criar usuário: ' + authError.message }, 500);
    }

    // New user created successfully
    const { error: userError } = await supabaseAdmin.from('usuarios').insert({
      user_id: authUser.user.id,
      nome_usuario: nome,
      email,
    });

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return json({ error: 'Erro ao criar registro de usuário: ' + userError.message }, 500);
    }

    await supabaseAdmin.from('user_roles').insert({ user_id: authUser.user.id, role });

    return json({ success: true, message: `Usuário "${nome}" criado com sucesso` });
  } catch (error) {
    console.error('criar-usuario error:', error);
    return json({ error: 'Erro interno no servidor' }, 500);
  }
});
