# ADR 0010 — Previsão, título e baixa como fatos financeiros separados

## Status

Aceita.

## Contexto

A expedição de uma venda altera a previsão financeira, mas não comprova sozinha faturamento nem recebimento. Os documentos do produto exigem vínculo entre contrato, execução, documento, título e banco, além de memória reproduzível e estornos sem apagar histórico. Regras fiscais e de arredondamento do piloto ainda aguardam homologação.

## Decisão

- `financial_events` é o registro canônico da previsão gerada por uma expedição de venda.
- `financial_titles` representa o direito a receber e exige referência documental e vencimento informados pelo usuário.
- `financial_settlements` registra baixas parciais ou totais; estorno marca o fato original e exige motivo.
- A expedição e a previsão são gravadas na mesma transação. Título e baixa são transações posteriores, cada uma com auditoria e outbox.
- O valor bruto da previsão preserva quantidade, preço, fórmula, versão e valor bruto com nove casas. Só existe valor monetário oficial quando o produto já resulta em centavos exatos.
- Se houver fração de centavo, o evento fica `PENDING_ROUNDING_POLICY` e a emissão do título é bloqueada. Nenhum modo de arredondamento é presumido.
- `payment_term_days` é um termo contratual opcional e configurado pelo usuário. Sem ele, a previsão não inventa vencimento.
- Esta fatia não calcula tributos, retenções, descontos, juros, multa nem lançamento contábil.
- Todas as tabelas usam chave composta por tenant, RLS forçada, `numeric` para valores e `timestamptz` para instantes.

## Consequências

A demonstração já permite alterar vendas, expedir, emitir título, receber parcialmente e estornar usando dados persistidos. O futuro módulo fiscal poderá confirmar componentes e gerar ajustes versionados sem reescrever a expedição ou a baixa. A política de arredondamento continua uma decisão explícita do piloto.
