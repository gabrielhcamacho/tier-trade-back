# Fase 3 — posição e risco operacional

## Entregue

- `GET /v1/risk`: consolida posição contratual, estoque, cobertura da venda e posição financeira por commodity;
- `PATCH /v1/risk/policy`: publica nova versão do limite líquido, protegida por `RISK_MANAGE`;
- isolamento obrigatório por tenant, RLS forçada, FKs compostas, índices de acesso e trilha auditável;
- conta de demonstração com política persistida e editável;
- bloqueio explícito das métricas que dependem de mercado ou hedge ainda não homologados.

## Definições desta fatia

- posição contratual líquida: compras ativas em kg menos vendas ativas em kg;
- estoque físico: soma do livro de movimentos de estoque;
- estoque comprometido: alocação ativa ainda não expedida;
- cobertura da venda: alocado mais expedido, limitado ao volume vendido;
- compromissos financeiros: valores brutos contratuais, sem tributos ou contabilização presumidos;
- recebíveis: eventos, títulos e baixas oficiais do módulo Financeiro.

## Fora desta fatia

MTM, P&L, VaR, curvas, base, câmbio e hedge. A implementação depende das decisões registradas em `docs/decisions-pending.md`.
