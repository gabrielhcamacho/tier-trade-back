# Segurança inicial

- A identidade por `x-tenant-id` e `x-actor-id` existe somente para desenvolvimento e falha fechada em produção.
- A escolha do provedor OIDC é uma decisão pendente antes de qualquer ambiente compartilhado.
- O tenant será derivado da identidade confiável, nunca de um valor arbitrário enviado pelo cliente.
- Autorização combina membership/capability na aplicação, chaves compostas e RLS no banco.
- Logs não devem conter documentos, segredos, tokens ou payloads financeiros integrais.
- O schema `app` permanece fora da Data API do Supabase; acesso ocorre pela conexão PostgreSQL do backend.
