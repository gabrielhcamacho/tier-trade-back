# API de dashboards incrementais

Os dashboards não agregam livros operacionais durante a requisição. O worker consome a outbox, invalida módulos dependentes em uma fila deduplicada e publica um snapshot por `(tenant_id,module,scope_key)`.

## Endpoints

- `GET /v1/dashboards`: retorna o estado dos oito módulos em uma leitura tenant-scoped;
- `GET /v1/dashboards/:module`: retorna `central`, `commercial`, `contracts`, `operations`, `inventory`, `risk`, `financial` ou `fiscal`;
- `POST /v1/dashboards/:module/refresh`: solicita reconstrução deduplicada e retorna `202`.

As respostas incluem `snapshotVersion`, `generatedAt`, `sourceWatermark`, `buildDurationMs` e `freshness`. `REBUILDING` pode acompanhar o snapshot anterior; ausência inicial retorna payload nulo até a primeira passagem do worker. O cliente deve exibir esse estado, sem representar dados antigos como atuais.

`ETag`, `Cache-Control: private`, `max-age=5` e `stale-while-revalidate=30` permitem que o navegador evite transferências repetidas sem compartilhar dados entre tenants. As coleções completas continuam nos endpoints de drill-down dos módulos.

## Processamento

Eventos próximos incrementam uma única versão pendente por módulo. Claims usam lease recuperável e `FOR UPDATE SKIP LOCKED`. O snapshot só é substituído por uma versão igual ou maior; se outro evento chegar durante o rebuild, a fila permanece pronta para uma nova passagem.

O worker enumera tenants ativos em páginas de 100 por padrão. Múltiplas réplicas podem percorrer a mesma página: os locks da outbox e da fila de refresh impedem trabalho duplicado efetivo. Toda consulta de rebuild contém filtro explícito de tenant e também passa pela RLS forçada.

## Composições por módulo

Além de `indicators`, cada snapshot publica `calendar` (`today` e `timezone`, hoje fixo em `America/Sao_Paulo`) e coleções em `breakdowns`, todas com escopo de tenant e valores decimais como texto:

- `central`: `flowByCommodity` (compra contratada/recebida e venda contratada/expedida), `dueByWeek` (vencidos e oito semanas de títulos a receber e a pagar) e `marginByContract`;
- `commercial`: `openDemandByCommodity` (com compra e venda), `offerFunnel` (90 dias), `activityByWeek` (12 semanas), `priceBridgeByCommodity` (compra, custos e margem ponderados por volume, 180 dias) e `topCounterparties`;
- `contracts`: `statusMix`, `obligationAging`, `deliveryByContract` (janela de entrega e volume recebido), `upcomingObligations` e `marginByContract`;
- `operations`: `loadsByDay` (de sete dias atrás a treze dias à frente), `receivedByWeek`, `qualityLast30Days`, `occurrencesByCategory` e `upcomingLoads`;
- `inventory`: `physicalByCommodity`, `physicalByLocation`, `movementsByWeek` e `lotGovernance`;
- `risk`: `positions` (com `utilization_pct`) e `exposureByMonth` (saldo não entregue por mês de fim da janela);
- `financial`: `dueByWeek`, `cashByMonth`, `aging` e `topReceivables`;
- `fiscal`: `documentsByMonth`, `openTaxesByComponent`, `upcomingObligations` e `taxByMonth`.

As coleções são aditivas dentro de `contractVersion` 1. Snapshots anteriores continuam válidos: o cliente mostra estado vazio para coleções ausentes até a próxima reconstrução, que a primeira leitura já agenda.
