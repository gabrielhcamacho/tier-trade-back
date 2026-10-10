# Qualidade e descontos de classificação

**Objetivo:** definir as regras necessárias para que a classificação de soja e milho produza peso comercial, desconto e decisão de aceite reproduzíveis, com efeito correto em saldo contratual, estoque, nota fiscal, liquidação e margem.
**Relação com os demais documentos:** complementa o Escopo de Negócio 1.1 (itens 14.2, 16 e 29), o Plano de Fases 1.2 (Fase 2) e o Catálogo 1.0 (cenário P07). O repositório registra a decisão D03 como bloqueada por falta deste conteúdo.
**Status:** proposta de regras e lista de decisões. Limites e percentuais são referências de prática de mercado e normas de classificação do MAPA, não parâmetros homologados.
**Data:** 8 de outubro de 2026.

---

## 1. Por que este tema merece documento próprio

A classificação é o ponto em que o contrato encontra a realidade física. É nela que nasce a diferença entre o peso que entrou na balança e o peso que será pago, e é nela que ocorre a maior parte das disputas entre trading e produtor. O Escopo 1.1 lista os parâmetros (umidade, impureza, avariados, ardidos, quebrados) e diz que limites, descontos e bonificações são "configuráveis por padrão versionado". Nenhum documento define:

- qual é o método de desconto de cada parâmetro (peso ou preço);
- em que ordem os descontos são aplicados;
- qual peso consome o saldo do contrato, entra no estoque e vai para a nota fiscal;
- quando a carga é rejeitada em vez de descontada;
- como funciona a contraprova e qual laudo prevalece;
- quem paga a secagem e o que acontece com a quebra.

O código já implementa "desconto de qualidade explícito" como componente da liquidação. Sem as regras acima, cada tenant vai parametrizar de um jeito e a conciliação com a planilha da trading piloto vai divergir carga a carga.

---

## 2. Conceitos que precisam de definição única

| Termo | Definição proposta | Uso |
|---|---|---|
| Peso bruto | Peso do veículo carregado na balança de entrada | Ticket |
| Tara | Peso do veículo vazio na balança de saída | Ticket |
| Peso líquido físico | Peso bruto menos tara | Romaneio, estoque físico |
| Desconto de peso | Quilogramas deduzidos por umidade e impureza acima da base | Classificação |
| Peso líquido comercial | Peso líquido físico menos descontos de peso | Saldo contratual, NF-e, liquidação |
| Desconto de preço | Percentual ou valor por unidade deduzido do preço por parâmetro qualitativo | Liquidação |
| Peso seco | Peso após secagem, quando a trading seca o grão | Estoque após secagem |
| Quebra de secagem | Diferença entre peso líquido físico e peso seco | Estoque, custo |
| Base | Valor do parâmetro até o qual não há desconto | Tabela |
| Limite de recebimento | Valor acima do qual a carga é rejeitada ou exige aprovação | Tabela |

A distinção entre peso líquido físico e peso líquido comercial é a decisão mais importante do documento. Ela determina o que entra no estoque (físico) e o que é pago e faturado (comercial), e explica por que estoque e saldo contratual nunca batem exatamente.

---

## 3. Parâmetros por commodity

### 3.1 Soja

Referência: padrões oficiais de classificação do MAPA e prática comercial. Valores a confirmar com a trading piloto.

| Parâmetro | Base usual | Limite usual de recebimento | Método usual | Observação |
|---|---|---|---|---|
| Umidade | 14,0% | 18% a 20% | Desconto de peso mais taxa de secagem | Acima do limite, só com secagem própria e aprovação |
| Impurezas e matérias estranhas | 1,0% | 3% a 5% | Desconto de peso | Alguns compradores descontam ponto a ponto, outros só o excedente |
| Avariados (total) | 8,0% | 15% a 20% | Desconto de preço | Soma de ardidos, queimados, mofados, fermentados, germinados, imaturos, chochos |
| Ardidos e queimados | 4,0% | 6% a 8% | Desconto de preço, mais severo | Queimados costumam ter sublimite de 1% |
| Mofados | 6,0% | 8% a 10% | Desconto de preço | |
| Esverdeados | 8,0% | 15% | Desconto de preço | Relevante em safra com colheita antecipada |
| Partidos, quebrados, amassados | 30,0% | Sem limite usual | Desconto de preço leve ou tolerado | |
| Transgenia | Conforme contrato | Rejeição quando contrato exige convencional | Teste de fita | Só se o contrato segregar |

