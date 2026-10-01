# Tier Trade API

Backend modular da plataforma Tier Trade. A primeira fatia cobre oferta de compra de milho, cálculo determinístico de margem, aprovação e ativação do contrato.

## Desenvolvimento local

1. Suba o PostgreSQL pelo repositório `tier-trade-platform`.
2. Copie `.env.example` para `.env` e carregue as variáveis no terminal.
3. Rode a migration e o seed local conforme o README da plataforma.
4. Execute `pnpm install`, `pnpm test` e `pnpm dev`.

Swagger fica em `http://localhost:3001/docs`. Os cabeçalhos locais estão documentados em `.env.example` e no seed; eles não funcionam em produção.

Sondas operacionais: `GET /health/live` verifica o processo e `GET /health/ready` verifica o banco.

Leia `docs/first-slice.md` antes de ampliar o domínio.
