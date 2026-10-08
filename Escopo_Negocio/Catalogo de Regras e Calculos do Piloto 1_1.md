# Catálogo de Regras e Cálculos do Piloto 1.1

**Produto:** Tier Trade, ERP para tradings, cerealistas e armazenadores.
**Recorte:** soja e milho no mercado interno brasileiro. Primeiro piloto: JD, Mato Grosso, preço fixo, cenários JD-01 a JD-04.
**Status:** base para especificação, parametrização e homologação com a trading piloto e com os especialistas fiscal e contábil.
**Referências:** Visão Completa 1.2, Escopo de Negócio 1.1, Plano do MVP 1.2, Arquitetura de Multitenancy 1.1.
**Data:** 8 de outubro de 2026.

**O que muda em relação à versão 1.0.** A versão 1.0 definia princípios, a cadeia econômica, o razão de custos, comissões, retenções, conciliação, margem e eventos contábeis, com uma única fórmula numérica. A versão 1.1 mantém tudo isso e acrescenta: glossário com definições operacionais; regras de unidades, moedas, câmbio e fixação; regras de qualidade e desconto de classificação; regras de saldo e tolerância; regras de liquidação com ordem de cálculo; cessões, transferências e operações triangulares; estados que faltavam; cenários CM, QC e CT; e a consolidação das decisões abertas com os códigos D02 a D09 do repositório. Corrige os nomes FETAB e IAGRO para FETHAB e INDEA, conforme a UF do piloto. Toda regra passa a ter código e a seguir o formato do Anexo A.

**Convenção.** Valores numéricos marcados como *referência* são prática de mercado ou norma de classificação e não estão homologados. Valores marcados como *parâmetro* devem ser preenchidos pela trading piloto. Nenhum dos dois entra em produção sem aprovação registrada.

---

## Índice

1. Objetivo e fronteira
2. Glossário e definições operacionais
3. Princípios de cálculo
4. Contexto de aplicação das regras
5. Cadeia econômica do contrato
6. Unidades, moedas, câmbio e fixação
7. Saldos, tolerância e encerramento
8. Qualidade e descontos de classificação
9. Razão de custos por contrato
10. Liquidação e pagamento
11. Comissões
12. Tributos, retenções e obrigações
13. Cessões, transferências e operações triangulares
14. Conciliação ponta a ponta
15. Margem e resultado
16. Eventos contábeis
17. Estados e transições
18. Cenários obrigatórios do piloto
19. Critérios de homologação
20. Decisões abertas
Anexo A Estrutura mínima da regra
Anexo B Tabelas de referência

---

## 1. Objetivo e fronteira

O documento define como o MVP representa cálculos econômicos, físicos e fiscais do ciclo básico de uma trading. O foco é impedir que a operação dependa de controles externos para descobrir quanto pagar, quanto recolher, qual custo pertence ao contrato e qual margem foi realizada.

Inclui definições, modelos de dados conceituais, estados, fórmulas de referência, vínculos obrigatórios e cenários de teste. Não substitui parecer fiscal, parametrização por UF nem validação do contador. Não pressupõe que todo cliente abandone seus sistemas atuais no primeiro ciclo.

O código do repositório já implementa a maior parte dos motores descritos. Este catálogo é o documento contra o qual esses motores serão homologados; onde o código e o catálogo divergirem, a divergência precisa ser decidida e registrada, nunca resolvida em silêncio.

---

## 2. Glossário e definições operacionais

Termos usados em todo o catálogo. Uma definição vale para contrato, carga, estoque, nota, liquidação e contabilidade.

### 2.1 Pesos e quantidades

| Termo | Definição | Onde é usado |
|---|---|---|
| Peso bruto | Peso do veículo carregado na balança de entrada | Ticket |
| Tara | Peso do veículo vazio na balança de saída | Ticket |
| Peso líquido físico | Peso bruto menos tara | Romaneio, estoque físico, quebra de transporte |
| Desconto de peso | Quilogramas deduzidos por umidade e impureza acima da base | Classificação |
| Peso líquido comercial | Peso líquido físico menos descontos de peso | Saldo contratual, NF-e, liquidação, posição |
| Quantidade elegível | Peso líquido comercial da carga aceita, convertido para a unidade de preço | Liquidação |
| Peso seco | Peso após secagem própria | Estoque após secagem |
| Quebra de secagem | Peso líquido físico menos peso seco | Perda técnica |
| Quebra de transporte | Peso líquido físico na origem menos peso líquido físico no destino | Frete, reconciliação |
| Peso oficial | Peso que prevalece para pagamento quando origem e destino divergem; definido por contrato (*parâmetro*, padrão: destino) | Liquidação |
| Unidade canônica | Quilograma; toda quantidade é armazenada em quilogramas | Banco de dados |
| Unidade contratual | Unidade em que a quantidade foi negociada (saca, tonelada, quilo, bushel) | Contrato, apresentação |

### 2.2 Preço, moeda e câmbio

| Termo | Definição |
|---|---|
| Unidade de preço | Unidade sobre a qual o preço é expresso (por saca, por tonelada, por bushel); pode diferir da unidade contratual |
| Moeda de preço | Moeda em que o preço foi negociado (BRL, USD) |
| Moeda de liquidação | Moeda em que o pagamento ocorre; no MVP, BRL |
| Preço fixo | Valor por unidade de preço conhecido na assinatura |
| Preço a fixar | Preço definido depois da assinatura por referência de mercado mais prêmio |
| Referência | Mercado e contrato usados como base (CBOT, B3, indicador regional nomeado) |
| Prêmio ou base | Valor somado ou subtraído da referência, com moeda e unidade próprias |
| Fixação de preço | Evento que torna conhecido o preço de uma quantidade |
| Fixação de câmbio | Evento que torna conhecida a taxa de conversão de um valor em moeda estrangeira |
| Saca como denominação | Obrigação expressa em quantidade de produto, não em dinheiro; valor monetário só existe com referência de preço |

### 2.3 Saldos

| Termo | Definição | Evento que reduz | Evento que aumenta |
|---|---|---|---|
| Contratado | Quantidade acordada, em kg e em unidade contratual | Cancelamento parcial, washout, transferência de saldo | Aditivo de volume, transferência recebida |
| A fixar (preço) | Contratado menos fixado | Fixação de preço | Estorno de fixação |
| A fixar (câmbio) | Valor fixado em moeda estrangeira sem taxa | Fixação de câmbio | Estorno |
| Programado | Quantidade com carga confirmada | Carga cancelada ou concluída | Programação confirmada |
| Entregue e aceito | Peso líquido comercial das cargas aceitas | Rejeição posterior, estorno de recebimento | Recebimento aceito |
| Preço pendente | Entregue e aceito sem preço definitivo | Fixação ou alocação | Recebimento sem fixação disponível |
| Faturado | Quantidade com NF-e vinculada | Cancelamento de NF-e | Emissão de NF-e |
| Liquidado | Quantidade com liquidação aprovada | Estorno | Liquidação aprovada |
| Adiantamento em aberto | Valor ou sacas adiantados menos amortizado | Amortização por carga | Novo adiantamento |

### 2.4 Qualidade

| Termo | Definição |
|---|---|
| Base | Valor do parâmetro até o qual não há desconto |
| Limite de aprovação | Valor acima do qual o aceite exige alçada |
| Limite de rejeição | Valor acima do qual a carga é rejeitada, salvo exceção |
| Desconto de tabela | Desconto calculado pelo padrão de qualidade vigente |
| Desconto negociado | Desconto acordado com a contraparte em aceite condicionado |
| Padrão de qualidade | Tabela versionada de parâmetros, bases, limites e métodos, referenciada pelo contrato e congelada na assinatura |
| Laudo | Resultado da classificação de uma carga, versionado |
| Contraprova | Reclassificação solicitada pela contraparte dentro do prazo |

