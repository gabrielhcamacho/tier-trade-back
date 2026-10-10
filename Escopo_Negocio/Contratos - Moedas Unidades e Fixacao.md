# Contratos de compra e venda: moedas, unidades e fixação

**Objetivo:** definir o que precisa estar escrito para que um contrato de compra ou venda de soja e milho seja controlado corretamente quando quantidade, preço, câmbio e liquidação usam dimensões diferentes (saca, tonelada, quilo, bushel; real e dólar; preço fixo e a fixar).
**Relação com os demais documentos:** complementa o Escopo de Negócio 1.1 (itens 9, 10 e 16), o Plano de Fases 1.2 (premissas do item 3) e o Catálogo 1.0. Nenhum deles define as regras abaixo; todos as mencionam como capacidade.
**Status:** proposta de regras e lista de decisões. Valores numéricos são ilustrativos até homologação com a trading piloto.
**Data:** 8 de outubro de 2026.

---

## 1. Por que este tema merece documento próprio

O contrato é o objeto que alimenta saldo, carga, estoque, posição, liquidação, fiscal e contabilidade. Se ele for modelado com uma única moeda e uma única unidade, todo o resto herda a limitação. Hoje o código conhece apenas a saca de 60 kg e o real; os documentos prometem dólar, PTAX, tonelada e preço a fixar sem dizer como convivem.

Em trading de grãos, um mesmo contrato combina até quatro dimensões independentes:

| Dimensão | O que define | Exemplo |
|---|---|---|
| Unidade de quantidade | Em que unidade a obrigação de entrega é medida | 1.000 toneladas |
| Unidade de preço | Em que unidade o preço é expresso | US$ por saca de 60 kg |
| Moeda de preço | Moeda em que o preço é negociado | Dólar |
| Moeda de liquidação | Moeda em que o pagamento acontece | Real, convertido por PTAX |

A essas quatro somam-se dois eventos que podem ser separados no tempo: a **fixação do preço** (quando o preço em dólar passa a ser conhecido) e a **fixação do câmbio** (quando a taxa de conversão para real passa a ser conhecida). Um contrato pode ter preço fixado e câmbio aberto, câmbio fixado e preço aberto, ambos abertos ou ambos fixados, e tudo isso parcialmente, por lotes.

Há ainda a **saca como denominação de obrigação**: adiantamentos, trocas de insumo por produção e algumas garantias são expressas em sacas, não em dinheiro. A obrigação é "entregar N sacas", e seu valor monetário só existe quando uma referência de preço é aplicada. O sistema precisa tratar a saca como uma denominação própria, com saldo e conversão, e não apenas como unidade de medida.

Se essas dimensões não forem separadas desde o modelo de dados, o sistema terá de ser refeito quando o primeiro contrato em dólar entrar.

---

## 2. O que os documentos atuais dizem e o que não dizem

| Documento | O que afirma | O que falta |
|---|---|---|
| Escopo 1.1, item 9.1 | "BRL, USD e outras moedas; unidade por quilograma, tonelada, saca e conversões controladas." | Tabela de conversão, precisão, arredondamento, qual unidade é canônica. |
| Escopo 1.1, item 9.2 | Câmbio: "fonte, tipo de taxa, data, casas decimais e evento de conversão". | Quais valores assumir para cada um desses campos. Qual PTAX, qual data, quantas casas. |
| Escopo 1.1, item 10.3 | Preço: "modalidade, moeda, unidade, fórmula, fixações, PTAX, índice, prêmio". | Como as fixações se relacionam com as entregas e qual preço vale para cada carga. |
| Plano 1.2, item 3 | "BRL como moeda de liquidação; USD e PTAX quando necessários à formação de preço." | Se um contrato pode liquidar em dólar; se adiantamento pode ser em dólar ou saca. |
| Plano 1.2, item 21.2 | Cenário de protótipo: "contrato a fixar com fixação parcial, PTAX ou referência aplicável e saldo remanescente." | As regras que o protótipo deveria demonstrar. |
| Catálogo 1.0 | Fórmula de valor bruto da carga "convertida para a unidade de preço". | A conversão em si e o tratamento de câmbio. |
| Multitenancy 1.1, item 9.1.2 | Tipos Money, UnitPrice, Quantity, FxRate com precisão decimal. | Boa base técnica, mas sem regra de negócio sobre quando converter e arredondar. |
| decisions-pending.md (D02) | "Preço a fixar e fixações parciais: base, prêmio, câmbio e cenários homologados." | É a única menção concreta. Está bloqueada por falta deste conteúdo. |

