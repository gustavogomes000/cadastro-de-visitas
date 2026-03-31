// v1 - Cadastro de Visitas
// Schema: usuarios(id, user_id, nome_usuario, email) + user_roles(user_id, role)
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
    const { nome, senha, tipo } = await req.json();

    if (!nome || !senha) {
      return json({ error: 'Nome e senha são obrigatórios' }, 400);
    }

    if (senha.length < 6) {
      return json({ error: 'Senha deve ter pelo menos 6 caracteres' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    // Create new auth user (no email confirmation)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: false,
    });

    if (authError) {
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
      // Non-fatal: user was created, just without explicit role
    }

    return json({ success: true, message: `Usuário "${nome}" criado com sucesso` });
  } catch (error) {
    console.error('criar-usuario error:', error);
    return json({ error: 'Erro interno no servidor' }, 500);
  }
});