### 2.5 Financeiro, fiscal e contábil

| Termo | Definição |
|---|---|
| Valor bruto da carga | Quantidade elegível multiplicada pelo preço descontado por qualidade, mais bonificações |
| Componente de custo | Custo previsto ou realizado com natureza, origem, competência, documento, estado e critério de apropriação |
| Retenção | Valor deduzido do pagamento ao fornecedor e devido ao fisco pela trading |
| Obrigação tributária | Passivo com o fisco, por competência, código, jurisdição e vencimento |
| Título | Direito ou obrigação a receber ou pagar, vinculado ao contrato e à liquidação |
| Beneficiário | Quem recebe o pagamento; igual à contraparte do contrato, salvo cessão registrada |
| Competência | Data do fato que reconhece receita, custo ou despesa, independente do pagamento |
| Materialidade | Valor absoluto ou percentual abaixo do qual uma divergência não abre caso |
| Campo material | Campo do negócio cuja alteração invalida aprovação anterior; lista em 17.4 |

---

## 3. Princípios de cálculo

| Princípio | Regra |
|---|---|
| Determinismo | A mesma entrada, regra e versão produzem o mesmo resultado |
| Vigência | A data do fato seleciona a versão aplicável; alterações futuras não reescrevem o passado |
| Memória | Base, alíquota, fórmula, arredondamento, componentes, fontes e resultado permanecem consultáveis |
| Origem | Todo valor aponta para contrato, carga, documento, regra e evento que o criaram |
| Dupla consequência | Uma retenção reduz o pagamento ao fornecedor e cria obrigação separada com o fisco |
| Reprocessamento controlado | Correções geram nova versão, diferença e estorno; não apagam o cálculo anterior |
| Arredondamento único | Cálculos intermediários não arredondam; o arredondamento ocorre uma vez, no ponto definido pela regra, com modo e escala registrados |
| Unidade canônica | Quantidades são armazenadas em quilogramas; valores em decimal com escala explícita; nunca ponto flutuante |
| Saldo derivado | Nenhum saldo é editável; todo saldo é consequência de eventos |
| Parte vigente | Retenção, perfil fiscal e beneficiário usam a parte vigente na data do fato, não a parte da assinatura |
| IA sem autoridade fiscal | A IA prepara e explica; o motor determinístico calcula e o responsável aprova exceções |

---

## 4. Contexto de aplicação das regras

Uma regra não é escolhida apenas pelo nome do tributo ou do produto. O motor avalia o contexto completo e registra por que a regra foi aplicada ou descartada.

| Dimensão | Atributos mínimos |
|---|---|
| Organização | Tenant, grupo, empresa, estabelecimento, filial e centro de resultado |
| Geografia | UF e município de origem, destino, entrega e estabelecimento responsável |
| Mercadoria | Commodity, produto fiscal, NCM, safra, unidade, padrão de qualidade |
| Operação | Compra, venda, remessa, retorno, armazenagem, serviço, transferência, venda à ordem, devolução |
| Documento | Modelo, série, emissão própria ou de terceiro, CFOP e finalidade |
| Contraparte | Tipo, regime, inscrição, pessoa física ou jurídica, produtor rural, opção de recolhimento, parte vigente |
| Tempo | Data do fato, competência, vigência da regra, calendário de vencimento, fuso |
| Contrato | Modalidade, preço, moeda, unidade, responsabilidade por frete, retenções, condições, padrão de qualidade |

---

## 5. Cadeia econômica do contrato

Eixo de reconciliação do MVP. Cada etapa produz eventos e saldos consumidos pelas seguintes.

1. O contrato aprovado cria volume, preço (fixo ou a fixar), obrigações, orçamento de custos e margem projetada.
2. A programação e a carga confirmam execução física: pesos, qualidade, frete e documentos.
3. A classificação transforma peso físico em peso comercial e preço contratual em preço descontado.
4. A nota fiscal formaliza o fato documental e os componentes fiscais.
5. A liquidação calcula bruto, acréscimos, deduções, retenções, adiantamentos e líquido, na ordem definida em 10.2.
6. O título representa o direito ou obrigação a pagar ou receber, com beneficiário.
7. O movimento bancário baixa o título sem apagar diferenças ou pendências fiscais.
8. A retenção ou incidência gera obrigação tributária por competência e vencimento.
9. Os eventos contábeis reconhecem estoque, custo, receita, passivo, caixa e resultado.
10. O encerramento explica a margem realizada e as diferenças em relação ao plano.

---

## 6. Unidades, moedas, câmbio e fixação

### UN-01 Tabela de conversão de unidades

| Bloco | Conteúdo |
|---|---|
| Identidade | UN-01, conversão de unidades, tipo tabela, versão 1, responsável: produto |
| Vigência | Por commodity, com início e fim; fatos usam a versão vigente na data da assinatura do contrato |
| Aplicabilidade | Toda conversão entre kg, saca, tonelada e bushel |
| Entradas | Commodity, unidade de origem, unidade de destino, quantidade decimal |
| Cálculo | quantidade_destino = quantidade_origem × kg_por_unidade_origem ÷ kg_por_unidade_destino, sem arredondamento |
| Saídas | Quantidade na unidade de destino com precisão integral; fator usado registrado |
| Governança | Alteração de fator exige nova versão e aprovação; contratos existentes mantêm a versão congelada |
| Testes | Ida e volta sem perda; soja e milho com bushel distinto; vigência anterior e posterior |

Fatores de *referência* (Anexo B.1): saca 60 kg; tonelada 1.000 kg; bushel de soja 27,2155 kg; bushel de milho 25,4012 kg. *Parâmetro*: confirmar se a trading piloto usa saca diferente de 60 kg ou bushel em quantidade.

### UN-02 Armazenamento canônico

Toda quantidade é persistida em quilogramas com três casas decimais; a quantidade na unidade contratual é derivada e exibida. Diferenças de arredondamento entre as duas apresentações aparecem na memória, nunca em ajuste manual.

### PR-01 Estrutura do preço

| Bloco | Conteúdo |
|---|---|
| Identidade | PR-01, estrutura do preço contratual, tipo validação |
| Aplicabilidade | Todo contrato de compra e venda |
| Entradas | Valor (se fixo), moeda de preço, unidade de preço, modalidade (fixo, a fixar), referência, vencimento de referência, prêmio com moeda e unidade, moeda de liquidação |
| Cálculo | Validação de completude por modalidade: fixo exige valor; a fixar exige referência, vencimento, prêmio, quem fixa, janela, regra de não fixação, método de alocação (PR-04) |
| Saídas | Termo de preço versionado |
| Governança | Mudança de qualquer campo é aditivo com alçada |
| Testes | Cada combinação válida da tabela B.2; rejeição de combinações incompletas |

### PR-02 Fixação de preço

| Bloco | Conteúdo |
|---|---|
| Identidade | PR-02, fixação de preço, tipo evento e cálculo |
| Vigência | Regra do contrato; janela de fixação do contrato |
| Aplicabilidade | Contratos a fixar, total ou parcialmente |
| Entradas | Quantidade a fixar, valor da referência capturado (com fonte, data, hora), prêmio aplicável, fator UN-01 quando a referência está em unidade diferente da unidade de preço, autor, evidência |
| Cálculo | preço_fixado = referência_convertida + prêmio. Quando referência em cents por bushel e preço por saca: (referência ÷ 100) × bushels_por_saca + prêmio |
| Saídas | Fixação ativa com quantidade, preço, componentes; saldo a fixar reduzido; evento de auditoria |
| Governança | Quem fixa conforme contrato; fixação acima do saldo é rejeitada; estorno gera nova versão |
| Testes | Fixação parcial múltipla; fixação igual ao saldo; fixação acima do saldo; conversão bushel; estorno após liquidação (CM-12) |

