# ADR 0012 — Cadeia de validação do documento fiscal

## Status

Aceita para o MVP.

## Contexto

A fase fiscal precisa ligar a evidência documental à execução física e ao direito financeiro sem antecipar interpretação tributária ainda não homologada. O catálogo do piloto não autoriza inventar CFOP, incidência, alíquota, retenção ou lançamento contábil.

## Decisão

- A primeira entrega fiscal registra NF-e de saída vinculada, por chaves compostas de tenant, a `inventory_dispatches`, `sales_contracts` e `financial_events`.
- O documento nasce em `RECEIVED`, pode ser corrigido sem exclusão e só passa a `VALIDATED` com chave de acesso de 44 dígitos e igualdade exata entre o valor informado e o evento financeiro.
- Uma validação liga automaticamente o título existente pelo `financial_event_id`. Correção ou rejeição remove esse vínculo, mas preserva documento, auditoria e eventos.
- O cálculo tributário permanece explicitamente `BLOCKED_CONFIGURATION` até a homologação do pacote fiscal do piloto.
- Todas as mutações exigem `FISCAL_EDIT`, usam transação com contexto de tenant, RLS forçada e audit/outbox na mesma transação.

## Consequências

- Já é possível demonstrar e operar a cadeia documento → expedição → contrato → previsão → título com dados reais do backend.
- O registro não representa autorização, emissão nativa nem cálculo de tributos.
- A próxima extensão deve versionar o pacote fiscal homologado antes de produzir qualquer obrigação tributária.
