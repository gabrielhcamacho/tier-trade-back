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