### PR-03 Saldo a fixar vencido

Quando a janela de fixação encerra com saldo a fixar, aplica-se a consequência declarada no contrato: fixação automática pela referência de fechamento do último dia; prorrogação com custo; ou washout do saldo (CS-06). Sem consequência declarada, o contrato entra em "fixação vencida sem decisão" e bloqueia liquidação. *Parâmetro*: consequência padrão do tenant.

### PR-04 Ligação entre fixações e cargas

| Método | Regra | Efeito na liquidação |
|---|---|---|
| Preço médio ponderado | Todas as cargas liquidam pelo preço médio das fixações, recalculado a cada fixação | Cargas já liquidadas geram ajuste (título complementar ou dedução) |
| Fila | A primeira carga consome a primeira fixação, na ordem cronológica | Carga sem fixação disponível fica em "preço pendente" |
| Alocação explícita | Usuário vincula fixação a carga ou período | Carga não alocada fica em "preço pendente" |

O contrato declara um método; o tenant define o padrão (*parâmetro*). Carga em "preço pendente" usa valor provisório pela referência de mercado para estoque e posição e bloqueia liquidação.

### CX-01 Regra de câmbio do contrato

| Bloco | Conteúdo |
|---|---|
| Identidade | CX-01, regra de câmbio, tipo parâmetro contratual |
| Aplicabilidade | Contratos com moeda de preço diferente da moeda de liquidação |
| Entradas | Fonte (PTAX, taxa negociada, trava bancária, taxa fixa), tipo (compra, venda), data de referência (dia da fixação, dia útil anterior à fixação, dia útil anterior ao pagamento, dia da emissão da nota), tratamento de dia não útil (anterior, posterior), casas decimais |
| Cálculo | Seleção determinística da taxa na data de referência; dia sem cotação usa o tratamento declarado |
| Saídas | Taxa aplicável com fonte, data e versão |
| Governança | Mudança é aditivo; taxa de trava bancária prevalece quando vinculada |
| Testes | Cada data de referência; fim de semana e feriado; trava vinculada; ausência de cotação |

*Parâmetro*: fonte, tipo e data de referência praticados pela trading piloto. Padrão de *referência*: PTAX de venda do dia útil anterior ao pagamento.

### CX-02 Fixação de câmbio

Evento independente da fixação de preço, com quantidade ou valor, taxa, fonte, data de referência, autor e evidência. Reduz o saldo a fixar de câmbio. Um contrato pode estar em qualquer combinação dos quatro estados: preço aberto ou fixado, câmbio aberto ou fixado, cada um parcialmente.

### CX-03 Conversão na liquidação

```
valor_brl = quantidade_elegível ÷ kg_por_unidade_de_preço × preço_descontado_moeda_origem × taxa_câmbio
```

Arredondar apenas o resultado, para centavos. Memória guarda os cinco fatores. Diferença entre taxa da nota e taxa do pagamento, quando o contrato prevê datas distintas, é variação cambial (CT-06), não divergência de conciliação.

### AD-01 Adiantamento em dinheiro

| Bloco | Conteúdo |
|---|---|
| Identidade | AD-01, adiantamento financeiro, tipo cálculo |
| Entradas | Valor, moeda, data, taxa de juros e base (*parâmetro*), forma de amortização (proporcional, percentual por carga, integral na primeira), garantia |
| Cálculo | Proporcional: amortização_carga = adiantamento_total × (quantidade_aceita_carga ÷ quantidade_contratada); última carga zera o resíduo |
| Saídas | Saldo de adiantamento, componente de dedução na liquidação |
| Governança | Vencimento antecipado quando o contrato é cancelado ou cedido sem assunção |
| Testes | 25 cargas sem resíduo (CM-08); cancelamento com saldo; cessão com saldo (CT-04) |

### AD-02 Obrigação denominada em sacas

Saldo mantido em quilogramas canônicos; valor contábil por referência de preço declarada no contrato; amortização por entrega física pela quantidade, independente do preço do dia; conversão em dívida monetária, se não entregue, pela regra do contrato. *Decisão*: dentro ou fora do MVP (D02).

---

## 7. Saldos, tolerância e encerramento

### SL-01 Limites entre saldos

- Entregue e aceito não excede contratado mais tolerância sem aditivo.
- Fixado não excede contratado.
- Liquidado não excede entregue e aceito com preço definitivo.
- Faturado não excede entregue e aceito.
- Nenhum saldo é editado; toda correção é evento com origem.

### SL-02 Tolerância de entrega

| Bloco | Conteúdo |
|---|---|
| Identidade | SL-02, tolerância, tipo cálculo e política |
| Entradas | Percentual ou quantidade na unidade contratual (*parâmetro*, referência 5%), contratado em kg, entregue e aceito em kg |
| Cálculo | Excedente dentro da tolerância liquida pelo preço do contrato; falta dentro da tolerância permite encerramento sem penalidade; excedente ou falta além da tolerância exige decisão: novo negócio, preço de mercado, recusa, multa ou washout |
| Saídas | Estado do saldo (dentro, excedente, falta) e bloqueio quando além |
| Governança | Decisão por alçada com motivo |
| Testes | 4% acima com 5% (CM-06); 8% acima (CM-07); falta de 3% no encerramento |

### SL-03 Encerramento

O contrato encerra quando saldos e obrigações estão resolvidos, documentos obrigatórios presentes, divergências tratadas, liquidações conciliadas, garantias liberadas e lançamentos contabilizados. Encerramento com saldo residual dentro da tolerância é automático; fora dela exige aditivo ou decisão. Encerramento administrativo registra motivo e aprovação.

---

## 8. Qualidade e descontos de classificação

### QL-01 Padrão de qualidade

Tabela versionada por commodity com, para cada parâmetro: unidade de medida, método, base, limite de aprovação, limite de rejeição, método de desconto (peso ou preço), fórmula ou tabela de desconto, forma de combinação (aditiva ou sequencial), vigência. O contrato referencia o padrão; a versão vigente na assinatura é congelada. Valores de *referência* no Anexo B.3 e B.4. *Parâmetro*: tabela da trading piloto (D03).

### QL-02 Desconto de peso por umidade

| Bloco | Conteúdo |
|---|---|
| Identidade | QL-02, umidade, tipo cálculo |
| Entradas | Peso líquido físico, umidade medida, umidade base, variante (fórmula ou tabela por faixa) |
| Cálculo | Fórmula: desconto_kg = peso_físico × (umidade − base) ÷ (100 − base). Tabela: percentual da faixa × peso_físico |
| Saídas | Quilogramas descontados, memória |
| Governança | Variante é atributo do padrão |
| Testes | 36.540 kg a 16,2% base 14% = 934,7 kg (QC-02); umidade igual à base; abaixo da base sem bonificação salvo QL-07 |

### QL-03 Desconto de peso por impureza

desconto_kg = base_de_cálculo × (impureza − base) ÷ 100. A base de cálculo é o peso líquido físico ou o peso já descontado da umidade, conforme o padrão (*parâmetro*; referência: físico). Testes: QC-03.

### QL-04 Desconto de preço por parâmetro qualitativo

Para avariados, ardidos, queimados, mofados, esverdeados, quebrados e carunchados: percentual de desconto por ponto ou por faixa acima da base, aplicado ao preço. Com mais de um parâmetro fora da base, forma aditiva (soma dos percentuais aplicada uma vez) ou sequencial (cada um sobre o preço já descontado), conforme o padrão (*parâmetro*; referência: aditiva). Testes: QC-04.

