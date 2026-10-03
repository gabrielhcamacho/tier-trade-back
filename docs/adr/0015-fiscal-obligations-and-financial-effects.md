# ADR 0015 — obrigações fiscais e efeitos financeiros separados

## Contexto

O Catálogo do Piloto determina que uma retenção confirmada tenha duas consequências independentes: reduzir o valor devido à contraparte e criar uma obrigação fiscal. Pagar a contraparte não comprova recolhimento do tributo. O sistema também não pode inferir silenciosamente quem recolhe.

## Decisão

O cálculo permanece imutável e sem efeito até um aceite explícito. Para cada componente positivo, o usuário informa autoridade, competência, vencimento, efeito no título (`NONE` ou `REDUCE_SOURCE_TITLE`) e responsabilidade (`TENANT` ou `COUNTERPARTY`).

O módulo Fiscal é dono de autoridades e obrigações. Ele chama uma porta do módulo Financeiro dentro da mesma transação. Uma redução cria `financial_title_adjustments` e preserva o valor original do título. Quando o tenant recolhe, o Financeiro cria um evento de saída e um título a pagar cujo favorecido é a autoridade fiscal, nunca a contraparte comercial.

Aceite, obrigações, ajustes, título fiscal, auditoria e outbox são atômicos. `requestKey` torna o aceite idempotente e conteúdo divergente é rejeitado.

## Consequências

- pagamento à contraparte e recolhimento fiscal têm saldos e ciclos de vida distintos;
- cálculo manual pode criar obrigação, mas não reduzir título de origem;
- reduzir título exige cálculo ligado a evento financeiro com título existente e valor suficiente;
- a baixa de contas a pagar é definida pelo ADR 0016; lançamento contábil permanece em fatia posterior;
- tratamentos, alíquotas, responsabilidade e efeitos continuam dados confirmados pelo usuário, sem interpretação fiscal embutida.