---

## 3. Unidades de quantidade e conversão

### 3.1 Regras propostas

1. **Unidade canônica interna:** quilograma. Todo saldo, movimento de estoque e peso de carga é armazenado em quilogramas com precisão decimal. Saca, tonelada e bushel são apresentações e unidades de contrato, nunca o valor armazenado.
2. **Unidade contratual:** cada contrato declara a unidade em que a quantidade foi negociada e a quantidade nessa unidade. O sistema armazena ambas: a quantidade contratual na unidade declarada e o equivalente canônico em quilogramas.
3. **Tabela de conversão versionada por commodity**, com vigência, porque o peso do bushel depende do produto:

| Unidade | Soja | Milho | Observação |
|---|---|---|---|
| Saca (sc) | 60 kg | 60 kg | Padrão brasileiro. Sacas de 50 kg existem em outras culturas, não no recorte. |
| Tonelada (t) | 1.000 kg | 1.000 kg | Unidade usual em contratos de exportadores e indústrias. |
| Bushel (bu) | 27,2155 kg | 25,4012 kg | Unidade da CBOT. 1 sc de soja = 2,2046 bu; 1 sc de milho = 2,3621 bu. |

4. **Arredondamento de conversão:** conversões intermediárias não arredondam. O arredondamento ocorre uma vez, no valor final apresentado ou liquidado, com a escala definida pela regra de liquidação. O sistema registra escala e modo usados.
5. **Saldo em unidade contratual:** o saldo exibido ao usuário é na unidade do contrato, derivado do saldo canônico. A diferença de arredondamento entre as duas apresentações precisa ser explicada na memória de cálculo, nunca ajustada por lançamento manual.
6. **Tolerância em unidade contratual:** a tolerância de entrega (ver item 7) é declarada em percentual ou na unidade do contrato e convertida para quilogramas para comparação.

### 3.2 Decisões a tomar

- Confirmar se algum contrato da trading piloto usa saca de peso diferente de 60 kg.
- Confirmar se há contratos com quantidade em bushel (típico de operação com trading internacional) ou se bushel só aparece na referência de preço.
- Definir a precisão de armazenamento (sugestão: quilograma com três casas decimais, suficiente para romaneio de balança).

---

## 4. Preço: moeda, unidade e modalidade

### 4.1 Estrutura do preço

Todo preço contratual precisa carregar quatro atributos obrigatórios: valor, moeda, unidade de preço e modalidade. Exemplos válidos:

| Valor | Moeda | Unidade de preço | Modalidade |
|---|---|---|---|
| 128,50 | BRL | por saca 60 kg | Fixo |
| 24,80 | USD | por saca 60 kg | Fixo |
| 1.245,00 | BRL | por tonelada | Fixo |
| CBOT maio + 35 cents | USD | por bushel | A fixar, com prêmio |
| B3 soja + 1,20 | USD | por saca 60 kg | A fixar, com prêmio |
| Indicador regional + 0 | BRL | por saca 60 kg | A fixar, sem prêmio |

A unidade de preço pode ser diferente da unidade de quantidade. Contrato de 1.000 toneladas com preço em dólar por saca é comum. A conversão acontece na liquidação, usando a tabela do item 3.

### 4.2 Preço fixo

Regra simples: o valor por unidade de preço é conhecido na assinatura. Se a moeda do preço for diferente da moeda de liquidação, o contrato ainda tem câmbio aberto (ver item 5).

### 4.3 Preço a fixar

Um contrato a fixar precisa definir, na assinatura:

| Campo | O que define | Decisão necessária |
|---|---|---|
| Referência | Qual mercado e qual contrato: CBOT soja, CBOT milho, B3 soja, B3 milho, indicador regional nomeado | Quais referências a trading usa |
| Vencimento de referência | Qual mês do contrato futuro serve de base | Regra de rolagem quando o vencimento expira antes da fixação |
| Prêmio ou base | Valor somado ou subtraído da referência, com moeda e unidade próprias | Se o prêmio é fixado na assinatura ou pode ser fixado depois, separadamente |
| Quem fixa | Comprador, vendedor ou ambos, por notificação | Forma e horário de corte da notificação |
| Janela de fixação | Data inicial e data limite | O que acontece se ninguém fixar até o limite |
| Lote mínimo de fixação | Quantidade mínima por evento de fixação | Se pode fixar fração de carga |
| Preço médio | Se o contrato liquida pelo preço médio ponderado das fixações ou por fixação alocada a entregas | Ver item 6 |

