# Catálogo de eventos — v1

| Evento | Agregado | Quando | Consumidores previstos |
|---|---|---|---|
| `offer.created` | offer | oferta e cenário persistidos | auditoria, projeções |
| `offer.submitted` | offer | política de margem aplicada | fila de trabalho comercial |
| `offer.approved` | offer | aprovador decide exceção | fila de contratos |
| `contract.activated` | contract | contrato e obrigações criados | execução física futura |

Todos carregam `id`, `tenant_id`, tipo, agregado, payload mínimo e instante. A outbox é gravada na mesma transação da mudança. Publicação é pelo menos uma vez; consumidores devem deduplicar por `id`. O schema será versionado antes do primeiro consumidor externo.
