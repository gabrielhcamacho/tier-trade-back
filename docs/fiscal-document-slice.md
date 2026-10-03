# Fatia vertical — registro e validação fiscal

## Entrega funcional

1. A expedição gera o evento financeiro canônico.
2. O operador registra ou corrige uma NF-e de saída para esse evento.
3. A validação confere chave de acesso e valor contra o evento financeiro.
4. Quando válido, o documento é ligado ao título correspondente; rejeição ou correção desfaz o vínculo sem apagar histórico.
5. A interface exibe a cadeia completa e os estados `RECEIVED`, `VALIDATED` e `REJECTED`.

## Limite deliberado

Não há cálculo fiscal nesta fatia. O backend retorna `BLOCKED_CONFIGURATION` enquanto não houver uma configuração fiscal ativa e `BLOCKED_ENGINE` depois da ativação, até que o motor tributário e sua memória de cálculo sejam implementados.

## Garantias

- valores monetários são `numeric(20,2)` e `Decimal`, nunca `number` para cálculo;
- datas de emissão são instantes com fuso explícito;
- RLS é habilitada e forçada na tabela fiscal;
- capability `FISCAL_EDIT` protege criação, correção, validação e rejeição;
- auditoria e outbox são atômicas com a mudança;
- o reset demo v8 restaura uma NF-e fictícia editável, um estabelecimento e um rascunho fiscal sem alíquotas inventadas.
