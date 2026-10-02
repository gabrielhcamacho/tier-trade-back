# ADR 0009 — Execução de venda separada do contrato de compra

## Status

Aceita.

## Contexto

Os contratos existentes são ativados a partir de ofertas de compra e carregam preço de compra, recebimentos e obrigações dessa ponta. A próxima fatia exige demanda/contrato de venda, alocação de estoque e expedição. Tratar o contrato de compra como venda misturaria contrapartes, saldos e fatos econômicos diferentes.

## Decisão

- `sales_contracts` representa o compromisso de venda e mantém contraparte, produto, volume, preço, destino, janela e documentos exigidos.
- `inventory_allocations` reserva quantidade de um lote para um contrato de venda sem alterar o saldo físico.
- `inventory_dispatches` registra saídas parciais contra uma alocação.
- Cada expedição cria um movimento imutável `DISPATCH` negativo no livro de estoque, na mesma transação.
- Disponível = saldo físico − saldo ainda comprometido em alocações ativas.
- Contratado, alocado e expedido permanecem separados; nenhuma regra fiscal, de faturamento ou liquidação é inferida.
- Todos os registros usam chaves compostas por tenant, RLS forçada, decimais PostgreSQL e datas com offset.

## Consequências

Compra e venda podem evoluir sem ambiguidade, expedições parciais atualizam estoque e execução de venda atomicamente e o demo continua editável com dados persistidos. Faturamento, títulos e liquidação serão ligados a esses fatos numa fatia financeira posterior.
