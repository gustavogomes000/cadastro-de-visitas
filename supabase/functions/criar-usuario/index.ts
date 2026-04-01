// v2 - Cadastro de Visitas — criar, atualizar senha, deletar usuário
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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // ===== DELETE USER =====
    if (action === 'delete') {
      const { user_id } = body;
      if (!user_id) return json({ error: 'user_id é obrigatório' }, 400);

      // Delete from user_roles
      await supabaseAdmin.from('user_roles').delete().eq('user_id', user_id);
      // Delete from usuarios
      await supabaseAdmin.from('usuarios').delete().eq('user_id', user_id);
      // Delete auth user
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

    // Normalize: remove special chars, spaces → dots
    const nomeNorm = nome
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');
    const email = `${nomeNorm}@sistema.local`;
    const role = tipo === 'admin' ? 'admin' : 'recepcao';

    // Check if user already exists in usuarios by nome_usuario
    const { data: existing } = await supabaseAdmin
      .from('usuarios')
      .select('id, user_id')
      .eq('nome_usuario', nome)
      .maybeSingle();

    if (existing) {
      // Update password only
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existing.user_id,
        { password: senha }
      );

      if (updateError) {
        console.error('Password update error:', updateError);
        return json({ error: 'Erro ao atualizar senha: ' + updateError.message }, 500);
      }

      // Upsert role
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', existing.user_id);
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: existing.user_id, role });

      return json({ success: true, message: 'Senha e perfil atualizados' });
    }

    // Create new auth user (email auto-confirmed so they can log in)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
    });

    if (authError) {
      // If email already exists in auth, try to find and link the existing auth user
      if (authError.message?.includes('already been registered')) {
        // List users to find by email
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = listData?.users?.find(u => u.email === email);
        if (existingAuthUser) {
          // Update password
          await supabaseAdmin.auth.admin.updateUserById(existingAuthUser.id, { password: senha });
          // Insert into usuarios
          await supabaseAdmin.from('usuarios').upsert({
            user_id: existingAuthUser.id,
            nome_usuario: nome,
            email,
          }, { onConflict: 'user_id' });
          // Insert role
          await supabaseAdmin.from('user_roles').delete().eq('user_id', existingAuthUser.id);
          await supabaseAdmin.from('user_roles').insert({ user_id: existingAuthUser.id, role });
          return json({ success: true, message: `Usuário "${nome}" vinculado e atualizado com sucesso` });
        }
      }
      console.error('Auth create error:', authError);
      return json({ error: 'Erro ao criar usuário: ' + authError.message }, 500);
    }

    // Insert into usuarios table
    const { error: userError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        user_id: authUser.user.id,
        nome_usuario: nome,
        email,
      });

    if (userError) {
      console.error('Usuarios insert error:', userError);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return json({ error: 'Erro ao criar registro de usuário: ' + userError.message }, 500);
    }

    // Insert role into user_roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: authUser.user.id, role });

    if (roleError) {
      console.error('Role insert error:', roleError);
    }

    return json({ success: true, message: `Usuário "${nome}" criado com sucesso` });
  } catch (error) {
    console.error('criar-usuario error:', error);
    return json({ error: 'Erro interno no servidor' }, 500);
  }
});