### QL-05 Taxa de secagem e quebra de secagem

Taxa por ponto de umidade acima da base, em valor por tonelada, por saca ou percentual (*parâmetro*), apropriada à carga como componente de custo e deduzida da liquidação quando o contrato assim define. Quebra de secagem sai do estoque como perda técnica aprovada; quem absorve é *parâmetro*. Testes: QC-05.

### QL-06 Ordem de aplicação

1. Peso líquido físico.
2. Desconto de peso por umidade (QL-02).
3. Desconto de peso por impureza (QL-03).
4. Peso líquido comercial.
5. Preço contratual após conversão de unidade (UN-01) e câmbio (CX-03).
6. Descontos de preço (QL-04).
7. Valor bruto da carga = peso líquido comercial convertido para a unidade de preço × preço descontado, mais bonificações (QL-07).
8. Demais componentes da liquidação (10.2).

Arredondamento: pesos conforme precisão da balança; percentuais de laudo com uma casa; valor final em centavos, uma única vez.

### QL-07 Bonificação

Mesma estrutura do desconto de preço com sinal invertido, mesma tabela e memória. *Decisão*: se o piloto pratica.

### QL-08 Aceite, aceite condicionado e rejeição

| Situação | Regra |
|---|---|
| Dentro da base | Aceite automático |
| Entre base e limite de aprovação | Aceite com desconto, automático |
| Entre limite de aprovação e limite de rejeição | Aceite condicionado: alçada (*parâmetro*), desconto de tabela e cenário de rejeição calculados; desconto negociado registrado com diferença e evidência |
| Acima do limite de rejeição | Rejeição, salvo exceção por alçada superior |
| Contaminante ou transgenia em contrato segregado | Rejeição sem exceção (*parâmetro*: lista) |

### QL-09 Contraprova

Prazo de guarda da amostra e de pedido (*parâmetro*, referência 24 a 72 horas); laboratório ou classificador definido; tolerância de divergência por parâmetro dentro da qual o laudo original prevalece; fora dela, reclassificação gera nova versão do laudo e recalcula desconto, peso comercial, saldo e liquidação; custo da contraprova conforme resultado; laudo que prevalece por tipo de contrato (destino, origem, arbitral). Carga em contraprova: aceita provisoriamente com liquidação bloqueada ou descarregada em lote segregado (*parâmetro*).

### QL-10 Rejeição no destino após viagem

Carga entra em "rejeitada no destino"; não movimenta estoque do destino; decisão entre devolução, redirecionamento ou aceite renegociado; cada decisão tem consequência documental (NF-e de devolução ou nova venda) e de frete; saldo contratual volta ao estado anterior ao carregamento. Testes: QC-10, CT-12.

### QL-11 Qualidade de lote misturado

Cada parâmetro do lote resultante é a média ponderada pelo peso dos lotes de origem. Expedição de lote fora do padrão do contrato de venda gera alerta ou bloqueio (*parâmetro*). Testes: QC-11, QC-12.

### QL-12 Efeitos nos demais domínios

| Domínio | Peso ou valor usado |
|---|---|
| Saldo contratual | Peso líquido comercial (*parâmetro*: confirmar) |
| Estoque | Peso líquido físico, ou peso seco após secagem; qualidade do laudo |
| NF-e | Quantidade: peso líquido comercial; valor: bruto da carga. Forma de apresentar desconto de preço na nota: validação fiscal |
| Liquidação | Peso comercial, preço descontado, secagem como componente separado |
| Razão de custos | Secagem, classificação de terceiro e contraprova como componentes da carga |
| Margem | Diferença entre desconto de tabela e negociado é variação por qualidade |
| Posição | Reduz a entregar pelo peso comercial |

---

## 9. Razão de custos por contrato

Subledger operacional. Cada componente possui identidade, estado, competência, documento e critério de apropriação.

| Componente | Objeto de apropriação | Fonte | Estados |
|---|---|---|---|
| Mercadoria | Contrato, carga ou lote | Preço aplicável e quantidade elegível | Previsto, realizado, faturado |
| Frete e pedágio | Carga e contrato | Cotação, ordem, CT-e, comprovante | Cotado, comprometido, faturado, pago |
| Classificação | Carga, origem ou destino | Ordem e documento do prestador | Provisionado, faturado, pago |
| Secagem | Carga | Laudo e tabela QL-05 | Calculado, faturado, pago |
| Armazenagem e estadia | Lote, local, período ou carga | Tabela, franquia e horas ou volume | Acumulado, aprovado, faturado |
| Comissão | Contrato ou recebimento | Regra e beneficiário | Provisionada, liberada, paga, estornada |
| Documento e serviço | Carga ou contrato | Prestador, tarifa e documento | Realizado, faturado, pago |
| Tributo não recuperável | Documento ou contrato | Regra tributária validada | Calculado, confirmado, recolhido |
| Penalidade e ajuste | Evento ou contrato | Decisão, motivo e alçada | Proposto, aprovado, contabilizado |
| Diferença de qualidade | Carga | Desconto de tabela menos negociado | Calculado, aprovado |

### CU-01 Apropriação e rateio

Custos específicos são vinculados à carga, contrato ou lote. Custos compartilhados usam rateio por quantidade, valor, distância, tempo, capacidade ou fórmula homologada, registrando total de origem, fração, arredondamento e saldo não alocado. Alteração recalcula só objetos abertos ou cria ajuste aprovado em período fechado. Frete em back to back é apropriado ao contrato que assumiu a responsabilidade (FOB ou CIF).

### CU-02 Frete

Responsabilidade e risco por condição comercial (FOB origem, CIF destino, posto armazém) declarados no contrato; tarifa com unidade (por tonelada, por saca), pedágio incluso ou não, adiantamento e saldo; quebra de transporte além da tolerância (*parâmetro*) deduzida do frete; estadia com franquia, tarifa, marco inicial e responsável (*parâmetro*). Decisão D04.

---

## 10. Liquidação e pagamento

### LQ-01 Composição

```
líquido = valor_bruto_da_carga
        + bonificações e reembolsos
        − secagem, classificação, armazenagem, estadia e serviços a cargo da contraparte
        − frete a cargo da contraparte
        − amortização de adiantamento
        − retenções válidas (TR-01)
        − multas, compensações e outros componentes autorizados
```

### LQ-02 Ordem de cálculo e base das retenções

1. Valor bruto da carga (QL-06, passo 7).
2. Bonificações e reembolsos.
3. Deduções de custo e serviço.
4. Amortização de adiantamento.
5. Retenções, calculadas sobre a base definida por cada regra tributária (TR-01). A base de *referência* é o valor bruto da carga antes das deduções de custo; *parâmetro*: validação fiscal.
6. Multas e compensações.
7. Líquido, arredondado a centavos uma única vez.

### LQ-03 Peso oficial e divergência de peso

Peso oficial para pagamento é o declarado no contrato (*parâmetro*; referência: destino). Divergência entre peso da NF-e e peso oficial além da tolerância (*parâmetro*) exige nota complementar ou documento de ajuste, com validação fiscal, antes da liquidação.

### LQ-04 Marco do prazo de pagamento

Evento que inicia a contagem, declarado no contrato: descarga, emissão da NF-e, aceite da qualidade, entrega do último documento do checklist, ou combinação. Contagem em dias corridos ou úteis (*parâmetro*), com calendário de feriados nacional, estadual e municipal da praça de pagamento. Vencimento em dia não útil: anterior ou posterior (*parâmetro*).