**Fixação parcial:** cada evento de fixação registra quantidade fixada, valor da referência, prêmio aplicado, data, hora, quem fixou e evidência (tela de bolsa, mensagem, confirmação). O saldo a fixar diminui. O contrato pode ter dezenas de fixações.

**Regra de não fixação:** o contrato deve prever uma das três consequências para saldo não fixado no vencimento da janela: fixação automática pela referência de fechamento do último dia; prorrogação com custo; ou washout do saldo. Hoje nenhum documento diz qual.

### 4.4 Conversão da referência para a unidade de preço

Quando a referência está em cents por bushel e o preço contratual é em dólar por saca:

```
preço_usd_por_saca = (referência_cents / 100) × bushels_por_saca + prêmio_usd_por_saca
```

Com soja a 1.050 cents/bu e prêmio de US$ 1,20/sc: (1.050 / 100) × 2,2046 + 1,20 = 24,35 US$/sc. O sistema registra os três componentes (referência, fator de conversão vigente, prêmio) e o resultado sem arredondar; o arredondamento ocorre na liquidação.

---

## 5. Câmbio

### 5.1 Separar preço de câmbio

Um contrato com preço em dólar e liquidação em real tem dois riscos independentes: o preço da commodity e a taxa de câmbio. O sistema precisa tratar a fixação de câmbio como evento próprio, com saldo próprio.

| Estado | Preço | Câmbio | Valor em real |
|---|---|---|---|
| Aberto | A fixar | A fixar | Estimado por referência de mercado e câmbio de mercado |
| Preço fixado | Fixado | A fixar | Conhecido em dólar, estimado em real |
| Câmbio fixado | A fixar | Fixado | Taxa conhecida, valor em dólar estimado |
| Fechado | Fixado | Fixado | Conhecido |

Cada estado pode ser parcial. É normal um contrato de 1.000 t ter 600 t com preço fixado e 400 t com câmbio fixado, sem sobreposição exata.

### 5.2 Regras de câmbio que o contrato precisa declarar

| Campo | Opções usuais | O que falta decidir |
|---|---|---|
| Fonte | PTAX do Banco Central, taxa negociada com banco, taxa contratual fixa | Qual é o padrão da trading piloto |
| Tipo | PTAX de venda ou de compra | Compras de produtor costumam usar PTAX de venda; confirmar |
| Data de referência | Dia da fixação, dia útil anterior à fixação, dia útil anterior ao pagamento, dia da emissão da nota | Esta é a decisão mais importante. Mudar a data muda o valor pago |
| Casas decimais | PTAX é publicada com quatro casas | Se o contrato pode usar taxa com mais ou menos casas |
| Fixação por travamento | Contrato de câmbio com banco (trava) vinculado ao contrato de grão | Se o sistema registra a trava e a usa como taxa de fixação |
| Arredondamento | Escala do valor final em real | Sugestão: centavos, após a multiplicação, uma única vez |

### 5.3 Fórmula de conversão para liquidação

```
valor_brl = quantidade_elegível_kg ÷ kg_por_unidade_de_preço × preço_moeda_origem × taxa_câmbio
```

Arredondar apenas o resultado, para centavos. A memória guarda os cinco fatores.

Exemplo ilustrativo: carga de 36.540 kg, preço US$ 24,35/sc, PTAX de venda 5,4321:
36.540 ÷ 60 = 609 sc; 609 × 24,35 = US$ 14.829,15; × 5,4321 = R$ 80.553,52.

### 5.4 Dia não útil e ausência de cotação

Se a data de referência cair em dia sem publicação de PTAX (fim de semana, feriado nacional), o contrato precisa dizer se usa o dia útil anterior ou o posterior. A regra deve ser atributo do contrato, com padrão por tenant.

---

## 6. Como fixações se ligam a entregas

Este é o ponto que mais gera divergência entre trading e contraparte, e nenhum documento o aborda.

