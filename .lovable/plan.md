## Plano de Redesign

### 1. Renomear tabelas no banco (migração)
- `pessoas` → `visitas_comite_pessoas`
- `visitas` → `visitas_comite_visitas`
- `usuarios` → `visitas_comite_usuarios`
- `user_roles` → `visitas_comite_user_roles`
- Recriar RLS policies, foreign keys e functions para as novas tabelas

### 2. Remover funcionalidades
- Remover envio para sistema externo (edge function `receber-cadastro-externo` e sync no frontend)
- Remover campo de foto do cadastro
- Remover seleção de "Tipo do visitante" (Liderança/Fiscal/Eleitor)

### 3. Vincular visita a suplente/liderança
- Adicionar campo `vinculado_a_id` e `vinculado_a_tipo` (suplente/lideranca) na tabela de visitas ou pessoas
- No cadastro, buscar suplentes e lideranças do **banco externo** via edge function
- Permitir selecionar a quem vincular o cadastro

### 4. Edge function para buscar dados do banco externo
- Criar edge function `buscar-externos` que conecta no Supabase externo usando `EXTERNAL_SUPABASE_URL` e `EXTERNAL_SUPABASE_SERVICE_KEY`
- Busca suplentes e lideranças com busca por nome (independente de cidade)

### 5. Dashboard Admin
- Nova página `/dashboard` só para admins
- Lista todos os cadastros com:
  - Nome da pessoa
  - Etiqueta de quem indicou (nome do suplente/liderança + tipo)
  - Busca por nome independente de tudo
  - Dados completos do cadastro

### 6. Atualizar todo o código
- Atualizar todas as queries do Supabase para usar os novos nomes de tabela
- Atualizar AuthContext, pages, hooks, edge functions
