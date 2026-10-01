# Segurança inicial

- Supabase Auth é o primeiro adaptador de identidade; a API valida JWT por JWKS, emissor, audiência e expiração.
- `x-actor-id` existe somente no modo de desenvolvimento e falha fechado em produção.
- `x-tenant-id` seleciona o contexto, mas nunca autoriza sozinho: o ator vem do `sub` verificado e toda operação confirma membership ativa.
- Autorizações não usam `user_metadata` ou dados mutáveis pelo usuário.
- O frontend recebe somente a publishable key; `service_role` e outros segredos nunca são variáveis `NEXT_PUBLIC_*`.
- Autorização combina membership/capability na aplicação, chaves compostas e RLS no banco.
- Logs não devem conter documentos, segredos, tokens ou payloads financeiros integrais.
- O schema `app` permanece fora da Data API do Supabase; acesso ocorre pela conexão PostgreSQL do backend.