### LQ-05 Condicionantes e bloqueio

Liquidação só é liberada com checklist documental atendido (ticket, laudo, NF-e, CT-e quando aplicável, certidões conforme contrato), conta bancária validada, divergências dentro da tolerância ou caso resolvido, e preço definitivo. Pendência gera retenção do pagamento com prazo de cura.

### LQ-06 Juros e multa por atraso

Fórmula, índice e base declarados no contrato (*parâmetro*). Componentes separados na memória.

### LQ-07 Beneficiário e conta

Beneficiário é a contraparte vigente, salvo cessão registrada (CS-01) ou pagamento a terceiro autorizado (CS-02). Conta bancária validada por titularidade; alteração com dupla validação e trilha antes do pagamento.

### LQ-08 Liquidação parcial e por lote

Por carga, por período, por fechamento ou somente após lote completo, conforme contrato. Liquidação parcial consome saldo liquidado e preserva os demais.

---

## 11. Comissões

Comissão é componente econômico próprio, não despesa genérica.

| Campo | Regra mínima |
|---|---|
| Beneficiário | Usuário interno, corretor, indicador, parceiro ou empresa externa cadastrada |
| Base | Volume, valor bruto, receita líquida, margem, spread, valor fixo ou fórmula homologada |
| Gatilho | Assinatura, execução, faturamento, recebimento, pagamento ou encerramento |
| Competência | Evento e data que reconhecem a despesa, separados da data de pagamento |
| Condição | Inadimplência, cancelamento, entrega parcial, washout, estorno, teto, piso, divisão entre beneficiários |
| Governança | Regra versionada, aprovação, documento, título, pagamento e lançamento |

### CM-01 Cálculo

comissão_calculada = base_elegível × taxa, ou valor fixo. comissão_liberada = comissão_calculada × proporção do gatilho cumprido, respeitando limites e estornos. Memória com base, taxa, parcela cumprida, deduções e beneficiários.

### CM-02 Tributação da comissão externa

Retenções sobre corretor pessoa jurídica e pessoa física e documento exigido do corretor (*parâmetro*; validação fiscal). Geram obrigação tributária própria (TR-02).

### CM-03 Comissão em cancelamento, washout e entrega parcial

Estorno total, proporcional ao não executado, ou mantida, conforme a regra da comissão (*parâmetro*; referência: proporcional). Estorno nunca apaga a provisão original.

---

## 12. Tributos, retenções e obrigações

As incidências do piloto são entradas para descoberta. Só se tornam regras produtivas após confirmação de aplicabilidade, base, alíquota, responsabilidade, documento, competência, vencimento e contabilização (D05).

### 12.1 Inventário fiscal do recorte (Mato Grosso, soja e milho)

Lista do que o especialista precisa validar. Nenhum item está homologado.

| Tema | O que precisa ser definido |
|---|---|
| Documento na compra de produtor | Quem emite: NF-e do produtor ou nota de entrada da trading; contranota; prazos |
| CFOPs | Compra interna e interestadual; venda interna e interestadual; remessa e retorno de armazenagem; remessa por conta e ordem; devolução; remessa e retorno simbólicos |
| ICMS | Diferimento nas operações internas com produtor; encerramento do diferimento na venda interestadual ou para indústria; responsabilidade da trading pelo ICMS diferido; reflexo na margem |
| FETHAB | Fundo estadual de MT: valores por tonelada, quem recolhe, quando, documento |
| INDEA | Agência de defesa agropecuária de MT: taxas e exigências de trânsito, quando aplicáveis |
| Funrural e SENAR | Produtor pessoa física: retenção pelo adquirente, base, alíquotas, opção pela folha como atributo temporal comprovável. Produtor pessoa jurídica: recolhimento próprio. Documento e competência |
| PIS e COFINS | Suspensão na venda de grãos para agroindústria; crédito presumido; regime da trading |
| Obrigações acessórias | EFD-Reinf para retenções, SPED Fiscal, EFD-Contribuições, apuração estadual; nativo ou integrado |
| Frete | CT-e e MDF-e por tipo de transportador; CIOT; retenções sobre frete de autônomo; piso mínimo |
| Serviços | NFS-e de classificação, secagem e armazenagem; tributos municipais |
| Nota complementar e devolução | Quando emitir por divergência de peso, fixação posterior ou rejeição |
| Washout e nota de débito | Tratamento fiscal do documento de washout |

Nota: as versões anteriores citavam FETAB e IAGRO. FETAB não existe com esse nome; IAGRO é agência de Mato Grosso do Sul. Para o piloto em MT, os nomes corretos são FETHAB e INDEA. Se houver operação em MS, é outro pacote fiscal.

### TR-01 Modelo de retenção

| Bloco | Conteúdo |
|---|---|
| Identidade | TR-01, retenção na liquidação, tipo cálculo |
| Vigência | Por regra tributária, com início e fim |
| Aplicabilidade | Contexto do item 4: tipo de contraparte, opção de recolhimento, operação, UF, documento, parte vigente na data do fato |
| Entradas | Base tributável (LQ-02 passo 5), alíquota vigente, modo e escala de arredondamento |
| Cálculo | valor_retido = base × alíquota, arredondado conforme a regra |
| Saídas | Redução do líquido ao fornecedor; obrigação tributária separada por competência, código, jurisdição e vencimento (TR-02) |
| Governança | Só reduz o líquido quando responsabilidade e documento estão válidos; baixa do fornecedor e recolhimento são independentes e conciliados |
| Testes | P02; retenção com fornecedor PF e PJ; opção pela folha; cessão de crédito (retenção sobre o cedente, CT-01) |

Exemplo de *referência* trazido pela entrevista: nota de R$ 45.000 e alíquota de 0,2% resultam em R$ 90 de retenção e R$ 90 de obrigação. Não é parametrização aprovada.

### TR-02 Obrigação tributária

Nasce na confirmação da retenção ou incidência; tem competência, código, jurisdição, vencimento, documento de origem, título quando o tenant recolhe, estado (calculada, confirmada, recolhida, estornada). Cancelamento, complemento, devolução ou correção gera recálculo e estorno por evento sem apagar a memória.

### TR-03 Perfil tributário da contraparte

Pessoa física ou jurídica, inscrições, condição de produtor rural, opção de recolhimento com vigência comprovada por documento. Mudança de perfil por cessão de posição (CS-03) aplica-se às cargas seguintes.

---

## 13. Cessões, transferências e operações triangulares

### CS-01 Cessão de crédito

| Bloco | Conteúdo |
|---|---|
| Identidade | CS-01, cessão de crédito, tipo evento financeiro |
| Aplicabilidade | Título de contrato de compra cujo credor cede a terceiro |
| Entradas | Instrumento assinado, notificação à trading (data, documento, conferente), cessionário cadastrado com conta validada, proporção ou valor cedido, regra para diferença entre estimado e final |
| Cálculo | Título dividido por beneficiário na proporção cedida; retenções calculadas sobre o cedente; cessionário recebe o líquido proporcional |
| Saídas | Título com beneficiário alternativo ou títulos parciais; histórico do beneficiário original |
| Governança | Alçada específica; conciliação aceita beneficiário diferente da contraparte quando há cessão registrada |
| Testes | CT-01, CT-02; estorno de liquidação após pagamento ao cessionário com devedor da diferença registrado |

### CS-02 Pagamento a terceiro sem cessão

Exceção auditada: autorização escrita do fornecedor, aprovação por alçada superior, conta validada, dupla aprovação. Nunca fluxo normal. Testes: CT-03.

### CS-03 Cessão de posição contratual

