# Cenários de validação V01–V05

Preparado em 09/10/2026. Os números abaixo são deliberadamente sintéticos e servem apenas para testar comportamento, memória e aprovação. Eles não representam tolerância, contrato ou regra tributária oficial.

## Regras comuns de execução

- cada cenário usa tenant de teste e referências identificadas com prefixo `VAL`;
- nenhuma divergência cria ajuste financeiro automático sem política aprovada;
- toda decisão humana registra ator, data, motivo e evidência;
- valores exibidos devem permitir navegação até contrato, carga, documento, título e movimento de origem;
- o resultado esperado distingue cálculo possível de regra homologada.

## VAL-01 — Peso de destino maior

Entrada sintética:

| Campo | Valor |
| --- | ---: |
| Peso expedido | 40.500 kg |
| Peso aceito no destino | 40.700 kg |
| Diferença física | +200 kg |
| Preço de venda usado no ensaio | R$ 1,50/kg |
| Efeito monetário candidato | +R$ 300,00 |

Resultado esperado antes de V02:

- registrar os dois pesos e calcular `+200 kg`;
- manter o efeito de `R$ 300,00` como simulação, não como recebível oficial;
- exigir escolha da base contratual e aprovador antes de ajustar nota ou título;
- preservar a quantidade expedida no livro de estoque.

Gate após V02: a política aprovada determina se o peso de destino gera receita adicional, ajuste documental ou apenas ocorrência.

## VAL-02 — Peso de destino menor

Entrada sintética:

| Campo | Valor |
| --- | ---: |
| Peso expedido | 40.500 kg |
| Peso aceito no destino | 40.300 kg |
| Diferença física | −200 kg |
| Preço de venda usado no ensaio | R$ 1,50/kg |
| Efeito monetário candidato | −R$ 300,00 |

Resultado esperado antes de V02:

- registrar a divergência sem apagar o movimento de expedição;
- abrir ocorrência quando a política contratual exigir;
- não reduzir automaticamente estoque, nota ou título;
- permitir evidência de balança, ticket e decisão humana.

Gate após V02: a perda física, o ajuste de venda e a alçada ficam reproduzíveis na memória.

## VAL-03 — Desconto de qualidade

Entrada sintética:

| Campo | Valor |
| --- | ---: |
| Valor bruto da compra | R$ 40.000,00 |
| Limite contratual candidato | 10% de avariados |
| Resultado do laudo | 20% de avariados |
| Excesso | 10 p.p. |
| Fórmula candidata do ensaio | 1 p.p. excedente = 1% de desconto |
| Desconto candidato | R$ 4.000,00 |

Resultado esperado antes de V03:

- apresentar `R$ 4.000,00` somente como simulação identificada;
- anexar laudo e cláusula/tabela de referência;
- exigir confirmação da fórmula, arredondamento e alçada;
- quando aprovado, reduzir o título de compra por componente versionado, sem alterar silenciosamente o peso físico.

Gate após V03: o mesmo laudo reproduz o desconto, o ajuste do título e a margem operacional, com contraprova e estorno possíveis.

Execução técnica em 09/10/2026: **concluída como ensaio sintético**. A memória confirmou R$ 4.000,00 e saldo de R$ 36.000,00; o componente manual integrado reduziu o título no mesmo valor sem alterar o estoque. A fórmula não foi promovida a regra oficial.

## VAL-04 — Retenção fiscal parametrizada

Entrada sintética:

| Campo | Valor |
| --- | ---: |
| Valor bruto | R$ 100.000,00 |
| Componente de teste A | 1,00% |
| Componente de teste B | 0,20% |
| Total sintético | R$ 1.200,00 |
| Líquido candidato | R$ 98.800,00 |

Os componentes devem ser cadastrados como `TRIBUTO_TESTE_A` e `TRIBUTO_TESTE_B`, sem nomes de tributos reais.

Resultado esperado:

- cálculo imutável preserva base, taxa, precisão, arredondamento e versão;
- aceite explícito separa redução do título comercial de obrigação fiscal;
- pagamento ao fornecedor não marca a obrigação fiscal como recolhida;
- nenhuma configuração de teste fica disponível como regra de produção.

Gate após D05/V01: substituir componentes sintéticos por matriz oficialmente homologada e repetir o cenário.

Execução técnica em 09/10/2026: **concluída em catálogo isolado de teste**. `TRIBUTO_TESTE_A` resultou em R$ 1.000,00, `TRIBUTO_TESTE_B` em R$ 200,00, com total de R$ 1.200,00 e líquido de R$ 98.800,00. Nenhum item foi persistido no catálogo operacional.

## VAL-05 — Ticket de descarga pendente

Entrada sintética:

- expedição confirmada e nota de saída vinculada;
- sacado configurado para exigir ticket de descarga e submissão ao portal;
- ticket ausente após o prazo operacional;
- título a receber existente.

Resultado esperado antes de V04:

- o recebível não é apagado;
- a entrega permanece documentalmente pendente;
- a fila informa responsável, prazo, sacado, terminal e impacto potencial;
- encerramento operacional ou antecipação só é bloqueado se a política configurada exigir;
- inclusão, submissão, aceite, rejeição ou dispensa do ticket ficam auditados.

Gate após V04: a matriz do sacado determina o bloqueio e o cenário chega a `ACEITO` ou `DISPENSADO` com evidência.

Execução técnica em 09/10/2026: **workflow manual concluído**. Política versionada por sacado/terminal é materializada na expedição e a fila registra responsável, prazo, portal, evidência, protocolo e situação. O ensaio chegou a `SUBMITTED`; consequências potenciais permanecem visíveis, porém não aplicadas, até V04.

## Matriz de execução

| Cenário | Automatizável agora | Depende de decisão | Evidência humana |
| --- | --- | --- | --- |
| VAL-01 | cálculo da diferença | V02 | ticket/pesagens e aceite |
| VAL-02 | cálculo da diferença | V02 | ticket/pesagens e ocorrência |
| VAL-03 | concluído com números exatos, componente manual e preservação do físico | V03 para fórmula real | laudo, tabela e aprovador |
| VAL-04 | concluído no catálogo isolado; motor integrado já cobre aceite, obrigação e título | D05 para regra real | matriz fiscal homologada |
| VAL-05 | workflow manual por sacado/terminal concluído até `SUBMITTED` | V04 para ativar bloqueio | comprovante e aceite do portal |

## Critério de encerramento do pacote

O pacote termina quando os cinco cenários são executados com dados de teste, cada bloqueio por decisão aparece explicitamente, as memórias são reproduzíveis e nenhum número sintético pode ser confundido com regra oficial de produção.
