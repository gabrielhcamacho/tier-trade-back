# Fatia vertical — pagamentos fiscais e caixa

## Fluxo funcional

1. O usuário escolhe um título fiscal com saldo em aberto.
2. Registra valor, data, referência bancária e observação.
3. A API impede pagamento superior ao saldo e aceita liquidação parcial ou total.
4. Pagamento, título, obrigação, auditoria, outbox e caixa são atualizados na mesma transação.
5. Um estorno preserva o lançamento original e recompõe saldos e status.

## Integridade e segurança

- as operações exigem `FINANCE_EDIT`;
- somente títulos `TAX_OBLIGATION_PAYABLE` aceitam pagamento;
- `financial_payments` usa chave composta, FKs tenant-scoped, RLS habilitada e forçada;
- o saldo considera somente pagamentos não estornados;
- dinheiro usa `numeric` no banco e `Decimal` no serviço.

## Limites

O registro bancário é informado pelo usuário. Importação de extrato, conciliação automática, emissão de guia e lançamentos contábeis não fazem parte desta fatia.
