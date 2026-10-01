# Tier Trade API

Backend modular da plataforma Tier Trade. A primeira fatia cobre oferta de compra de milho, cálculo determinístico de margem, aprovação e ativação do contrato.

## Desenvolvimento local

1. Suba o PostgreSQL pelo repositório `tier-trade-platform`.
2. Copie `.env.example` para `.env` e carregue as variáveis no terminal.
3. Rode a migration e o seed local conforme o README da plataforma.
4. Execute `pnpm install`, `pnpm test` e `pnpm dev`.

Em outro processo, execute o dispatcher transacional para o tenant local:

```sh
TENANT_ID=11111111-1111-4111-8111-111111111111 pnpm worker:outbox
```

O worker é deliberadamente restrito a um tenant por execução. Ele materializa a linha do tempo comercial e o resumo de contrato com reprocessamento idempotente.

Swagger fica em `http://localhost:3001/docs`. Os cabeçalhos locais estão documentados em `.env.example` e no seed; eles não funcionam em produção.

Em ambiente compartilhado, configure `AUTH_MODE=supabase`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` e `WEB_URL`. A API aceita apenas o JWT de usuário no header Bearer e resolve automaticamente o único tenant ativo no Control Plane. A secret key fica exclusivamente no backend e é usada somente para o convite administrativo.

`POST /v1/access/invitations` exige `ACCESS_MANAGE`, envia o convite para definição de senha e cria a membership com capabilities explícitas. `GET /v1/session` retorna o tenant resolvido e as capabilities do usuário autenticado.

Sondas operacionais: `GET /health/live` verifica o processo e `GET /health/ready` verifica o banco.

Leia `docs/first-slice.md` antes de ampliar o domínio.
