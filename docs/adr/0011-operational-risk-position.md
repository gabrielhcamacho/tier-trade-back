# ADR 0011 — Posição operacional de risco sem dados de mercado fictícios

## Status

Aceita para a primeira fatia da Fase 3.

## Contexto

O plano do MVP exige posição física e financeira, exposição, limites, hedge, MTM e P&L. Porém, o mesmo plano exige definir instrumentos, fontes, periodicidade e responsabilidade de execução antes da Fase 3. O Catálogo de Regras proíbe transformar exemplos ou hipóteses em parametrização produtiva.

## Decisão

- A posição operacional é calculada no backend a partir dos registros oficiais de contratos de compra e venda, estoque, alocações, expedições, previsões financeiras, títulos e baixas.
- Valores decimais permanecem strings na API e `numeric` no PostgreSQL.
- O limite de posição líquida é uma política versionada por tenant e commodity. Alterações geram auditoria e outbox.
- O status do limite é `UNCONFIGURED`, `WITHIN_LIMIT`, `WARNING` ou `EXCEEDED`; não existe limite implícito.
- MTM, P&L, exposição a preço, base, câmbio e VaR permanecem `BLOCKED_CONFIGURATION` até fonte, instrumento, praça, frequência e política serem homologados.
- A posição desta fatia é uma agregação operacional síncrona e pequena. Antes de volume produtivo relevante, ela será promovida a read model incremental, preservando o contrato da API.

## Consequências

A tela de Risco deixa de usar números demonstrativos e reage a alterações reais no domínio. A fatia não promete risco de mercado antes da configuração obrigatória e não transforma compromissos brutos em resultado contábil ou fiscal.
