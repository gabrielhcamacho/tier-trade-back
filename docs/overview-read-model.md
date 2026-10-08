# Central: contrato de leitura v1

`GET /v1/overview` reúne leituras dos módulos donos dos dados. Exige a identidade autenticada e membership ativa no tenant. Não grava lançamentos nem substitui os cálculos oficiais dos módulos.

- `contractVersion: 1` identifica o formato da resposta; `assembledAt` é o horário da montagem, não o horário de atualização de cada fonte.
- `consistency: MULTI_TRANSACTION` sinaliza que os módulos são lidos em transações separadas. Uma gravação concorrente pode aparecer em uma fonte e não em outra; a resposta não é um snapshot global.
- Valores monetários e volumes trafegam como strings decimais. `projectedMarginAmount` soma `quantity_sc × projected_margin_per_sc` somente dos contratos ativos. Se qualquer componente exigir arredondamento de fração de centavo, o total fica `null` com `PENDING_ROUNDING_POLICY`. A versão da política vem do cenário vigente de cada contrato.
- `dueDates` agrupa saldos em aberto de títulos por data e direção. Não é projeção de caixa: faltam saldo bancário inicial e movimentos futuros ainda não titulados.
- `byCommodity` separa compras contratadas/recebidas e vendas contratadas/expedidas, sem misturar esses dois fluxos como uma única exposição.
- `commodity=MILHO|SOJA` filtra ofertas, contratos, execução física e risco. O financeiro segue consolidado no tenant (`financeScope: TENANT_CONSOLIDATED`), inclusive quando commodity é informada. Unidade operacional, safra e período retornam erro 400; o backend ainda não possui vínculo confiável para filtrá-los.
- `access.scope: TENANT` registra a abrangência atual. Os papéis de direção/equipe e o escopo por unidade não estão modelados; as capabilities atuais são de ação, não de visualização. A criação de visões restritas requer decisão e implementação próprias antes de ser afirmada.
- `unavailable` lista a ponte de margem realizada, projeção de caixa, insights de IA e escopo por papel/unidade. Não devem ser substituídos por dados ilustrativos em contas reais.

As coleções em `sources` preservam temporariamente os contratos existentes dos módulos para migração da Central sem multiplicar chamadas HTTP. A versão 2 removerá esse envelope, separará os endpoints de drill-down e passará a ler snapshots incrementais conforme o ADR 0019.
