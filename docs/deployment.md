# Implantação da API e do worker

## Unidade de entrega

A API e o dispatcher da outbox usam a mesma imagem OCI. Cada serviço recebe um processo diferente:

- API: `TIER_TRADE_PROCESS=api`, porta `3001`, sondas `GET /health/live` e `GET /health/ready`;
- worker: `TIER_TRADE_PROCESS=worker`, porta `9464`, sondas `GET /health/live`, `GET /health/ready` e métricas em `GET /metrics`.

O container executa o preflight obrigatório antes do processo. Ele roda sem privilégios e não contém código-fonte, dependências de desenvolvimento ou segredos.

## Configuração dos serviços

Ambos exigem `NODE_ENV=production`, `AUTH_MODE=supabase`, `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `WEB_ORIGIN` e `WEB_URL`. A API também aceita `PORT`. O worker exige `TENANT_ID` e aceita os limites `OUTBOX_*` documentados em `docs/outbox-observability.md`.

`DATABASE_URL` deve conter `sslmode=verify-full` e `sslrootcert=/run/secrets/supabase-root.crt`. O certificado raiz público do Supabase deve ser montado nesse caminho como arquivo secreto do provedor; ele não é incorporado à imagem.

Nesta versão, cada processo worker atende exatamente um tenant. O piloto usa um serviço worker para o tenant inicial. Uma célula com múltiplos tenants precisará de um supervisor que descubra tenants e distribua partições antes de ser considerada escalável.

## Migrações

O workflow `deploy-migrations.yml` é manual e usa GitHub Environments separados (`staging` e `production`). Cada ambiente guarda:

- `SUPABASE_ACCESS_TOKEN`;
- `SUPABASE_DB_PASSWORD`;
- `SUPABASE_PROJECT_ID`.

Produção deve exigir aprovação no Environment. O job vincula o projeto escolhido, mostra o dry-run, aplica apenas migrations pendentes e registra a lista final. A aplicação nunca executa migrations ao iniciar.

## Ordem de promoção

1. CI verde e imagem identificada pelo SHA do commit.
2. Backup/PITR verificados no Supabase.
3. Migration compatível com a versão atual (`expand`).
4. Deploy da API e validação de readiness.
5. Deploy do worker e validação de saúde/métricas.
6. Deploy do frontend e smoke test ponta a ponta.
7. Alterações destrutivas de schema somente em uma promoção futura (`contract`).

O workflow `deploy-containers.yml` usa Railway como destino inicial para acelerar o MVP. Em cada GitHub Environment, configure o secret `RAILWAY_TOKEN` e as variables `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_API_SERVICE_ID`, `RAILWAY_WORKER_SERVICE_ID` e `API_HEALTH_URL`. As variáveis de runtime e o certificado ficam nos respectivos serviços Railway, não no GitHub.

## Rollback

Reimplantar a imagem anterior da API e do worker. Migrations não são revertidas automaticamente: toda migration promovida deve ser retrocompatível com a imagem anterior. Se uma migration falhar, interromper a promoção, preservar a evidência e restaurar o banco conforme o runbook e o RPO/RTO aprovados.
