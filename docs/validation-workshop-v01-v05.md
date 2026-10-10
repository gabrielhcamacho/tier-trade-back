# Workshop de decisões V01–V05

Preparado em 09/10/2026 a partir da validação do Tier Trade com diretor de trading. Este documento organiza decisões de negócio; ele não homologa alíquotas, tolerâncias ou fórmulas por ausência de resposta.

## Objetivo e resultado esperado

Fechar, em uma reunião de 60 a 90 minutos, o vocabulário financeiro, a unidade de conciliação, o tratamento de qualidade, os requisitos documentais por sacado e a ordem de avaliação dos portais externos. A saída é um registro aprovado por função, acompanhado de exemplos reais anonimizados.

Participantes mínimos:

- direção ou responsável pelo resultado da trading;
- responsável fiscal;
- responsável financeiro/contas a receber;
- responsável por logística;
- produto Tier Trade;
- qualidade e jurídico/comercial quando V03 for decidido.

Materiais solicitados antes da reunião:

- uma operação encerrada com compra, venda, cargas, notas, pesos, custos e baixas;
- um laudo com desconto de qualidade e a cláusula/tabela que o autorizou;
- um caso com peso de destino maior e outro menor que o peso de origem;
- um ticket de descarga e evidência de submissão a portal;
- relação inicial de sacados/terminais e seus portais;
- matriz fiscal vigente ou contato do responsável que possa homologá-la.

## Agenda sugerida

| Tempo | Bloco | Decisão |
| --- | --- | --- |
| 0–10 min | Operação exemplo | Escolher a carga usada como referência comum. |
| 10–25 min | V01 | Aprovar nomes, fórmulas e estados dos indicadores. |
| 25–40 min | V02 | Aprovar como origem e destino são pareados e medidos. |
| 40–55 min | V03 | Aprovar natureza e efeito do desconto de qualidade. |
| 55–70 min | V04 | Aprovar requisitos, prazos e consequências por sacado. |
| 70–80 min | V05 | Priorizar portais e responsável pelo levantamento técnico. |
| 80–90 min | Fechamento | Registrar responsáveis, exemplos e prazos. |

## V01 — Vocabulário financeiro e gerencial

### Estado atual verificado

- margem projetada = referência de venda menos preço de compra menos custos projetados, por saca;
- margem realizada atual = receita de expedições menos custo de aquisição rateado e componentes financeiros da compra;
- a visão geral já separa valores a receber, a pagar, recebidos, pagos e fluxo líquido realizado;
- saldo bancário inicial e movimentos não titulados ainda não compõem uma projeção completa de caixa;
- margem realizada atual não é resultado contábil nem margem líquida.

### Proposta para aprovação

| Nome apresentado | Definição recomendada | Estado |
| --- | --- | --- |
| Receita expedida | Valor das expedições de venda com cálculo financeiro pronto; não significa faturado nem recebido. | Proposta |
| A receber | Saldo aberto dos títulos de entrada de caixa. | Proposta |
| Recebido | Soma das baixas não estornadas dos títulos de entrada. | Proposta |
| A pagar | Saldo aberto dos títulos de saída de caixa. | Proposta |
| Pago | Soma das baixas não estornadas dos títulos de saída. | Proposta |
| Fluxo líquido realizado | Recebido menos pago no período; não é saldo bancário. | Proposta |
| Margem projetada | Venda de referência menos compra e custos previstos, multiplicada pela quantidade contratada. | Proposta |
| Margem operacional realizada | Receita expedida menos aquisição apropriada e custos/ajustes realizados incluídos na memória. Deve listar inclusões e exclusões. | Proposta |
| Margem líquida contábil | Resultado após política contábil, apropriações, tributos, despesas e fechamento. Indisponível até D07. | Restrição atual |

Decisões a registrar:

1. Aprovar ou alterar cada nome acima.
2. Definir o período padrão: competência, emissão, vencimento, baixa ou data operacional.
3. Definir se tributos, frete, comissão e despesas administrativas entram na margem operacional e em qual momento.
4. Definir quem pode aprovar uma reclassificação de custo.
5. Definir quais KPIs precisam de visão por carga, contrato, contraparte, commodity e período.

Saída mínima: glossário aprovado, exemplo numérico e lista de componentes incluídos/excluídos.

## V02 — Conciliação por carga

### Estado atual verificado

O modelo já liga recebimento aceito a lote, lote a alocação e alocação a expedição. A expedição registra quantidade expedida, placa e referência documental, mas ainda não há fato específico para peso aceito no destino e ticket de descarga. Isso impede explicar integralmente a diferença origem–destino.

### Proposta para aprovação

- usar uma linha atômica de conciliação por `lote de origem + alocação + expedição`;
- preservar agregações muitas-para-muitas, sem forçar uma carga de compra a uma única venda;
- manter separadas as seguintes grandezas:
  - peso documental da compra;
  - peso aceito no recebimento/origem;
  - peso expedido;
  - peso descarregado/aceito no destino;
  - peso usado na nota de venda;