Quando um contrato de 1.000 t tem três fixações a preços diferentes e vinte cargas entregues, qual preço vale para cada carga? Há três métodos praticados:

| Método | Regra | Vantagem | Risco |
|---|---|---|---|
| Preço médio ponderado | Todas as cargas liquidam pelo preço médio das fixações, recalculado a cada nova fixação | Simples de explicar | Cargas já pagas precisam de ajuste quando entra fixação nova |
| Alocação por ordem (fila) | A primeira carga consome a primeira fixação, e assim por diante | Cada carga tem preço definitivo no momento da entrega | Exige que exista fixação disponível antes da entrega, ou a carga fica com preço pendente |
| Alocação explícita | O usuário vincula fixações a cargas ou períodos | Reflete acordo comercial | Exige trabalho manual e regra para o que não foi alocado |

O sistema precisa suportar ao menos um método como padrão por contrato e registrar qual foi usado. A escolha afeta:

- Quando o título a pagar pode ser gerado (precisa de preço definitivo ou aceita provisório).
- Como a margem realizada é calculada por carga.
- Se há ajuste retroativo e como ele aparece em título complementar ou dedução.

**Carga entregue sem fixação:** o sistema precisa de um estado "entregue, preço pendente", com valor provisório por referência de mercado para estoque e posição, e bloqueio de liquidação até a fixação. O Escopo 26 não tem esse estado.

---

## 7. Saldos de um contrato multidimensional

Um contrato em dólar a fixar tem, no mínimo, estes saldos, todos derivados de eventos e nunca editáveis:

| Saldo | Unidade | Evento que reduz | Evento que aumenta |
|---|---|---|---|
| Quantidade contratada | kg (canônico) e unidade contratual | Cancelamento parcial, washout | Aditivo de volume |
| Quantidade a fixar (preço) | kg | Fixação de preço | Estorno de fixação |
| Quantidade a fixar (câmbio) | kg ou valor em moeda | Fixação de câmbio | Estorno |
| Quantidade programada | kg | Carga confirmada | Programação |
| Quantidade entregue e aceita | kg | Rejeição, estorno de recebimento | Recebimento aceito |
| Quantidade faturada | kg | Cancelamento de NF-e | Emissão de NF-e |
| Quantidade liquidada | kg | Estorno de liquidação | Liquidação aprovada |
| Valor fixado | moeda do preço | Estorno | Fixação |
| Valor convertido | moeda de liquidação | Estorno | Fixação de câmbio |
| Adiantamento em aberto | moeda de liquidação ou sacas | Amortização por carga | Novo adiantamento |

Regras:

- Entrega aceita nunca pode exceder quantidade contratada mais tolerância sem aditivo.
- Fixação nunca pode exceder quantidade contratada.
- Quantidade liquidada nunca pode exceder quantidade aceita e com preço definitivo.
- Tolerância (por exemplo, mais ou menos 5%) aplica-se à quantidade contratada; o excedente entregue dentro da tolerância liquida pelo preço do contrato; o que exceder a tolerância exige decisão (novo negócio, preço de mercado, recusa). Hoje o percentual e a consequência não estão definidos.

---

## 8. Adiantamentos e obrigações denominadas em sacas

### 8.1 Adiantamento em dinheiro

Adiantamento em real ou dólar contra contrato de compra. Precisa de: valor, moeda, data, juros (taxa e base), forma de amortização (proporcional à quantidade entregue, percentual fixo por carga, ou integral na primeira carga), garantia exigida e tratamento quando o produtor não entrega (vencimento antecipado, cobrança, execução de garantia).

Amortização proporcional, regra sugerida:

```
amortização_carga = adiantamento_total × (quantidade_aceita_carga ÷ quantidade_contratada)
```

Com ajuste final na última carga para zerar o resíduo de arredondamento.

### 8.2 Obrigação em sacas

Casos em que o contrato diz "o produtor entregará 2.000 sacas de soja em pagamento dos insumos" ou "adiantamento equivalente a 500 sacas". A saca é a denominação; o valor monetário depende de uma referência de preço em data definida.

Regras mínimas:

