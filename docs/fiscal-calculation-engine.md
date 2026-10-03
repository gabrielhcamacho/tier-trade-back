# Fatia vertical — motor fiscal determinístico

## Resultado funcional

O usuário informa estabelecimento, commodity, destino, data do fato e valor bruto. A API seleciona a configuração ativa correspondente, calcula os componentes com precisão decimal e salva uma memória consultável no workspace fiscal.

## Seleção da regra

A seleção exige correspondência de tenant, estabelecimento ativo, operação `SALE_DISPATCH`, commodity, UF de destino e vigência inclusiva. Zero correspondências retorna `FISCAL_CONFIGURATION_NOT_APPLICABLE`; mais de uma retorna `FISCAL_CONFIGURATION_AMBIGUOUS`.

## Memória

Cada cálculo preserva:

- entrada normalizada e chave idempotente;
- configuração, chave estável e versão;
- base tributável e alíquota de cada componente;
- valor antes e depois do arredondamento;
- tratamento e indicação de retenção;
- total tributário, total retido, valor líquido, modo e escala de arredondamento;
- usuário e instante da execução.

## Limites deliberados

A única base disponível nesta etapa é `DOCUMENT_TOTAL`, escolhida explicitamente na configuração. O motor não contém CFOP, alíquota ou interpretação fiscal predefinida. Obrigações tributárias, ajuste de título, emissão e contabilidade são as próximas fatias.

## Verificação

Os testes cobrem cálculo decimal, diferença entre modos de arredondamento, seleção por contexto, ausência de regra, idempotência, conflito de chave e persistência da memória sob RLS.
