# Fatia vertical — aceite fiscal, obrigação e efeito financeiro

## Fluxo funcional

1. O usuário calcula e revisa a memória imutável.
2. Para cada componente positivo, confirma autoridade, competência, vencimento, responsável pelo recolhimento e efeito sobre o título de origem.
3. A API aceita o cálculo uma única vez e cria as obrigações.
4. Retenções confirmadas podem reduzir o saldo do título comercial por ajuste separado.
5. Obrigações recolhidas pelo tenant criam contas a pagar separadas em favor da autoridade fiscal.

## Integridade e segurança

- aceite exige simultaneamente `FISCAL_EDIT` e `FINANCE_EDIT`;
- todas as tabelas usam chave composta por tenant, RLS habilitada e forçada;
- o conjunto de obrigações deve corresponder exatamente aos componentes calculados com valor positivo;
- a operação inteira ocorre na transação tenant-scoped já existente;
- auditoria e outbox preservam origem, valores e decisões sem registrar segredos.

## Limites

Não há interpretação automática de legislação, baixa de contas a pagar, emissão de guia, integração bancária ou contabilização nesta fatia.