Anuência formal da parte remanescente; cessionário passa por cadastro, compliance, crédito e conta; migram saldo não entregue, fixações abertas, obrigações pendentes e, por decisão explícita, adiantamento em aberto; entregas já feitas permanecem com o cedente; garantia substituída ou liberada com aprovação; perfil tributário da parte vigente aplica-se às cargas seguintes (TR-03); preço e condições não mudam (senão é aditivo); nova versão do contrato com "cedido de" e "cedido para", mesmo número. Testes: CT-04.

### CS-04 Reaplicação de carga e transferência de saldo

| Caso | Regra |
|---|---|
| Reaplicação de carga | Mesma contraparte e commodity; permitida até a emissão da NF-e; depois, exige tratamento fiscal e aprovação. Liquida pelo preço do contrato de destino; recalcula e registra a diferença. Fixações não migram |
| Transferência de saldo não entregue | Aditivo que reduz o contratado de origem e aditivo que aumenta o de destino, ou contrato novo; nunca edição de saldo. Preço diferente é renegociação com alçada e motivo. Adiantamento: acompanha o saldo ou permanece, conforme regra (*parâmetro*). Tolerância recalculada sobre cada contratado |
| Rastreabilidade | Evento com origem, destino, quantidade, motivo, autor, aprovação e versão de ambos |

Testes: CT-05, CT-06, CT-07.

### CS-05 Compensação entre contratos

Instrumento assinado; cada contrato gera seu título; a compensação baixa ambos pelo menor valor e deixa residual; retenções da compra calculadas normalmente; cada operação mantém sua nota; compensação financeira não substitui entrega física. Testes: CT-10.

### CS-06 Washout

| Bloco | Conteúdo |
|---|---|
| Identidade | CS-06, washout, tipo cálculo e encerramento |
| Entradas | Quantidade não entregue, preço do contrato, preço de referência na data (fonte do contrato, *parâmetro*), regra de câmbio (CX-01) se em moeda estrangeira, multa contratual se por inadimplemento, regra de comissão (CM-03) |
| Cálculo | valor_washout = (preço_referência − preço_contrato) × quantidade_não_entregue; sinal define quem paga. Contrato a fixar: saldo fixado pela referência; diferença limitada ao prêmio. Multa é componente separado |
| Saídas | Documento de cobrança ou nota de débito (tratamento fiscal a validar); contratado reduzido ao entregue; contrato encerrado por washout; comissão tratada; posição atualizada |
| Governança | Quem pode pedir conforme contrato; alçada específica; classificação contábil a definir (D07) |
| Testes | CT-08, CT-09 |

### CS-07 Venda à ordem e entrega em local diverso

Contrato de venda com "destinatário da entrega" e "local de entrega" distintos do comprador; venda à ordem gera nota de venda ao adquirente e nota de remessa por conta e ordem ao destinatário, ambas vinculadas à mesma carga; estoque sai uma vez; título contra o adquirente; rejeição pelo destinatário segue QL-10 com negociação com o adquirente. Fluxo documental e CFOPs por UF: validação fiscal. Regra mínima de integridade: toda carga física tem exatamente um documento que a acompanha, e todo documento de venda tem a carga ou a remessa que o sustenta. Testes: CT-11, CT-12.

### CS-08 Back to back

Contrato de compra e contrato de venda vinculados um a um por carga; entrada e saída de estoque na mesma carga ou estoque em trânsito de terceiro; classificação no destino serve aos dois contratos, discrepância é risco da trading; frete apropriado ao contrato responsável (CU-01); margem do par. Testes: CT-13.

### CS-09 Intercompany e armazém de terceiro

Intercompany: compra e venda entre empresas do tenant com preço de transferência por política; notas de ambos os lados; margem por empresa e consolidada. Armazém de terceiro: venda transfere titularidade do lote sem movimento físico; documentos simbólicos; custo de armazenagem muda de responsável na venda. Ambos fora do MVP, mas o modelo de contrato aceita comprador e vendedor do mesmo tenant e lote depositado sem tratamento especial. Testes: CT-14, CT-15.

### CS-10 Regras transversais

Toda operação deste capítulo é evento com tipo, partes, contratos afetados, quantidade, valores, motivo, autor, aprovação, documentos e versões antes e depois; nenhuma edita saldo; alçadas superiores às do contrato original; cessionário e destinatário passam por compliance antes de ativar; cessão e washout alteram posição na data do evento.

---

## 14. Conciliação ponta a ponta

| Perspectiva | O que deve concordar | Fonte |
|---|---|---|
| Contrato e execução | Quantidade, preço, qualidade, frete, condições e saldo | Negócio e cargas |
| Documento fiscal | Partes, produto, CFOP, quantidade, valor, impostos e eventos | NF-e, CT-e, MDF-e e serviços |
| Financeiro | Bruto, deduções, retenções, vencimento, título, beneficiário e baixa | Contas a pagar e receber |
| Banco | Valor, data, conta, beneficiário, comprovante e estorno | Extrato, arquivo ou API |
| Tributário | Base, alíquota, valor, competência, vencimento e recolhimento | Obrigação tributária |
| Contábil | Conta, centro, débito, crédito, competência e origem | Subledger e razão |

### CC-01 Tolerâncias e bloqueios

| Divergência | Tolerância (*parâmetro*) | Ação quando excedida |
|---|---|---|
| Peso contrato versus ticket (acumulado) | SL-02 | Bloqueio de novas cargas além da tolerância |
| Peso ticket origem versus destino | CU-02 | Dedução de frete; caso |
| Peso ticket versus NF-e | Quilogramas ou percentual | Bloqueio de liquidação; nota complementar |
| Valor NF-e versus liquidação | Valor absoluto e percentual | Bloqueio de liquidação; caso |
| Título versus banco | Centavos | Bloqueio de baixa; caso |
| Retenção versus obrigação | Zero | Bloqueio de fechamento |
| Taxa da nota versus taxa do pagamento (CX-03) | Não é divergência | Variação cambial |

Diferença fora da tolerância abre caso com causa, objeto responsável, evidências, impacto, decisão, aprovação e prazo (*parâmetro*). A solução pode corrigir cadastro, recalcular, complementar documento, estornar, aceitar diferença ou registrar perda aprovada. Baixa ou pagamento não encerra o caso enquanto documento, tributo e contabilização permanecerem incompatíveis.

---

## 15. Margem e resultado

- Margem projetada usa preço e custos previstos na aprovação.
- Margem comprometida substitui estimativas por ordens, contratos de serviço e provisões.
- Margem realizada usa receitas reconhecidas e custos apropriados, mesmo não pagos.
- Margem de caixa considera entradas e saídas efetivas; não substitui competência.

### MG-01 Valorização do estoque e custo da venda

Método declarado por tenant e validado pelo contador (*decisão*, D07): custo médio ponderado, custo específico por lote ou rateio proporcional do custo da compra pelo peso expedido. O código atual rateia proporcionalmente; isso precisa ser confirmado ou alterado, nunca mantido por omissão.

### MG-02 Decomposição da variação

Preço, volume, qualidade (desconto de tabela, desconto negociado, rejeição), frete, secagem, comissão, tributo, serviço, penalidade, câmbio, washout e outros componentes autorizados. Cada componente aponta o evento que o originou.

### MG-03 Margem gerencial e contábil

A margem gerencial por contrato pode reconhecer componentes antes do fechamento contábil (comissão provisionada, variação cambial estimada). O documento de fechamento explica a diferença entre as duas por componente.

---

## 16. Eventos contábeis

