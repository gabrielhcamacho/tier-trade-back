# Fatia vertical — configuração fiscal versionada

## Resultado funcional

O workspace fiscal permite cadastrar e editar estabelecimentos, criar configurações em rascunho, informar CFOP, vigência, estratégia de emissão, responsável técnico, base, tratamentos e política de arredondamento, ativar uma versão completa e criar sua sucessora sem reescrever o histórico.

## Regras preservadas

- dados sempre isolados por tenant;
- valores percentuais atravessam a API como strings decimais;
- configurações ativas e encerradas são imutáveis;
- ativação incompleta ou com vigência sobreposta é rejeitada;
- seed demonstrativo contém somente um rascunho incompleto, sem alíquotas inventadas;
- auditoria e outbox são gravadas na mesma transação da alteração;
- o cálculo só aceita versões com base e arredondamento explícitos; obrigação tributária, efeito financeiro, emissão e contabilização continuam em fatias posteriores.

## Extensão entregue

O motor seleciona uma versão ativa pela data e pelo contexto da operação, calcula cada componente com Decimal, registra base, alíquota, tratamento, valor antes e depois do arredondamento, versão e memória completa, e falha explicitamente quando não há correspondência única.
