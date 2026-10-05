# Catálogo de eventos — v1

| Evento | Agregado | Quando | Consumidores previstos |
|---|---|---|---|
| `offer.created` | offer | oferta e cenário persistidos | auditoria, projeções |
| `counterparty.profile_changed` | counterparty | usuário confirma perfil antes não classificado | auditoria comercial |
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
| `load.yard_event_recorded` | load | carga avança por check-in, fila, balança, liberação ou saída | pátio, fila de trabalho |
| `load.occurrence_created` | load | exceção operacional é registrada | operações, fila de trabalho |
| `load.occurrence_resolved` | load | ocorrência recebe resolução sem apagar o fato original | operações, auditoria |
| `load.romaneio_issued` | load | primeira versão do romaneio é emitida após aceite | operações, documentos |
| `load.romaneio_corrected` | load | nova versão acompanha correção do recebimento | operações, documentos, auditoria |
| `sales_contract.created` | sales_contract | demanda de venda é formalizada | alocação, carteira de venda |
| `sales_contract.updated` | sales_contract | condições ainda executáveis são alteradas | carteira de venda, auditoria |
| `inventory.allocated` | inventory_allocation | lote é reservado para contrato de venda | disponibilidade, programação |
| `inventory.allocation_released` | inventory_allocation | reserva sem expedição é liberada | disponibilidade |
| `inventory.dispatched` | inventory_dispatch | saída parcial ou total é confirmada | estoque, saldo contratual |
| `finance.forecast_projected` | financial_event | expedição de venda gera entrada prevista | títulos, posição financeira, caixa |
| `finance.title_issued` | financial_title | previsão pronta é vinculada a documento e vencimento | contas a receber |
| `finance.receipt_recorded` | financial_settlement | baixa parcial ou total é confirmada | caixa, conciliação |
| `finance.receipt_reversed` | financial_settlement | baixa é estornada com motivo | caixa, conciliação, auditoria |
| `finance.title_adjusted` | financial_title_adjustment | retenção confirmada reduz o saldo do título comercial sem alterar seu valor original | contas a receber/pagar, auditoria |
| `finance.tax_payable_projected` | financial_event | obrigação sob responsabilidade do tenant gera título separado em favor da autoridade | contas a pagar, caixa |
| `finance.payment_recorded` | financial_payment | pagamento parcial ou total de título fiscal é confirmado | caixa, obrigação fiscal, conciliação |
| `finance.payment_reversed` | financial_payment | pagamento fiscal é estornado com motivo | caixa, obrigação fiscal, conciliação, auditoria |
| `fiscal.document_received` | fiscal_document | NF-e é vinculada à expedição e ao evento financeiro | validação fiscal, auditoria |
| `fiscal.document_corrected` | fiscal_document | dados do documento são corrigidos e voltam à conferência | validação fiscal, financeiro |
| `fiscal.document_validated` | fiscal_document | chave e valor são conferidos e o título é vinculado | financeiro, reconciliação |
| `fiscal.document_rejected` | fiscal_document | documento é rejeitado com motivo e seu vínculo financeiro é removido | correção fiscal, auditoria |
| `fiscal.establishment_created` | fiscal_establishment | estabelecimento fiscal é cadastrado para o tenant | configuração fiscal |
| `fiscal.establishment_updated` | fiscal_establishment | cadastro ou regime do estabelecimento é corrigido | configuração fiscal |
| `fiscal.configuration_drafted` | fiscal_configuration | primeira versão é criada como rascunho | homologação fiscal |
| `fiscal.configuration_updated` | fiscal_configuration | rascunho recebe parâmetros homologados | homologação fiscal |
| `fiscal.configuration_activated` | fiscal_configuration | versão completa entra em vigência | motor tributário |
| `fiscal.configuration_version_created` | fiscal_configuration | sucessora é clonada sem reescrever a versão anterior | homologação fiscal |
| `fiscal.calculation_completed` | fiscal_calculation | contexto seleciona uma versão única e a memória é persistida | obrigações, financeiro, contabilidade |
| `fiscal.authority_created` | fiscal_authority | autoridade favorecida pelo recolhimento é cadastrada | obrigações, financeiro |
| `fiscal.obligation_confirmed` | fiscal_obligation | componente calculado recebe competência, vencimento, autoridade e responsabilidade | financeiro, agenda fiscal |
| `fiscal.calculation_accepted` | fiscal_calculation | usuário confirma integralmente os efeitos dos componentes positivos | auditoria, contabilidade futura |

Todos carregam `id`, `tenant_id`, tipo, agregado, payload mínimo e instante. A outbox é gravada na mesma transação da mudança. Publicação é pelo menos uma vez; consumidores deduplicam por `id`.

## Processamento interno

- o worker recebe um `TENANT_ID` e nunca contorna a RLS;
- eventos são reclamados com lease recuperável e `FOR UPDATE SKIP LOCKED`;
- falhas usam backoff exponencial limitado a cinco minutos;
- `commercial_activity_read_model` registra a linha do tempo de todos os eventos;
- `contract_summary_read_model` é criada idempotentemente por `contract.activated`;
- o módulo de estoque registra, na mesma transação do recebimento, entrada, correção ou estorno compensatório; o saldo é sempre a soma do livro de movimentos;
- alocações alteram somente disponibilidade; expedições criam movimento `DISPATCH` negativo e atualizam o saldo executado da venda na mesma transação;
- a mesma transação da expedição cria o evento financeiro canônico; título e baixa continuam fatos posteriores e separados;
- validação fiscal compara o total da NF-e ao evento financeiro; não calcula tributos e liga o título apenas quando não há divergência;
- configurações fiscais ativas são imutáveis e o motor registra entrada, versão, bases, alíquotas, valores não arredondados, arredondamento e resultado;
- o aceite fiscal cria obrigações e seus efeitos financeiros na mesma transação; a redução do título comercial e o título a pagar à autoridade são fatos separados;
- pagamentos fiscais usam livro próprio; registro e estorno recompõem título, obrigação e caixa na mesma transação;
- `published_at` indica entrega aos consumidores internos atuais.
- o worker expõe saúde em `/health/live` e `/health/ready` e métricas em `/metrics` na porta operacional própria;
- falha, retentativa e recuperação geram logs JSON sem payload de negócio.

O schema será versionado antes do primeiro consumidor externo. Esse transporte terá controle de entrega próprio para não confundir projeção interna com publicação fora do processo.

# Risco

- `risk.policy_configured`: nova versão do limite por commodity, com política substituída e valores usados.
# Eventos financeiros de governança

- `finance.purchase_cost_component_created`
- `finance.purchase_cost_component_reversed`
- `finance.policy_configured`
- `finance.payment_batch_created`
- `finance.payment_batch_submitted`
- `finance.payment_batch_approved`
- `finance.payment_batch_executed`
- `finance.bank_account_created`
- `finance.bank_statement_imported`
- `finance.bank_statement_reconciled`
