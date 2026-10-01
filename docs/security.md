# Segurança inicial

- Supabase Auth é o primeiro adaptador de identidade; a API valida JWT por JWKS, emissor, audiência e expiração.
- `x-actor-id` existe somente no modo de desenvolvimento e falha fechado em produção.
- em produção, o tenant é resolvido no Control Plane a partir do `sub` verificado; o cliente não envia nem escolhe `tenant_id`.
- Autorizações não usam `user_metadata` ou dados mutáveis pelo usuário.
- O frontend recebe somente a publishable key; a secret key usada para convites existe apenas no backend e nunca é variável `NEXT_PUBLIC_*`.
- Autorização combina membership/capability na aplicação, chaves compostas e RLS no banco.
- Logs não devem conter documentos, segredos, tokens ou payloads financeiros integrais.
- O schema `app` permanece fora da Data API do Supabase; acesso ocorre pela conexão PostgreSQL do backend.
- O schema `control` também permanece fora da Data API e seu acesso é restrito ao papel de runtime da API.