- O saldo da obrigação é mantido em sacas (ou quilogramas canônicos), não em real.
- A conversão para valor contábil usa uma referência de preço declarada no contrato (preço do dia da assinatura, preço de mercado na data de balanço, preço fixado do contrato principal).
- A obrigação em sacas é amortizada por entrega física, pela quantidade, independentemente do preço no dia da entrega.
- Se a entrega não ocorrer, a conversão para dívida monetária usa a regra do contrato (preço de mercado na data do inadimplemento, por exemplo).

Isso é o núcleo do barter. O Plano de Fases deixou barter fora do MVP, mas o adiantamento em sacas é frequente em compra de produtor e deveria ser decidido explicitamente: dentro ou fora.

---

## 9. Posição e exposição decorrentes do contrato

Mesmo sem o módulo completo de risco (Fase 3), o contrato já precisa expor para o painel:

| Exposição | Como calcular | Precisa de |
|---|---|---|
| Preço (flat) | Quantidade com preço a fixar × referência de mercado atual | Fonte de preço de mercado por commodity |
| Base ou prêmio | Quantidade com prêmio aberto × diferença de prêmio de mercado | Fonte de prêmio por praça; pode ser manual no MVP |
| Câmbio | Valor fixado em dólar com câmbio aberto × câmbio de mercado atual | Fonte de câmbio de mercado |
| Entrega | Quantidade contratada menos entregue, valorizada | Já derivável dos saldos |

A posição líquida da trading é a soma de compras menos vendas em cada uma dessas dimensões. Sem a separação entre preço e câmbio no contrato, a exposição cambial fica invisível.

---

## 10. Reflexos fiscais e contábeis

| Tema | Regra que precisa existir |
|---|---|
| NF-e em real | O documento fiscal é emitido em real. Para contrato em dólar, a nota usa o valor convertido pela regra de câmbio do contrato na data definida. O sistema precisa registrar a taxa usada na nota e, se o pagamento usar taxa diferente (por exemplo, PTAX do dia anterior ao pagamento), tratar a diferença como variação cambial, não como divergência de conciliação. |
| Nota complementar | Se a fixação ocorre após a emissão de nota com valor provisório, pode ser necessária nota complementar. A regra de quando emitir e com qual base precisa de validação fiscal. |
| Variação cambial | Contrato em dólar com câmbio aberto gera variação cambial entre a data do fato gerador e a liquidação. O contador precisa definir se é reconhecida por competência mensal ou só na liquidação. |
| Valorização de contrato a fixar | Para fechamento mensal, contratos a fixar precisam de valor provisório. Regra de qual referência usar na data do balanço. |
| Adiantamento em sacas | Classificação contábil (adiantamento a fornecedor valorizado a preço de referência) e reavaliação periódica ou não. |
| Memória por carga | Toda liquidação guarda quantidade, fator de conversão de unidade, preço, referência, prêmio, taxa de câmbio, fonte e data de cada um. |

---

## 11. Estados que faltam no mapa de estados

O Escopo 26 lista para Contrato: minuta, revisão, assinatura, ativo, suspenso, encerrado. Para suportar o que está acima, faltam estados ortogonais (um contrato está em um estado de ciclo de vida e, ao mesmo tempo, em um estado de precificação):

| Eixo | Estados |
|---|---|
| Precificação | Fixo; a fixar sem fixação; parcialmente fixado; totalmente fixado; fixação vencida sem decisão |
| Câmbio | Não aplicável (moeda única); aberto; parcialmente fixado; totalmente fixado |
| Carga | Prevista; entregue com preço definitivo; entregue com preço pendente; liquidada |

Cada transição precisa de guarda (quem pode, qual evidência) e de evento de auditoria.

---

## 12. Modelo mínimo de dados (conceitual)

Sem fixar nomes físicos, o contrato precisa destas estruturas separadas:

- **Contrato:** partes, commodity, safra, quantidade contratual com unidade, equivalente em kg, tolerância, moeda de liquidação, regra de câmbio (fonte, tipo, data de referência, dia não útil), método de alocação de fixações, janela de entrega.
- **Termo de preço:** modalidade, moeda, unidade de preço, valor (se fixo), referência e vencimento (se a fixar), prêmio com moeda e unidade, janela de fixação, regra de não fixação, quem fixa.
- **Fixação de preço:** quantidade, referência capturada, prêmio aplicado, preço resultante, data e hora, autor, evidência, estado (ativa, estornada).
- **Fixação de câmbio:** quantidade ou valor, taxa, fonte, data de referência, data e hora, autor, evidência, vínculo com trava bancária se houver.
- **Alocação fixação para carga:** quando o método exigir.
- **Tabela de conversão de unidades:** commodity, unidade, kg por unidade, vigência.
- **Adiantamento:** moeda ou saca, valor ou quantidade, juros, regra de amortização, saldo.
- **Memória de liquidação:** todos os fatores do item 5.3 por carga, com versão da regra.

