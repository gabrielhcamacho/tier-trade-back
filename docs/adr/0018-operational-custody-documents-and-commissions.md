# ADR 0018 — Custódia operacional, documentos privados e comissões versionadas

## Status

Aceita em 2026-10-05.

## Decisão

O saldo físico continua derivado exclusivamente do livro de movimentos. Titularidade, risco e custódia são estados explícitos do lote; remaneios possuem início e conclusão; perdas e inventários físicos geram eventos e, quando necessário, movimentos compensatórios. Nenhum ajuste pode reduzir o físico abaixo das alocações ativas.

Arquivos ficam em bucket privado `tier-trade-documents` no Supabase de produção. A API valida membership, tenant, agregado, tipo, tamanho e MIME antes de emitir URL temporária de upload ou download. O banco guarda metadados, versão e estado de assinatura; a chave secreta nunca é enviada ao navegador.

Comissões usam políticas por tenant, código e versão. A primeira base executável é o valor de um evento financeiro pronto. Se o cálculo gerar fração de centavo, a apropriação é bloqueada até existir política explícita de arredondamento.

## Consequências

- operações físicas permanecem rastreáveis sem editar saldo diretamente;
- documentos de tenants diferentes usam prefixos separados e autorização pela API;
- integrações futuras de assinatura podem preencher o mesmo registro sem trocar o modelo;
- valores históricos da planilha da JD não viram regra automaticamente.
