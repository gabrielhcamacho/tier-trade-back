# Tier Trade API

Backend modular da plataforma Tier Trade. A primeira fatia cobre oferta de compra de milho, cálculo determinístico de margem, aprovação e ativação do contrato. A segunda fatia começa pela programação de cargas vinculadas ao contrato ativo.

## Desenvolvimento local

1. Suba o PostgreSQL pelo repositório `tier-trade-platform`.
2. Copie `.env.example` para `.env` e carregue as variáveis no terminal.
3. Rode a migration e o seed local conforme o README da plataforma.
4. Execute `pnpm install`, `pnpm test` e `pnpm dev`.

Em outro processo, execute o dispatcher transacional compartilhado:

```sh
pnpm worker:outbox
```

O worker descobre tenants ativos em páginas, preserva a RLS em cada transação e materializa a outbox e os dashboards com reprocessamento idempotente. `TENANT_ID` continua opcional para diagnóstico isolado de um cliente.

Swagger fica em `http://localhost:3001/docs`. Os cabeçalhos locais estão documentados em `.env.example` e no seed; eles não funcionam em produção.

Em ambiente compartilhado, configure `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `WEB_URL`. A API aceita apenas o JWT de usuário no header Bearer e resolve automaticamente o único tenant ativo no Control Plane. A secret key fica exclusivamente no backend e é usada somente para o convite administrativo.

Antes de iniciar um processo compartilhado ou de produção, execute `TIER_TRADE_PROCESS=api pnpm environment:check` ou `TIER_TRADE_PROCESS=worker pnpm environment:check`. Em produção, o gate exige URLs públicas HTTPS e conexão PostgreSQL com `sslmode=verify-full` e `sslrootcert`.

`POST /v1/access/invitations` exige `ACCESS_MANAGE`, envia o convite para definição de senha e cria a membership com capabilities explícitas. `GET /v1/session` retorna o tenant resolvido e as capabilities do usuário autenticado.

`POST /v1/contracts/:contractId/loads` exige `OPERATIONS_EDIT` e programa uma carga no fuso do tenant. `GET /v1/contracts/:contractId/loads` retorna a agenda e o saldo de peso; `GET /v1/loads/:loadId` retorna o detalhe. A programação rejeita contratos inativos, datas fora da janela e peso acima do saldo.

`PUT /v1/loads/:loadId/schedule` reprograma somente cargas `SCHEDULED`, com motivo obrigatório, janela e saldo verificados transacionalmente. `POST /v1/loads/:loadId/cancel` libera a reserva, mantém a carga no histórico e exige motivo. Ambos rejeitam cargas que já iniciaram recebimento ou possuem pesagem; as alterações são auditadas e enviadas à outbox.

Sondas operacionais: `GET /health/live` verifica o processo e `GET /health/ready` verifica o banco.

Leia `docs/first-slice.md` e `docs/second-slice.md` antes de ampliar o domínio.
