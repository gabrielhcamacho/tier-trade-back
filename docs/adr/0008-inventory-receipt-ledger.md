# ADR 0008 — Estoque derivado do livro de movimentos

## Status

Aceita.

## Contexto

O recebimento físico precisa atualizar o estoque sem transformar um saldo mutável em fonte de verdade. Correções de pesagem e reabertura por qualidade precisam ser rastreáveis e não podem apagar o efeito anterior. O aceite físico também não autoriza inferir transferência jurídica de propriedade ou de risco.

## Decisão

- Cada carga aceita origina um lote estável e um movimento `RECEIPT`.
- Uma correção aceita gera apenas a diferença como `RECEIPT_CORRECTION`.
- A troca de aceito para revisão gera `RECEIPT_REVERSAL` e bloqueia o lote.
- Os movimentos são imutáveis; o saldo físico é calculado por `sum(quantity_delta_kg)`.
- A aplicação do efeito de estoque ocorre pelo `InventoryReceiptPort`, na mesma transação PostgreSQL que versiona o recebimento.
- `ownership_status` e `risk_status` começam como `PENDING_DEFINITION`. Custódia física começa como `IN_STORAGE` no destino informado pela carga.
- Todas as tabelas têm `tenant_id`, RLS forçada e chaves estrangeiras compostas pelo tenant.

## Consequências

O saldo e a pesagem não divergem por falha intermediária, correções permanecem auditáveis e nenhum direito jurídico é criado silenciosamente. Saídas, transferências, reservas e definição de titularidade serão movimentos ou decisões explícitas em slices posteriores.