| Evento | Consequência esperada | Evidência |
|---|---|---|
| Entrada aceita | Estoque ou direito conforme política de reconhecimento (*decisão*: no aceite ou na nota) | Carga, romaneio, laudo e documento |
| Liquidação de compra | Fornecedor, custo e retenções | Memória e aprovação |
| Frete realizado | Custo direto e obrigação com transportador | Ordem, CT-e ou documento homologado |
| Secagem e quebra | Custo e perda técnica | Laudo, tabela, aprovação |
| Comissão adquirida | Despesa e obrigação com beneficiário | Regra e gatilho cumprido |
| Retenção confirmada | Redução do fornecedor e passivo tributário | Regra, base e documento |
| Pagamento ou recebimento | Baixa do título e caixa; beneficiário pode ser cessionário | Banco e comprovante |
| Venda faturada | Receita, cliente, impostos, baixa de estoque pelo método MG-01, ICMS diferido quando aplicável | Contrato, carga e NF-e |
| Fixação e variação cambial | Reconhecimento de contrato a fixar e de variação cambial, por competência ou na liquidação (*decisão*) | Fixações, taxas |
| Washout e compensação | Resultado e baixa de títulos | Instrumento e cálculo |
| Fechamento | Ajustes, apropriações, valorização de contratos a fixar, resultado do período | Reconciliações e aprovação |

Plano de contas e débitos e créditos: a definir no pacote D07, com contas provisórias para homologação.

---

## 17. Estados e transições

### 17.1 Contrato

Ciclo de vida: minuta, revisão, assinatura, ativo, suspenso, cedido, encerrado (por execução, washout, compensação, administrativo). Eixo de precificação, ortogonal: fixo; a fixar sem fixação; parcialmente fixado; totalmente fixado; fixação vencida sem decisão. Eixo de câmbio: não aplicável; aberto; parcialmente fixado; totalmente fixado.

### 17.2 Carga e classificação

Carga: prevista, em trânsito, no pátio, amostrada, classificada, aceita, aceita condicionalmente, em contraprova, reclassificada, rejeitada, rejeitada no destino, reaplicada, entregue com preço pendente, concluída.

### 17.3 Título, documento fiscal e obrigação tributária

Título: previsto, emitido, bloqueado por condicionante, cedido parcial, cedido total, beneficiário alternativo, compensado, pago, estornado. Documento fiscal: recebido, validado, vinculado, divergente, complementado, cancelado, devolução, remessa por conta e ordem, simbólico. Obrigação tributária: calculada, confirmada, recolhida, estornada.

### 17.4 Campos materiais do negócio

Alteração invalida aprovação anterior: partes, commodity, quantidade contratada, tolerância, preço ou termo de preço, moeda, regra de câmbio, condição de frete, prazo e marco de pagamento, padrão de qualidade, garantia, destinatário e local de entrega, beneficiário do título. *Parâmetro*: a trading pode acrescentar.

### 17.5 Regra de transição

Toda transição tem guarda (quem pode, qual evidência), evento de auditoria e versão da regra aplicada. Estado sem transição definida não é regra testável.

---

## 18. Cenários obrigatórios do piloto

### 18.1 Cadeia econômica (mantidos da versão 1.0)

| ID | Cenário | Resultado esperado |
|---|---|---|
| P01 | Compra simples | Contrato, carga, nota, título e pagamento concordam sem retenção |
| P02 | Compra com retenção | Líquido correto e obrigação tributária separada por competência |
| P03 | Contrato multicarga | Ao menos cinquenta cargas sem divergência acumulada de arredondamento |
| P04 | Frete e documentos | CT-e e MDF-e emitidos ou vinculados e custo apropriado à carga correta |
| P05 | Comissões | Interna e externa com bases distintas, liberação parcial e estorno |
| P06 | Divergência financeira | NF-e diferente do esperado abre caso e bloqueia conforme política |
| P07 | Qualidade | Desconto altera liquidação, custo e margem com memória reproduzível |
| P08 | Fechamento | Subledgers físico, fiscal, financeiro, tributário e contábil reconciliam |

### 18.2 Piloto JD (aceite humano)

| ID | Commodity | Operação | Resultado esperado |
|---|---|---|---|
| JD-01 | Milho | Compra com recebimento aceito | Peso, qualidade, NF-e, custos e título rastreáveis |
| JD-02 | Soja | Compra com ocorrência e ajuste | Decisão e ajuste preservam motivo, autor e versão |
| JD-03 | Milho | Venda e expedição | Estoque, NF-e, contas a receber e margem realizados |
| JD-04 | Soja | Venda e liquidação parcial | Saldo, estorno e conciliação consistentes |

### 18.3 Unidades, moedas e fixação

| ID | Cenário | O que verifica |
|---|---|---|
| CM-01 | Compra de 1.000 t, preço em real por saca | UN-01, arredondamento único |
| CM-02 | Compra de 10.000 sc, preço em dólar fixo, PTAX do dia útil anterior ao pagamento | CX-01, CX-03, memória da taxa |
| CM-03 | Venda de 500 t a fixar contra CBOT com prêmio em cents por bushel, três fixações | PR-02, PR-04 |
| CM-04 | Carga entregue antes da fixação | Preço pendente, valor provisório, bloqueio |
| CM-05 | Preço fixado em dólar, câmbio travado em data diferente | CX-02, trava prevalece |
| CM-06 | Entrega 4% acima com tolerância 5% | SL-02, preço do contrato |
| CM-07 | Entrega 8% acima com tolerância 5% | SL-02, bloqueio e decisão |
| CM-08 | Adiantamento amortizado em 25 cargas | AD-01, resíduo zerado |
| CM-09 | Adiantamento de 2.000 sacas, entrega de 1.200 | AD-02 |
| CM-10 | Janela de fixação vence com saldo | PR-03 |
| CM-11 | Taxa da nota diferente da taxa do pagamento | CX-03, variação cambial |
| CM-12 | Estorno de fixação após carga liquidada | PR-02, ajuste e histórico |

### 18.4 Qualidade

| ID | Cenário | O que verifica |
|---|---|---|
| QC-01 | Tudo dentro da base | Aceite automático, comercial igual ao físico |
| QC-02 | Soja a 16,2% umidade | QL-02 |
| QC-03 | Milho a 17% umidade e 2,5% impureza | QL-03, base do segundo desconto |
| QC-04 | Avariados 10% e ardidos 5% | QL-04 aditivo versus sequencial |
| QC-05 | Milho a 19% com secagem própria | QL-05 |
| QC-06 | Entre limite de aprovação e rejeição | QL-08, alçada, desconto negociado |
| QC-07 | Acima do limite de rejeição | QL-08, saldo preservado |
| QC-08 | Contraprova dentro da tolerância | QL-09, laudo original |
| QC-09 | Contraprova fora da tolerância | QL-09, reclassificação |
| QC-10 | Rejeição no destino após viagem | QL-10 |
| QC-11 | Mistura de lotes | QL-11 |
| QC-12 | Expedição fora do padrão de venda | QL-11 |
| QC-13 | Mudança de vigência da tabela | QL-01, versão congelada |

### 18.5 Cessões e operações triangulares

| ID | Cenário | O que verifica |
|---|---|---|
| CT-01 | Cessão integral a banco antes da primeira carga | CS-01, retenção sobre o cedente |
| CT-02 | Cessão parcial de 60% | CS-01, título dividido |
| CT-03 | Pagamento a terceiro sem instrumento | CS-02, bloqueio |
| CT-04 | Cessão de posição PF para PJ com adiantamento | CS-03, TR-03, AD-01 |
| CT-05 | Reaplicação de carga antes da nota | CS-04 |
| CT-06 | Reaplicação após nota | CS-04, bloqueio sem tratamento fiscal |
| CT-07 | Transferência de saldo com preço maior | CS-04, alçada |
| CT-08 | Washout em real, preço fixo | CS-06 |
| CT-09 | Washout em dólar a fixar | CS-06, CX-01 |
| CT-10 | Compensação grãos versus insumos | CS-05 |
| CT-11 | Venda à ordem com entrega em terminal | CS-07 |
| CT-12 | Rejeição pelo destinatário na venda à ordem | CS-07, QL-10 |
| CT-13 | Back to back com laudo divergente | CS-08 |
| CT-14 | Venda de lote em armazém de terceiro | CS-09 |
| CT-15 | Intercompany | CS-09 |