### 3.2 Milho

| Parâmetro | Base usual | Limite usual de recebimento | Método usual | Observação |
|---|---|---|---|---|
| Umidade | 14,0% | 18% a 22% | Desconto de peso mais taxa de secagem | Milho chega mais úmido que soja; secagem é rotina |
| Impurezas e matérias estranhas | 1,0% | 3% a 5% | Desconto de peso | |
| Ardidos e queimados | 2,0% a 3,0% | 6% a 8% | Desconto de preço | |
| Avariados (total) | 6,0% | 10% a 15% | Desconto de preço | Inclui mofados, fermentados, germinados, chochos, gessados |
| Quebrados | 3,0% a 5,0% | Sem limite usual | Desconto de preço leve | |
| Carunchados | 2,0% a 3,0% | 5% a 8% | Desconto de preço | |
| Micotoxinas (aflatoxina) | Conforme destino | Rejeição acima do limite do comprador | Laudo laboratorial | Obrigatório quando o destino é alimentação ou exportação |

A tabela do sistema precisa ter, para cada parâmetro: unidade (percentual, ppb, presença), método de medição, base, limite de aprovação, limite de rejeição, método de desconto, tabela ou fórmula de desconto, vigência, commodity e padrão (nome da tabela). O contrato referencia um padrão; o padrão não é copiado para o contrato, mas a versão usada é congelada na assinatura.

---

## 4. Métodos de desconto

### 4.1 Desconto de peso por umidade

Fórmula padrão de mercado, que remove a água excedente:

```
desconto_kg = peso_líquido_físico × (umidade_medida − umidade_base) ÷ (100 − umidade_base)
```

Exemplo ilustrativo: 36.540 kg a 16,2% de umidade, base 14%:
36.540 × (16,2 − 14) ÷ (100 − 14) = 36.540 × 2,2 ÷ 86 = 934,7 kg.

Variante praticada por alguns compradores: tabela de percentual por faixa (por exemplo, 1,5% a cada ponto). As duas devem ser suportadas; a fórmula é configuração do padrão.

### 4.2 Desconto de peso por impureza

```
desconto_kg = peso_líquido_físico × (impureza_medida − impureza_base) ÷ 100
```

Decisão necessária: a base de cálculo é o peso líquido físico ou o peso já descontado da umidade? A ordem muda o resultado em dezenas de quilos por carga e em toneladas por contrato.

### 4.3 Desconto de preço por parâmetro qualitativo

Para avariados, ardidos, mofados, esverdeados, quebrados e carunchados, a prática é deduzir percentual do preço por ponto ou por faixa acima da base. Exemplo: avariados a 10% com base 8% e tabela de 1% de desconto por ponto resulta em 2% de desconto no preço da carga.

Duas formas de aplicar quando há mais de um parâmetro fora da base:

| Forma | Regra | Resultado |
|---|---|---|
| Aditiva | Soma dos percentuais de desconto aplicada uma vez sobre o preço | Mais simples; usual |
| Sequencial | Cada desconto aplicado sobre o preço já descontado pelo anterior | Menor desconto total; menos comum |

O padrão deve declarar a forma. A memória de cálculo mostra cada parcela.

### 4.4 Taxa de secagem

Quando a trading seca o grão, além do desconto de peso cobra-se uma taxa de secagem por ponto de umidade acima da base, em reais por tonelada ou por saca, ou em percentual do valor. É custo direto apropriado à carga e componente da liquidação. O contrato define se é descontada do produtor ou absorvida.

### 4.5 Ordem de aplicação proposta

1. Pesagem: peso líquido físico.
2. Desconto de peso por umidade.
3. Desconto de peso por impureza (base decidida no item 4.2).
4. Resultado: peso líquido comercial.
5. Preço base do contrato (após conversão de unidade e câmbio, conforme o documento de contratos).
6. Descontos de preço por parâmetros qualitativos (aditivos ou sequenciais).
7. Valor bruto da carga = peso líquido comercial × preço descontado.
8. Taxa de secagem e demais componentes de custo da liquidação.

Arredondamento: pesos em quilograma inteiro ou com uma casa, conforme a balança; percentuais de laudo com uma casa; valor final em centavos, uma única vez.

---

## 5. Aceite, aceite condicionado e rejeição

