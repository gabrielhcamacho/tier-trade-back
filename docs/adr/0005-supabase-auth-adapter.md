# ADR 0005 — Supabase Auth como primeiro adaptador de identidade

- Status: aceito
- Data: 2026-10-01

## Decisão

Supabase Auth é o primeiro provedor de identidade. O frontend usa sessão SSR com PKCE e cookies por meio de `@supabase/ssr`. A API recebe `Authorization: Bearer`, valida o JWT contra o JWKS do projeto e exige emissor, audiência `authenticated`, expiração e `sub` UUID.

O `x-tenant-id` é somente um seletor de contexto. A identidade do ator vem exclusivamente do `sub` verificado, e cada operação confirma a membership ativa no banco. Nenhuma autorização depende de `user_metadata`, nenhum segredo ou chave `service_role` chega ao navegador e o schema `app` continua fora da Data API.

Projetos devem usar chaves assimétricas. O modo por cabeçalhos permanece apenas para desenvolvimento e falha fechado em produção.

## Consequências

- rotação de chaves usa o endpoint JWKS oficial;
- adicionar um usuário ao Auth não concede acesso a tenant: é necessária uma membership explícita;
- convite administrativo será coordenado com a criação da membership pelo futuro Control Plane;
- recuperação de senha já usa o fluxo hospedado do Supabase Auth.