Toda quantidade e todo valor em decimal, conforme já definido na Arquitetura de Multitenancy 9.1.2.

---

## 13. Cenários que precisam ter resultado esperado antes da homologação

| ID | Cenário | O que verifica |
|---|---|---|
| CM-01 | Compra de 1.000 t, preço R$ por saca, liquidação em real | Conversão tonelada para saca, arredondamento único |
| CM-02 | Compra de 10.000 sc, preço US$ fixo por saca, PTAX do dia útil anterior ao pagamento | Fixação de câmbio na liquidação, memória de taxa |
| CM-03 | Venda de 500 t a fixar contra CBOT com prêmio em cents/bu, três fixações parciais | Conversão bushel para saca, saldo a fixar, preço médio ou alocação |
| CM-04 | Carga entregue antes da fixação | Estado "preço pendente", valor provisório, bloqueio de liquidação |
| CM-05 | Preço fixado em dólar, câmbio travado com banco em data diferente | Dois eventos de fixação independentes, taxa da trava prevalece |
| CM-06 | Entrega 4% acima do contratado, tolerância de 5% | Excedente liquida pelo preço do contrato |
| CM-07 | Entrega 8% acima, tolerância de 5% | Bloqueio e decisão para o excedente |
| CM-08 | Adiantamento de R$ 500 mil amortizado proporcionalmente em 25 cargas | Resíduo de arredondamento zerado na última carga |
| CM-09 | Adiantamento equivalente a 2.000 sacas, entrega de 1.200 sacas, saldo em sacas | Obrigação denominada em produto |
| CM-10 | Janela de fixação vence com saldo a fixar | Consequência contratual aplicada e auditada |
| CM-11 | NF-e emitida com PTAX de D-1 da emissão, pagamento com PTAX de D-1 do pagamento | Diferença tratada como variação cambial, não como divergência |
| CM-12 | Estorno de uma fixação após carga liquidada | Recálculo, título complementar ou dedução, histórico preservado |

---

## 14. Decisões abertas para a trading piloto

| Decisão | Quem responde | Bloqueia |
|---|---|---|
| Quais unidades de quantidade e de preço aparecem nos contratos reais (saca, tonelada, bushel) | Comercial | Tabela de conversão |
| Se há contratos em dólar no piloto e em que proporção | Direção | Escopo do câmbio no MVP |
| Fonte, tipo e data de referência da PTAX nos contratos existentes | Financeiro | Regra de câmbio |
| Referências de preço usadas (CBOT, B3, indicador) e regra de rolagem | Comercial | Modelo de fixação |
| Método de ligação entre fixações e cargas praticado hoje | Comercial e financeiro | Liquidação e margem por carga |
| Consequência contratual para saldo não fixado no prazo | Jurídico e comercial | Estado de fixação vencida |
| Percentual de tolerância e tratamento do excedente | Comercial | Saldos e bloqueios |
| Adiantamento em sacas: dentro ou fora do MVP | Direção | Modelo de obrigação em produto |
| Tratamento contábil de variação cambial e de contrato a fixar no fechamento | Contador | Eventos contábeis |
| Se NF-e em contrato em dólar usa taxa da emissão ou do pagamento | Fiscal | Nota complementar e conciliação |

---

## 15. Recomendação de sequência

1. Fechar as unidades e a tabela de conversão. É pré-requisito de tudo e não depende de ninguém de fora.
2. Separar, no modelo, moeda de preço de moeda de liquidação e criar o evento de fixação de câmbio, mesmo que o piloto comece só em real. Fazer isso depois custa migração de todo contrato existente.
3. Definir o método de ligação fixação-carga com a trading piloto e implementar um só, com o campo que permite outro no futuro.
4. Escrever os doze cenários acima com números homologados pela trading antes de codificar preço a fixar.
5. Só então liberar D02 no repositório.