- diferença física de entrega = peso aceito no destino menos peso expedido;
- diferença econômica = valor reconhecido no destino menos valor apropriado da origem e demais componentes aplicáveis;
- tolerância é contratual por operação/cliente/terminal; não existe constante legal global no produto.

Decisões a registrar:

1. Qual peso gera a conta a pagar da compra?
2. Qual peso gera a conta a receber da venda?
3. Quando a diferença vira ganho/perda de estoque, ajuste de nota ou ocorrência?
4. Como tratar mistura de lotes, transbordo, consolidação e fracionamento?
5. Quem aceita a diferença fora da tolerância e qual evidência é obrigatória?

Saída mínima: dois exemplos reconciliados — diferença positiva e negativa — e regra de aprovação.

## V03 — Qualidade e desconto contratual

### Proposta para aprovação

- regra versionada por commodity, contrato e vigência;
- indicador, unidade, limite, tolerância, faixa, fórmula, ordem dos cálculos, precisão e arredondamento explícitos;
- laudo, contraprova, responsável e alçada de exceção obrigatórios;
- desconto monetário ajusta primeiro a obrigação/título da compra;
- estoque físico permanece baseado no peso efetivamente aceito, salvo regra contratual distinta de equivalência física;
- a relação `1 p.p. excedente = 1% de desconto` permanece apenas como cenário até homologação.

Decisões a registrar:

1. Quais indicadores se aplicam a milho e soja?
2. Quais regras são cumulativas e em qual ordem?
3. O desconto incide sobre valor bruto, preço unitário, peso equivalente ou combinação?
4. Contraprova suspende pagamento, estoque, ambos ou nenhum?
5. Quem aprova exceção e qual é o limite da alçada?

Saída mínima: tabela homologada e um cálculo reproduzível do laudo ao título.

## V04 — Requisitos por sacado e terminal

### Proposta para aprovação

Criar um modelo por sacado/terminal com:

- evento exigido: descarga, ticket, aceite, agendamento ou outro;
- documento obrigatório e tipo de evidência;
- prazo e responsável;
- portal e etapa de submissão;
- estados `PENDENTE`, `EVIDÊNCIA_RECEBIDA`, `SUBMETIDO`, `ACEITO`, `REJEITADO` e `DISPENSADO`;
- consequência: alerta, bloqueio de encerramento operacional, risco de recebimento ou bloqueio de antecipação;
- data prevista de pagamento afetada e motivo;
- histórico e comprovante da ação manual.

Recomendação inicial: a falta do ticket não apaga o recebível. Ela mantém a entrega documentalmente pendente, sinaliza risco de pagamento e bloqueia o encerramento operacional ou a antecipação quando a política exigir.

Decisões a registrar:

1. Quais requisitos valem para cada sacado e terminal?
2. Qual evento inicia o prazo?
3. A pendência bloqueia faturamento, cobrança, antecipação ou apenas alerta?
4. Quem pode dispensar requisito e com qual justificativa?
5. Como comprovar que o documento foi aceito no portal externo?

Saída mínima: matriz de ao menos três sacados e um terminal.

## V05 — Portais externos prioritários

### Critério de priorização proposto

Pontuar cada portal de 0 a 3 em:

- volume mensal de cargas;
- horas manuais gastas;
- impacto financeiro do atraso;
- frequência de erro/retrabalho;
- existência de API ou integração autorizada;
- estabilidade de acesso e documentação;
- disponibilidade de ambiente de teste e suporte.

O backlog de integração só recebe um portal após registrar proprietário, acesso autorizado, fluxo manual homologado, retorno esperado e estratégia de contingência. Automação por navegação de tela não será presumida como solução permanente.

Saída mínima: lista priorizada com Rumo, Origem, CTA, Cutrale e outros portais efetivamente usados, indicando responsável pelo contato técnico.

## Registro da decisão

| ID | Estado | Responsável por aprovar | Evidência exigida | Prazo | Observação |
| --- | --- | --- | --- | --- | --- |
| V01 | Em preparação | Direção + financeiro + contabilidade | Glossário e exemplo numérico | A definir | Recomendação preenchida acima. |
| V02 | Em preparação | Operações + fiscal + financeiro | Dois casos origem–destino | A definir | Falta fato de peso aceito no destino. |
| V03 | Em preparação | Qualidade + comercial + fiscal/jurídico | Tabela e laudo reproduzível | A definir | Não usar regra universal. |
| V04 | Em preparação | Logística + contas a receber + crédito | Matriz de sacados/terminais | A definir | Reutilizar obrigações/documentos onde couber. |
| V05 | Em preparação | Logística + TI + produto | Inventário e ranking de portais | A definir | Integração posterior ao fluxo manual. |

Uma decisão só muda para `APROVADA` quando houver aprovador identificado, evidência anexada, data e exemplo aceito. Silêncio ou uso histórico não constitui homologação.
