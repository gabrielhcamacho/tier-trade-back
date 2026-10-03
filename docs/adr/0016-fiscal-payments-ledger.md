# ADR 0016 — livro separado para pagamentos fiscais

## Contexto

Recebimentos comerciais e pagamentos de obrigações fiscais têm direções, favorecidos e ciclos de vida diferentes. Reutilizar a tabela de recebimentos ocultaria essa distinção e dificultaria conciliação, auditoria e evolução contábil.

## Decisão

Pagamentos fiscais são registrados em `financial_payments`, vinculados simultaneamente ao título a pagar e à obrigação fiscal. O serviço aceita somente títulos de saída originados por `TAX_OBLIGATION_PAYABLE`.

Cada pagamento pode ser parcial ou total. Na mesma transação, o sistema grava o movimento, atualiza o título e a obrigação para `PARTIALLY_SETTLED` ou `SETTLED`, e persiste auditoria e outbox. O estorno não apaga o pagamento: registra autor, instante e motivo, recalcula o saldo ativo e recompõe os status.

O caixa realizado é a soma dos recebimentos ativos menos a soma dos pagamentos ativos. Referências bancárias são únicas por tenant no respectivo livro.

## Consequências

- recebimentos e pagamentos permanecem semanticamente separados;
- obrigação, título e caixa não podem divergir por falha parcial;
- todos os dados continuam protegidos por RLS e chaves compostas pelo tenant;
- esta decisão não afirma conciliação com extrato nem contabilização; essas integrações são fatos posteriores.
