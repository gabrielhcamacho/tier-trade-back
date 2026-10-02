# Catálogo de eventos — v1

| Evento | Agregado | Quando | Consumidores previstos |
|---|---|---|---|
| `offer.created` | offer | oferta e cenário persistidos | auditoria, projeções |
| `offer.submitted` | offer | política de margem aplicada | fila de trabalho comercial |
| `offer.approved` | offer | aprovador decide exceção | fila de contratos |
| `contract.activated` | contract | contrato e obrigações criados | execução física futura |
| `offer.repriced` | offer | rascunho recalculado em novo cenário | auditoria, projeções |
| `offer.cancelled` | offer | oferta cancelada antes do contrato | auditoria, projeções |
| `margin_policy.changed` | margin_policy | tenant publica nova versão | auditoria, projeções |
| `load.scheduled` | load | carga reservada no contrato | agenda operacional |
| `load.receiving_started` | load | operador inicia o recebimento | pátio, fila de trabalho |
| `load.receipt_recorded` | load | primeira pesagem e classificação registradas | estoque, saldo contratual |
| `load.receipt_corrected` | load | nova versão substitui o registro vigente | estoque, reconciliação |
| `sales_contract.created` | sales_contract | demanda de venda é formalizada | alocação, carteira de venda |
| `sales_contract.updated` | sales_contract | condições ainda executáveis são alteradas | carteira de venda, auditoria |
| `inventory.allocated` | inventory_allocation | lote é reservado para contrato de venda | disponibilidade, programação |
| `inventory.allocation_released` | inventory_allocation | reserva sem expedição é liberada | disponibilidade |
| `inventory.dispatched` | inventory_dispatch | saída parcial ou total é confirmada | estoque, saldo contratual, financeiro futuro |

Todos carregam `id`, `tenant_id`, tipo, agregado, payload mínimo e instante. A outbox é gravada na mesma transação da mudança. Publicação é pelo menos uma vez; consumidores deduplicam por `id`.

## Processamento interno

- o worker recebe um `TENANT_ID` e nunca contorna a RLS;
- eventos são reclamados com lease recuperável e `FOR UPDATE SKIP LOCKED`;
- falhas usam backoff exponencial limitado a cinco minutos;
- `commercial_activity_read_model` registra a linha do tempo de todos os eventos;
- `contract_summary_read_model` é criada idempotentemente por `contract.activated`;
- o módulo de estoque registra, na mesma transação do recebimento, entrada, correção ou estorno compensatório; o saldo é sempre a soma do livro de movimentos;
- alocações alteram somente disponibilidade; expedições criam movimento `DISPATCH` negativo e atualizam o saldo executado da venda na mesma transação;
- `published_at` indica entrega aos consumidores internos atuais.
- o worker expõe saúde em `/health/live` e `/health/ready` e métricas em `/metrics` na porta operacional própria;
- falha, retentativa e recuperação geram logs JSON sem payload de negócio.

O schema será versionado antes do primeiro consumidor externo. Esse transporte terá controle de entrega próprio para não confundir projeção interna com publicação fora do processo.
