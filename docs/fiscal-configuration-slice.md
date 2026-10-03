# Fatia vertical — configuração fiscal versionada

## Resultado funcional

O workspace fiscal permite cadastrar e editar estabelecimentos, criar configurações em rascunho, informar CFOP, vigência, estratégia de emissão, responsável técnico e tratamentos tributários, ativar uma versão completa e criar sua sucessora sem reescrever o histórico.

## Regras preservadas

- dados sempre isolados por tenant;
- valores percentuais atravessam a API como strings decimais;
- configurações ativas e encerradas são imutáveis;
- ativação incompleta ou com vigência sobreposta é rejeitada;
- seed demonstrativo contém somente um rascunho incompleto, sem alíquotas inventadas;
- auditoria e outbox são gravadas na mesma transação da alteração;
- cálculo, obrigação tributária, retenção efetiva, emissão e contabilização continuam fora desta fatia.

## Próxima extensão

O motor tributário deverá selecionar uma versão ativa pela data e pelo contexto da operação, calcular cada componente com Decimal, registrar base, alíquota, tratamento, arredondamento, versão e memória de cálculo, e falhar de forma explícita quando não houver correspondência única.
