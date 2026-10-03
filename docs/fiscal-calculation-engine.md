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

## Aceite e efeitos

A memória calculada não altera o financeiro. No aceite, o usuário informa autoridade, competência, vencimento, responsável pelo recolhimento e eventual efeito sobre o título de origem para cada componente positivo. O fluxo cria obrigações, ajustes e títulos fiscais atomicamente e preserva idempotência.

## Limites deliberados

A única base disponível nesta etapa é `DOCUMENT_TOTAL`, escolhida explicitamente na configuração. O motor não contém CFOP, alíquota ou interpretação fiscal predefinida. Pagamento/baixa de obrigações e contabilização permanecem para fatias posteriores.

## Verificação

Os testes cobrem cálculo decimal, modos de arredondamento, seleção por contexto, ausência de regra, idempotência, aceite, obrigação, ajuste do título, título fiscal separado e persistência sob RLS.