---

## 19. Critérios de homologação

- Regra aprovada por responsável de negócio e, quando fiscal ou contábil, pelo especialista competente.
- Aplicabilidade, vigência, prioridade e exceções documentadas.
- Exemplos positivos, negativos, limites e arredondamentos testados.
- Memória de cálculo legível por usuário operacional e auditável tecnicamente.
- Reprocessamento e estorno testados sem apagar o histórico.
- Conciliação com legado e planilhas de referência dentro da tolerância aprovada.
- Permissões, alçadas, contingência e trilha de auditoria verificadas.
- Todo *parâmetro* preenchido com valor da trading piloto e aprovação registrada; nenhum valor de *referência* em produção.
- Cada regra do catálogo tem ao menos um cenário das seções 18.1 a 18.5 executado com resultado esperado conferido.

---

## 20. Decisões abertas

Consolidadas com os códigos do repositório.

| Código | Tema | Decisão necessária | Regras afetadas | Momento |
|---|---|---|---|---|
| D02 | Preço a fixar, fixações e câmbio | Referências, vencimento, prêmio, quem fixa, janela, não fixação, método de alocação, fonte e data da PTAX, adiantamento em sacas dentro ou fora | PR-01 a PR-04, CX-01 a CX-03, AD-02 | Antes de liberar preço a fixar |
| D03 | Qualidade | Tabela da JD, fórmula de umidade, base da impureza, aditivo ou sequencial, secagem, peso que consome saldo, contraprova, laudo que prevalece, rejeição sem exceção, bonificação, alçadas | QL-01 a QL-12 | Antes de homologar JD-01 e JD-02 |
| D04 | Frete | Condição comercial, tarifa, quebra de transporte, estadia, documentos, gatilho da despesa | CU-02, CC-01 | Antes das slices de frete |
| D05 | Fiscal MT | Inventário do item 12.1 validado: documentos, CFOPs, ICMS diferido, FETHAB, INDEA, Funrural e SENAR, PIS e COFINS, acessórias, base das retenções | TR-01 a TR-03, LQ-02, LQ-03 | Antes da especificação fiscal |
| D06 | Tesouraria | Banco, formato de extrato, aprovadores nominais, importação OFX ou CNAB, calendário de vencimento | LQ-04, LQ-07, CC-01 | Antes da Fase 3 |
| D07 | Contábil | Plano, débitos e créditos, reconhecimento de estoque, valorização MG-01, variação cambial, washout, fechamento | 16, MG-01, MG-03 | Antes da slice contábil |
| D08 | Risco | Fonte de preço e câmbio de mercado, praça, instrumentos, frequência, executor | PR-04 (valor provisório), CS-06 (referência) | Antes da Fase 3 |
| D09 | Migração | Fontes, responsáveis, volumes, mapeamentos, corte, tolerâncias | CC-01 | Fase 0 |
| Novo | Cessões e triangulares | Quais operações ocorrem; documentação de cessão; reaplicação após nota; venda à ordem por UF; back to back; alçadas | CS-01 a CS-10 | Antes de codificar além de CS-01, CS-02 e CS-04 |
| Novo | Tolerância e encerramento | Percentual, excedente, falta, encerramento residual | SL-02, SL-03 | Antes de JD-01 |
| Novo | Campos materiais e alçadas | Lista de 17.4 e matriz de alçadas | 17.4 | Antes de JD-01 |

---

## Anexo A Estrutura mínima da regra

| Bloco | Campos mínimos |
|---|---|
| Identidade | Código, nome, tipo, versão, status e responsável |
| Vigência | Início, fim, competência e política para fatos retroativos |
| Aplicabilidade | Dimensões obrigatórias, prioridades, exclusões e fallback |
| Entradas | Campos, fonte, unidade, precisão, obrigatoriedade e validação |
| Cálculo | Fórmula, ordem, arredondamento, limites, mínimos e máximos |
| Saídas | Valor, moeda, unidade, título, obrigação, custo, lançamento e status |
| Governança | Aprovação, segregação, evidência, motivo de exceção e auditoria |
| Testes | Casos normais, limites, negativos, retroativos, estorno e reprocessamento |

Regras de política (sem fórmula) podem omitir Cálculo, mas nunca Governança e Testes.

---

## Anexo B Tabelas de referência

Valores de prática de mercado e normas de classificação. Não homologados.

### B.1 Conversão de unidades

| Unidade | Soja | Milho |
|---|---|---|
| Saca | 60 kg | 60 kg |
| Tonelada | 1.000 kg | 1.000 kg |
| Bushel | 27,2155 kg (1 sc = 2,2046 bu) | 25,4012 kg (1 sc = 2,3621 bu) |

### B.2 Combinações válidas de preço

| Valor | Moeda | Unidade de preço | Modalidade |
|---|---|---|---|
| 128,50 | BRL | saca | Fixo |
| 24,80 | USD | saca | Fixo |
| 1.245,00 | BRL | tonelada | Fixo |
| CBOT maio + 35 cents | USD | bushel | A fixar com prêmio |
| B3 soja + 1,20 | USD | saca | A fixar com prêmio |
| Indicador regional | BRL | saca | A fixar sem prêmio |

### B.3 Soja

| Parâmetro | Base | Limite de recebimento | Método |
|---|---|---|---|
| Umidade | 14,0% | 18% a 20% | Peso mais secagem |
| Impurezas | 1,0% | 3% a 5% | Peso |
| Avariados (total) | 8,0% | 15% a 20% | Preço |
| Ardidos e queimados | 4,0% (queimados 1%) | 6% a 8% | Preço |
| Mofados | 6,0% | 8% a 10% | Preço |
| Esverdeados | 8,0% | 15% | Preço |
| Partidos e quebrados | 30,0% | Sem limite usual | Preço leve ou tolerado |
| Transgenia | Conforme contrato | Rejeição se segregado | Teste |

### B.4 Milho

| Parâmetro | Base | Limite de recebimento | Método |
|---|---|---|---|
| Umidade | 14,0% | 18% a 22% | Peso mais secagem |
| Impurezas | 1,0% | 3% a 5% | Peso |
| Ardidos e queimados | 2,0% a 3,0% | 6% a 8% | Preço |
| Avariados (total) | 6,0% | 10% a 15% | Preço |
| Quebrados | 3,0% a 5,0% | Sem limite usual | Preço leve |
| Carunchados | 2,0% a 3,0% | 5% a 8% | Preço |
| Micotoxinas | Conforme destino | Rejeição acima do limite do comprador | Laudo |

### B.5 Exemplos numéricos ilustrativos

- Umidade: 36.540 kg a 16,2%, base 14%: 36.540 × 2,2 ÷ 86 = 934,7 kg descontados.
- Câmbio: 609 sc × US$ 24,35 = US$ 14.829,15; × 5,4321 = R$ 80.553,52.
- Fixação: CBOT 1.050 cents/bu, prêmio US$ 1,20/sc: (1.050 ÷ 100) × 2,2046 + 1,20 = US$ 24,35/sc.
- Retenção: R$ 45.000 × 0,2% = R$ 90 retidos e R$ 90 de obrigação.