| Situação | Regra proposta | Decisão |
|---|---|---|
| Todos os parâmetros dentro da base | Aceite automático | Nenhuma |
| Parâmetro entre a base e o limite de aprovação | Aceite com desconto, automático | Nenhuma |
| Parâmetro entre o limite de aprovação e o de rejeição | Aceite condicionado: exige aprovação por alçada, com desconto calculado e cenário alternativo de rejeição | Quem aprova, por valor de desconto ou por parâmetro |
| Parâmetro acima do limite de rejeição | Rejeição, salvo exceção aprovada por alçada superior | Quem pode excepcionar |
| Rejeição por contaminante ou transgenia em contrato segregado | Rejeição sem exceção | Confirmar lista de parâmetros sem exceção |

O aceite condicionado precisa registrar o acordo com a contraparte: desconto negociado pode ser diferente do desconto da tabela. O sistema guarda o desconto de tabela, o desconto negociado, a diferença, quem aprovou e a evidência (mensagem, assinatura no romaneio). A diferença entre os dois é um componente de margem a ser explicado.

### 5.1 Rejeição no destino após viagem

Quando a carga foi carregada na origem com classificação prévia e é rejeitada no destino:

- a carga entra em estado "rejeitada no destino" e não movimenta estoque do destino;
- o sistema precisa de decisão: devolução à origem, redirecionamento para outro destino, ou aceite com desconto renegociado;
- cada decisão tem consequência documental (NF-e de devolução, nova NF-e de venda) e de frete (quem paga o retorno);
- o saldo contratual volta ao estado anterior ao carregamento.

Nenhum documento atual trata este caso, que é frequente em vendas para indústria.

---

## 6. Amostragem, laudo e contraprova

| Tema | Regra proposta | Decisão |
|---|---|---|
| Amostra | Amostra composta por calagem em pontos definidos, identificada por carga, lacrada, com data, hora e classificador | Procedimento do piloto |
| Laudo | Um laudo por carga, com todos os parâmetros do padrão, equipamento, método e classificador; versionado se corrigido | Nenhuma |
| Guarda da amostra | Prazo de guarda da amostra-testemunha para contraprova (prática: 24 a 72 horas) | Prazo |
| Contraprova | A contraparte pode pedir reclassificação dentro do prazo; nova análise por classificador ou laboratório definido; quem paga depende do resultado | Prazo, laboratório, regra de custo |
| Laudo que prevalece | Contrato define: classificação do destino, da origem, ou de laboratório arbitral | Regra padrão por tipo de contrato |
| Tolerância de divergência | Diferença entre laudos dentro de uma tolerância mantém o original | Tolerância por parâmetro |
| Estado da carga durante contraprova | Aceita provisoriamente, liquidação bloqueada; ou descarregada em lote segregado | Política do piloto |
| Reclassificação | Gera nova versão do laudo, recalcula desconto, peso comercial, saldo e liquidação; histórico preservado | Nenhuma |

Quando a classificação é feita por terceiro (armazém do comprador, terminal, classificadora credenciada), o laudo é documento externo vinculado à carga, e a regra de prevalência é a do contrato.

---

## 7. Efeitos da classificação nos demais domínios

| Domínio | Efeito | Regra que precisa existir |
|---|---|---|
| Saldo contratual | Consome o peso líquido comercial | Confirmar; algumas tradings consomem o físico |
| Estoque | Entra o peso líquido físico, ou o peso seco se houver secagem; a qualidade do lote é a do laudo | Qualidade de lote misturado por média ponderada |
| Quebra de secagem | Diferença entre físico e seco sai do estoque como perda técnica aprovada | Quem absorve; limite esperado por ponto de umidade |
| NF-e | Quantidade na nota é o peso líquido comercial; valor é o bruto da carga após descontos de preço | Validar com fiscal se o desconto de preço aparece como desconto na nota ou como preço unitário reduzido |
| Liquidação | Peso comercial, preço descontado, taxa de secagem como componentes separados | Já previsto no Catálogo; falta a ordem |
| Razão de custos | Secagem, classificação de terceiro e contraprova são componentes de custo da carga | Fonte e documento de cada um |
| Margem | Desconto de tabela versus negociado é explicação de variação | Componente "qualidade" na decomposição |
| Posição | Carga aceita reduz a posição a entregar pelo peso comercial | Nenhuma adicional |
| Expedição (venda) | A qualidade do lote expedido deve atender ao padrão do contrato de venda; o sistema alerta quando o lote está fora | Bloqueio ou alerta |

---

## 8. Bonificações

