# Implantação da API e do worker

## Destino do MVP

O backend é implantado no DigitalOcean App Platform a partir do repositório
`gabrielhcamacho/tier-trade-back`. O App Platform acompanha a branch `main` e
reimplanta os componentes quando um commit novo chega ao GitHub.

A API e o dispatcher da outbox usam a mesma imagem OCI e processos distintos:

- API: `TIER_TRADE_PROCESS=api`, porta `3001`, saúde em `GET /health/live` e prontidão em `GET /health/ready`;
- worker: `TIER_TRADE_PROCESS=worker`, porta interna `9464`, saúde em `GET /health/live`, prontidão em `GET /health/ready` e métricas em `GET /metrics`.

O container executa o preflight obrigatório antes do processo, roda sem
privilégios e não contém código-fonte, dependências de desenvolvimento ou
segredos. O certificado público `certs/supabase-root-2021.crt` é incorporado à
imagem; credenciais nunca são incorporadas.

## Componentes do App Platform

A especificação-base está em `ops/digitalocean/app-spec.yaml.example`. Ela é um
modelo revisável e não deve ser enviada sem substituir os marcadores
`SET_VIA_MCP_*`. A criação efetiva é feita pelo MCP autenticado do DigitalOcean,
que envia os valores secretos diretamente ao App Platform.

O MVP usa dois containers `apps-s-1vcpu-0.5gb`, um para cada componente. Antes
de criar ou redimensionar recursos pagos, confirme o preço vigente no App
Platform.

## Variáveis de runtime

Ambos os processos exigem:

- `NODE_ENV=production`;
- `AUTH_MODE=supabase`;
- `DATABASE_URL` como segredo;
- `SUPABASE_URL`;
- `SUPABASE_SECRET_KEY` como segredo;
- `WEB_ORIGIN` e `WEB_URL` com a URL HTTPS pública do frontend;
- `DATABASE_POOL_MAX`, `DATABASE_IDLE_TIMEOUT_MS` e `DATABASE_CONNECTION_TIMEOUT_MS`;
- `OTEL_SERVICE_NAME`.

`DATABASE_URL` deve conter `sslmode=verify-full` e
`sslrootcert=/etc/ssl/certs/supabase-root-2021.crt`. Para o plano inicial, a API
usa no máximo cinco conexões e o worker três, evitando consumir de forma
desnecessária o limite do pooler do Supabase.

O worker também exige `TENANT_ID` e aceita os limites `OUTBOX_*` documentados em
`docs/outbox-observability.md`. Nesta versão, cada worker atende exatamente um
tenant. O piloto usa o tenant de demonstração. Antes de liberar onboarding em
produção, deve existir um supervisor que descubra tenants e distribua partições,
ou um processo worker independente por tenant.

## Migrações

O workflow `deploy-migrations.yml` é manual e usa GitHub Environments separados
(`staging` e `production`). Cada ambiente guarda:

- `SUPABASE_ACCESS_TOKEN`;
- `SUPABASE_DB_PASSWORD`;
- `SUPABASE_PROJECT_ID`.

Produção deve exigir aprovação no Environment. O job vincula o projeto
escolhido, mostra o dry-run, aplica somente migrations pendentes e registra a
lista final. A aplicação nunca executa migrations ao iniciar.

## Ordem de promoção

1. CI verde e commit identificado.
2. Backup/PITR verificados no Supabase.
3. Migration compatível com a versão atual (`expand`).
4. Deploy da API e validação de readiness.
5. Deploy do worker e validação da sonda de vida.
6. Configuração de `NEXT_PUBLIC_API_URL` no frontend e novo deploy na Vercel.
7. Smoke test autenticado ponta a ponta.
8. Alterações destrutivas de schema somente em promoção futura (`contract`).

## Rollback

Selecione no App Platform um deployment anterior saudável e reimplante API e
worker juntos. Migrations não são revertidas automaticamente: toda migration
promovida deve ser retrocompatível com a imagem anterior. Se uma migration
falhar, interrompa a promoção, preserve a evidência e restaure o banco conforme
o runbook e o RPO/RTO aprovados.
