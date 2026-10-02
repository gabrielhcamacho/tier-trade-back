# Terceira vertical slice — recebimento, pesagem e qualidade

## Resultado funcional

Uma carga programada inicia o recebimento, registra peso bruto e tara, calcula o peso líquido no banco e captura a classificação. O operador decide aceitar ou manter a carga em revisão. Correções criam nova versão e preservam o histórico.

## Regras implementadas

- `gross_weight_kg`, `tare_weight_kg` e `net_weight_kg` são `numeric(20,3)`; o líquido é coluna gerada pelo PostgreSQL.
- Pesagem por balança exige número do ticket.
- Contingência manual exige justificativa entre 10 e 500 caracteres.
- Umidade, impurezas e avariados são registrados como percentuais, sem inferência de desconto.
- `ACCEPTED` conclui a carga como `RECEIVED`; `REVIEW_REQUIRED` mantém ou reabre como `IN_RECEIVING`.
- Cada correção desativa a versão vigente e insere outra, dentro da mesma transação e sob bloqueio da carga.
- Auditoria e outbox são gravadas atomicamente com a transição.
- Tabela, chaves, índices e RLS incluem `tenant_id`. O papel de runtime recebe somente `SELECT`, `INSERT` e `UPDATE` na tabela. O reset usa uma função `SECURITY DEFINER` restrita que confirma tenant demonstrativo, ator autorizado e contexto RLS antes de apagar os recebimentos canônicos; não existe endpoint HTTP de exclusão.

## Decisão adiada conscientemente

Desconto, bonificação e rejeição automática de qualidade não são calculados nesta slice. Os documentos do produto exigem padrões e tabelas versionados efetivamente usados pelos pilotos. Até essa homologação, a decisão é humana e os indicadores permanecem reproduzíveis e auditáveis.

## Próxima extensão

Criar lote e movimento de entrada de estoque a partir de `load.receipt_recorded` ou `load.receipt_corrected`, preservando titularidade, custódia, local e reconciliação quando uma carga recebida for corrigida.