Menos comuns em soja e milho, mas previstas em alguns contratos: prêmio por umidade abaixo da base, por proteína ou por ausência de avariados. A estrutura é a mesma do desconto, com sinal invertido, e deve usar a mesma tabela e a mesma memória. Decisão: se o piloto pratica bonificação.

---

## 9. Estados da classificação

| Estado | Entrada | Saída |
|---|---|---|
| Amostrada | Amostra coletada e identificada | Laudo emitido |
| Classificada | Laudo emitido, desconto calculado | Aceite, aceite condicionado ou rejeição |
| Aceita | Dentro dos limites ou aprovada | Descarga, estoque, liquidação |
| Aceita condicionalmente | Aguardando aprovação de alçada ou acordo | Aceita ou rejeitada |
| Em contraprova | Pedido dentro do prazo | Confirmada ou reclassificada |
| Reclassificada | Nova versão do laudo | Aceita ou rejeitada |
| Rejeitada | Fora do limite ou decisão | Devolução, redirecionamento ou exceção |

Cada transição registra autor, evidência e versão da tabela de qualidade aplicada.

---

## 10. Cenários que precisam ter resultado esperado

| ID | Cenário | O que verifica |
|---|---|---|
| QC-01 | Soja a 14% umidade e 1% impureza, demais dentro da base | Aceite automático, peso comercial igual ao físico |
| QC-02 | Soja a 16,2% umidade, base 14% | Desconto de peso pela fórmula, peso comercial, memória |
| QC-03 | Milho a 17% umidade e 2,5% impureza | Ordem dos dois descontos de peso e base de cálculo do segundo |
| QC-04 | Soja com avariados 10% e ardidos 5% | Descontos de preço aditivos versus sequenciais |
| QC-05 | Milho a 19% com secagem própria | Desconto de peso, taxa de secagem, quebra de secagem no estoque |
| QC-06 | Parâmetro entre limite de aprovação e rejeição | Aceite condicionado, alçada, desconto negociado menor que o de tabela |
| QC-07 | Parâmetro acima do limite de rejeição | Rejeição, saldo preservado, sem movimento de estoque |
| QC-08 | Contraprova com resultado diferente dentro da tolerância | Laudo original mantido |
| QC-09 | Contraprova com resultado fora da tolerância | Reclassificação, recálculo, nova versão, liquidação ajustada |
| QC-10 | Carga rejeitada no destino após viagem | Devolução, NF-e de devolução, frete de retorno, saldo restaurado |
| QC-11 | Dois lotes com umidades diferentes misturados no mesmo silo | Qualidade do lote resultante por média ponderada |
| QC-12 | Expedição de lote fora do padrão do contrato de venda | Alerta ou bloqueio conforme política |
| QC-13 | Mesma carga classificada por tabela antiga e nova após mudança de vigência | Versão congelada na assinatura prevalece |

---

## 11. Decisões abertas para a trading piloto

| Decisão | Quem responde | Bloqueia |
|---|---|---|
| Tabela de bases, limites e descontos de soja e milho efetivamente praticada | Comercial e qualidade | Parametrização |
| Fórmula de umidade: padrão de mercado ou tabela por faixa | Qualidade | Motor de desconto |
| Base do desconto de impureza: peso físico ou já descontado da umidade | Qualidade e financeiro | Peso comercial |
| Descontos de preço aditivos ou sequenciais | Comercial | Liquidação |
| Taxa de secagem: valor, unidade, quem paga | Operações | Custo da carga |
| Peso que consome o saldo contratual: físico ou comercial | Comercial e contratos | Saldos |
| Como o desconto de preço aparece na NF-e | Fiscal | Emissão |
| Prazo de contraprova, laboratório, regra de custo e tolerância | Qualidade e jurídico | Estados |
| Qual laudo prevalece por tipo de contrato | Jurídico | Disputas |
| Lista de parâmetros que rejeitam sem exceção | Direção | Alçadas |
| Se há bonificação no piloto | Comercial | Tabela |
| Alçadas de aceite condicionado por valor de desconto | Direção | Workflow |

---

## 12. Recomendação de sequência

1. Receber a tabela real da trading piloto e mapeá-la na estrutura do item 3, sem promover nenhum valor a padrão do produto.
2. Fechar as três decisões de cálculo (fórmula de umidade, base da impureza, aditivo ou sequencial), porque mudam o resultado de toda carga.
3. Definir peso físico versus comercial em saldo, estoque e nota antes de qualquer teste de conciliação.
4. Escrever os treze cenários com números da trading e só então homologar o motor que já existe no código.
5. Liberar a decisão D03 do repositório.
