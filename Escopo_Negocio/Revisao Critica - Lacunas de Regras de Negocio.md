# Revisão crítica da documentação de negócio do Tier Trade

**Objetivo:** relacionar o que falta na documentação de escopo para que o sistema possa ser especificado, parametrizado e homologado sem regras implícitas.
**Base analisada:** Visão Completa 1.2, Escopo de Negócio Completo 1.1, Escopo do MVP e Plano de Fases 1.2, Catálogo de Regras e Cálculos do Piloto 1.0, Arquitetura Futura e Princípios de Domínio 1.2, Arquitetura de Multitenancy 1.1. Também foram consultados `docs/decisions-pending.md`, `docs/jd-pilot-homologation.md` e `docs/execution-plan.md` do repositório para medir a distância entre documento e implementação.
**Data:** 8 de outubro de 2026.

---

## 1. Leitura geral

Os documentos acertam no essencial: separam escopo de negócio de escopo de entrega, fixam princípios corretos (determinismo, vigência, memória de cálculo, origem, dupla consequência da retenção) e descrevem bem a cadeia econômica do contrato. O Anexo A do Catálogo define um bom formato de regra.

O problema é de **profundidade e de atualização**. Os seis documentos ficam no nível de capacidade ("o sistema deve controlar tolerância") e quase nunca descem ao nível de regra ("tolerância padrão de X%, excedente tratado assim, falta tratada assim"). O único documento que tenta ser rulebook, o Catálogo, tem menos de 2.000 palavras e contém uma única fórmula numérica, que é o exemplo da retenção de 0,2%.

Enquanto isso, o código já implementou liquidação, conciliação, comissão, estoque com titularidade, fiscal de compra e venda e margem realizada. Ou seja, **o desenvolvimento está decidindo regras de negócio que a documentação não registrou**. Toda regra que hoje está só no código precisa voltar para o documento, ou o piloto será homologado contra algo que ninguém escreveu.

As três lacunas mais graves, em ordem:

1. **Não existe glossário nem definição operacional dos termos centrais** (peso líquido, peso descontado, quebra, saldo, praça, base, prêmio, lote, competência). Em produto de domínio pesado, isso gera interpretação divergente entre trading, desenvolvedor e contador.
2. **A camada fiscal foi adiada em bloco**, mas nem o inventário de fatos fiscais do recorte (UF, documentos, CFOPs, incidências, obrigações acessórias) existe. Sem inventário, não há como dimensionar o que é nativo e o que é integrado, decisão que todos os documentos listam como aberta.
3. **Regras de preço, qualidade, tolerância e liquidação não têm fórmula, ordem de aplicação, arredondamento nem valor padrão**. São exatamente os cálculos que o piloto da JD vai conferir contra a planilha.

---

## 2. Lacunas por domínio

Legenda da coluna "Impacto": **Bloqueia piloto** quando a JD não consegue homologar sem a regra; **MVP** quando a regra é necessária antes da Fase 3; **Produto** quando pode ficar para depois, mas precisa estar documentada como decisão.

### 2.1 Glossário e definições operacionais

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Não há glossário em nenhum dos seis documentos. | Termos como "peso líquido", "quantidade elegível", "saldo", "lote", "praça", "base", "prêmio", "competência", "materialidade" aparecem sem definição. O código já escolheu significados (por exemplo, SC_60KG como única unidade). | Bloqueia piloto |
| Peso bruto, tara, peso líquido, peso descontado (após umidade e impureza) e peso para pagamento não são distinguidos. | A liquidação, a NF-e e o estoque usam pesos diferentes. Sem definição, a conciliação dos cinco lados não tem referência. | Bloqueia piloto |
| "Quantidade elegível" é usada na fórmula de liquidação sem dizer como é obtida. | É o número que multiplica o preço. | Bloqueia piloto |
| Hierarquia de saldos (contratado, fixado, programado, carregado, recebido, aceito, faturado, liquidado) é listada, mas sem dizer qual evento move cada um e qual é o saldo que libera pagamento. | Cada saldo precisa de regra de atualização, senão o painel mostra números que ninguém sabe explicar. | MVP |

### 2.2 Formação de preço e fixação

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Tabela de conversão de unidades (saca 60 kg, tonelada, quilo, bushel para soja e milho) e regra de arredondamento por conversão não existem. O documento diz "conversão versionada" e o código só conhece SC_60KG. | Contratos reais da JD usam toneladas e sacas no mesmo documento (o próprio Escopo 1.1 reconhece isso no item 29). | Bloqueia piloto |
| Para preço a fixar: qual referência (B3, CBOT, indicador regional), qual vencimento, quem tem o direito de fixar, janela de fixação, lote mínimo, o que acontece se não fixar até o prazo. | O piloto começou com preço fixo, mas a Fase 1 do plano inclui "a fixar" e o Prompt de Design pede cenário de fixação parcial. | MVP |
| Câmbio: qual PTAX (compra, venda, data D ou D-1), em que evento é travado (fixação, emissão da nota, pagamento) e com quantas casas. | O documento só diz "PTAX quando necessário". | MVP |
| Preço médio ponderado em fixações parciais: fórmula e arredondamento. | Sem isso a fixação parcial não tem resultado reproduzível. | MVP |
| Base e prêmio: definidos no contrato ou na fixação? Variam por praça e por período de entrega? | Decide se o sistema guarda base como atributo do contrato ou da fixação. | MVP |
| Fórmula de washout (diferença entre preço contratado e preço de mercado na data) e quem pode acioná-lo. | Washout aparece em quatro documentos como consequência, nunca como cálculo. | Produto |

### 2.3 Qualidade e classificação

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Nenhuma tabela de referência de qualidade para soja e milho, nem como padrão provisório (umidade, impurezas, avariados, ardidos, quebrados, esverdeados, mofados). O documento delega tudo ao piloto. | Mesmo que a JD traga a tabela dela, o produto precisa de um padrão para a segunda trading e para o protótipo. | Bloqueia piloto |
| Método de desconto por parâmetro: desconto de peso (quebra física por umidade e impureza) ou desconto de preço (percentual sobre o valor)? Ordem de aplicação quando há vários? Sequencial ou somado? | Dois métodos dão resultados diferentes sobre a mesma carga. É o cálculo que mais gera divergência com a planilha. | Bloqueia piloto |
| Taxa de secagem e quebra de secagem quando o grão entra úmido: quem paga, fórmula do peso seco. | Comum em milho. Afeta estoque e custo. | MVP |
| Contraprova: prazo, quem paga a análise, laboratório, o que acontece com a carga enquanto espera. | Está listada como capacidade, sem regra. | MVP |
| Rejeição no destino após viagem: devolução, NF-e de devolução, frete de retorno, quem arca. | Caso real frequente. Nenhum documento trata a carga rejeitada depois de ter saído. | MVP |
| Qualidade de lote misturado: média ponderada por parâmetro? | Estoque e expedição dependem disso para formar a qualidade do que sai. | MVP |

### 2.4 Saldo contratual, tolerância e encerramento

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Percentual de tolerância padrão e tratamento do excedente (compra a preço de contrato, a preço de mercado ou recusa) e da falta (multa, washout, prorrogação). | "Tolerância" aparece em oito trechos, nunca com valor ou consequência. | Bloqueia piloto |
| Regra de encerramento com saldo residual: a partir de que percentual o contrato pode encerrar sem aditivo? | Encerramento administrativo é previsto, mas sem critério. | MVP |
| Quebra de safra e força maior em compra de produtor: redução proporcional com laudo? Prazo para comunicar? | Cláusula padrão de contrato de compra de produtor; ausente dos documentos. | Produto |

### 2.5 Liquidação e pagamento

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Ordem de aplicação dos componentes: desconto de qualidade, frete, adiantamento, retenção. A base da retenção é antes ou depois dos descontos? | O Catálogo dá a fórmula do líquido, mas não a ordem. Com retenção calculada sobre base errada, o exemplo de R$ 90 por carga vira perda acumulada. | Bloqueia piloto |
| Peso oficial para pagamento: origem ou destino? Tolerância de quebra de transporte e o que acontece quando o peso de destino diverge da NF-e (nota complementar, devolução simbólica). | Impacta liquidação, fiscal e frete ao mesmo tempo. | Bloqueia piloto |
| Marco inicial do prazo de pagamento: data da descarga, da emissão da NF-e, do aceite da qualidade ou da entrega do último documento? | O contrato da JD diz "pagamento após descarga e documentos", o sistema precisa saber qual evento inicia a contagem. | Bloqueia piloto |
| Juros e multa por atraso de pagamento e de entrega: fórmula, índice, base. | Previsto como "motor de penalidade", sem parâmetro. | MVP |
| Adiantamento a produtor: juros, amortização proporcional por carga, garantia exigida, tratamento quando o produtor não entrega. | Adiantamento está na fórmula de liquidação, mas as regras foram empurradas para "barter", que está fora do MVP. Contradição. | MVP |
| Pagamento a terceiro e cessão de crédito: documento exigido, aprovação, validação de titularidade da conta. | Mencionado em dois documentos como "com aprovação", sem regra. | MVP |
| Dias úteis e feriados para vencimento: feriado estadual e municipal da praça de pagamento contam? | Calendário é citado como cadastro, não como regra de vencimento. | MVP |

### 2.6 Fiscal e tributário

Esta é a maior lacuna. Os documentos dizem corretamente que nada entra em produção sem validação profissional. Mas validação profissional precisa de um **inventário** para validar, e ele não existe.

| Lacuna | Por que importa | Impacto |
|---|---|---|
| UF do piloto não está clara. Os documentos citam FETAB e IAGRO; o repositório cita FETHAB (Mato Grosso) e IAGRO (agência de Mato Grosso do Sul). FETAB não existe com esse nome. | Se o piloto é MT, a agência é INDEA e o fundo é FETHAB. Se há operação em MS, é outro pacote fiscal. Precisa de correção e decisão. | Bloqueia piloto |
| Inventário de documentos fiscais do recorte: quem emite a nota na compra de produtor (NF-e do produtor ou nota de entrada da trading), contranota, nota complementar, carta de correção, cancelamento e seus prazos, manifestação do destinatário. | Sem isso não dá para decidir "nativo ou integrado". | Bloqueia piloto |
| Catálogo mínimo de CFOPs para compra, venda interna, venda interestadual, remessa e retorno de armazenagem, devolução. | O motor exige CFOP como dimensão de contexto, mas nenhum documento lista os CFOPs do recorte. | Bloqueia piloto |
| ICMS em soja e milho: diferimento nas operações internas com produtor, encerramento do diferimento na venda interestadual ou para indústria, responsabilidade da trading pelo ICMS diferido. | É passivo fiscal relevante que nasce na venda e precisa aparecer na margem. Não é mencionado. | Bloqueia piloto |
| Funrural e SENAR: diferença entre produtor pessoa física (retenção pelo adquirente) e pessoa jurídica (recolhimento próprio), opção pela folha como atributo temporal, base de cálculo. | O Catálogo trata como "entrada para descoberta". O Escopo 19.1 acerta ao exigir a opção como atributo comprovável, mas não define a consequência de cada caso. | Bloqueia piloto |
| PIS e COFINS: suspensão na venda de grãos para agroindústria, crédito presumido, regime da trading (lucro real ou presumido). | Afeta preço de venda e margem. Ausente. | MVP |
| Obrigações acessórias do recorte: EFD-Reinf (obrigatória para retenção de Funrural), SPED Fiscal, EFD-Contribuições, apuração estadual. | Os documentos falam em "obrigações acessórias compatíveis com o recorte" sem nomear nenhuma. Decide integração com contador ou software fiscal. | MVP |
| Frete: CT-e e MDF-e por tipo de transportador (empresa, frota própria, autônomo), CIOT, pagamento eletrônico de frete, retenções sobre frete de autônomo, piso mínimo de frete da ANTT. | Frete é custo direto do contrato e tem regras fiscais próprias. Só CT-e e MDF-e são citados. | MVP |
| Notas de serviço de classificação e armazenagem (NFS-e) e tributos municipais. | São componentes do razão de custos e geram documento próprio. | MVP |
| Armazenagem de terceiros: remessa e retorno simbólicos, Certificado de Depósito Agropecuário e Warrant quando houver. | Estoque depositado é modalidade do MVP. Não há regra documental. | MVP |

### 2.7 Logística e frete

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Responsabilidade de frete e de risco em trânsito por condição comercial (FOB origem, CIF destino, posto armazém). | Decide quem paga frete, quem absorve quebra de transporte e em que momento transfere o risco. Os documentos citam "FOB, CIF e demais" sem matriz. | Bloqueia piloto |
| Unidade e composição da tarifa de frete (R$/t, R$/saca, pedágio incluso ou não), adiantamento de frete e saldo na entrega. | Necessário para o razão de custos e para o CT-e. | MVP |
| Quebra de transporte: tolerância e desconto do frete quando excedida. | Prática padrão. Ausente. | MVP |
| Estadia: franquia em horas, tarifa, marco inicial, quem paga em cada caso. O contrato analisado tem isso; o documento só diz "motor de cálculo". | Precisa dos parâmetros para virar regra testável. | MVP |

### 2.8 Estoque

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Método de valorização do estoque para a margem realizada (custo médio ponderado, FIFO, custo específico por lote). O código hoje rateia o custo da compra proporcionalmente ao peso expedido, o que é uma escolha de método que nenhum documento registra. | A margem realizada, principal entrega do MVP, depende dessa escolha. Precisa estar escrita e validada pelo contador. | Bloqueia piloto |
| Quebra técnica de armazenagem: percentual por período, quem absorve, quando é reconhecida. | Está listada como "perdas", sem regra. | MVP |
| Momento do reconhecimento do estoque: no recebimento aceito, na emissão da NF-e ou na transferência de titularidade? | Afeta estoque, contabilidade e posição. O Catálogo diz "conforme política" sem propor a política. | MVP |
| Estoque depositado por terceiro na trading: gatilhos de cobrança de armazenagem, transferência de titularidade por venda do depositante. | Cerealistas e armazenadores são público-alvo declarado. | MVP |

### 2.9 Contratos, obrigações e alçadas

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Lista de "campos materiais" cujo ajuste invalida a aprovação anterior. | O Escopo 6.1 cria a regra, mas não diz quais campos são materiais. | Bloqueia piloto |
| Estrutura proposta da matriz de alçadas (faixas de valor, volume, margem mínima, desvio de política), mesmo que os números venham da JD. | Sem estrutura, a JD não sabe o que entregar. | Bloqueia piloto |
| Catálogo de tipos de aditivo e qual deles exige nova aprovação, nova assinatura ou recálculo de obrigações. | "Aditivo" é citado como evento genérico. | MVP |
| Regras de inadimplemento: percentual de multa, base (saldo não entregue ou valor total), vencimento antecipado. | Os dois contratos analisados têm essas cláusulas; o documento registra que elas existem, não o que fazem. | MVP |
| Cessão de contrato e troca de titularidade. | Listado em dois documentos, sem regra. | Produto |

### 2.10 Crédito e risco de contraparte

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Como a exposição por contraparte é calculada (adiantamentos em aberto, volume contratado a preço de mercado, títulos vencidos) e o que o estouro de limite bloqueia (novo negócio, carga, pagamento). | "Limite de crédito" é citado como cadastro. Nenhum documento define exposição. | MVP |
| Checklist mínimo de KYC por tipo de contraparte (produtor PF, produtor PJ, corretor, transportador) e o que bloqueia quando vencido. | Está como capacidade. Precisa de lista. | MVP |

### 2.11 Comissões

O Catálogo cobre bem beneficiário, base, gatilho e estorno. Faltam:

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Tributação da comissão externa (retenções sobre corretor PJ e PF, documento exigido do corretor). | A comissão paga gera obrigação tributária própria, que o Catálogo não menciona. | MVP |
| Comissão em contrato cancelado, washout ou entrega parcial: estorno total, proporcional ou mantida? | O Catálogo lista como "condição" sem propor regra padrão. | MVP |

### 2.12 Contabilidade

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Esboço do plano de contas do piloto e dos lançamentos por evento (mesmo com contas provisórias). | O Catálogo mapeia evento para consequência, mas sem débito e crédito não há como o contador validar. | MVP |
| Política de reconhecimento: estoque no aceite ou na nota; custo da mercadoria vendida; ICMS diferido como passivo; provisão de comissão. | Decide a margem contábil versus a gerencial. | MVP |
| Definição de margem gerencial versus margem contábil e quais componentes entram em cada uma. | O código já calcula "margem realizada gerencial". O documento não diz o que ela exclui. | MVP |
| Checklist de fechamento mensal. | O gate da Fase 3 exige fechamento reconciliado; não há lista do que fechar. | MVP |

### 2.13 Conciliação e tolerâncias

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Tolerâncias padrão por tipo de divergência (peso contrato x ticket, ticket x NF-e, NF-e x título, título x banco) e qual ação cada uma bloqueia. | O Escopo e o Catálogo repetem "tolerância configurada" oito vezes sem um valor padrão ou matriz de bloqueio. | Bloqueia piloto |
| Prazo máximo de um caso de reconciliação aberto e escalonamento. | Caso sem prazo vira fila eterna. | MVP |

### 2.14 Estados e eventos

| Lacuna | Por que importa | Impacto |
|---|---|---|
| Máquinas de estado só listam estados, sem transições, guardas e quem pode executar cada transição. Vale para Negócio, Contrato, Obrigação, Programação, Carga e Liquidação. | Estado sem transição não é regra testável. | MVP |
| Faltam estados para Título, Documento fiscal, Obrigação tributária, Lote de estoque, Ordem de frete e Caso de reconciliação. | Esses objetos existem no código e na cadeia econômica, mas não no mapa de estados do Escopo 26. | MVP |

### 2.15 Posição e risco

Está corretamente adiado para a Fase 3, mas falta a definição mínima: o que é "posição" no MVP (contratado menos entregue? fixado menos vendido?), o que é exposição a preço versus a base, e qual fonte de preço alimenta o MTM. Sem isso, o painel executivo prometido na Fase 3 não tem número para mostrar.

---

## 3. Inconsistências entre documentos

| Inconsistência | Onde | O que decidir |
|---|---|---|
| Barter e adiantamentos aparecem como **incluídos** no MVP na Visão 1.2 (item 13.1) e como **fora do MVP** no Plano de Fases 1.2 (item 19 e premissas do item 3). | Visão x Plano | Fixar: adiantamento simples dentro, barter fora. Documentar em um único lugar. |
| FETAB e IAGRO (documentos) versus FETHAB e IAGRO (repositório). FETHAB é de MT, IAGRO é de MS, INDEA é de MT. | Catálogo 7, Escopo 19.1, decisions-pending | Corrigir nomes e definir a UF do piloto. |
| O Catálogo 1.0 referencia Visão 1.1, Escopo 1.1 e Plano 1.1. As versões vigentes são 1.2. O Plano 1.2 referencia Multitenancy 1.0; o arquivo é 1.1. | Cabeçalhos | Alinhar referências cruzadas a cada revisão. |
| O piloto decidido é JD, Mato Grosso, preço fixo, quatro cenários (JD-01 a JD-04). Os documentos de negócio ainda descrevem Fase 1 com preço a fixar, duas tradings (referência e contraste) e cenários P01 a P08. | decisions-pending x Plano x Catálogo | Publicar revisão do Plano e do Catálogo refletindo o piloto real. |
| Três taxonomias de módulos diferentes: Arquitetura Futura (identity, operations, agriculture, benchmark...), Multitenancy (Commercial, Contracts, Execution, Inventory, Finance, Tax and Accounting, Risk, Platform) e o código (auth, commercial, control-plane, documents, finance, fiscal, inventory, operations, risk). | Arquitetura Futura 11 x Multitenancy 9 x `src/` | Escolher uma e referenciá-la nos demais. |
| Arquitetura Futura 1.2 é majoritariamente um documento do Mountier Agro (talhões, safras, pecuária, benchmark). O Tier Trade aparece em quatro subseções acrescentadas. O modelo financeiro canônico dele (FinancialEvent com INFLOW/OUTFLOW) não é reconciliado com título, obrigação tributária e componente de custo do Catálogo. | Arquitetura Futura 5 x Catálogo 4 e 5 | Separar o documento por produto ou declarar que o FinancialEvent não se aplica ao Tier Trade. |
| O Plano exige backup, PITR e restauração ensaiada como critério de aceite (itens 15 e 16). O repositório registra produção em Supabase Free sem backup automático, por decisão. | Plano 16 x decisions-pending D10 | Ou o critério de aceite muda, ou a decisão D10 é revertida antes da virada. Não pode ficar dos dois jeitos. |
| A Visão diz que agentes atuam "nos níveis observar, preparar e executar". A matriz de ações automáticas, com aprovação e proibidas está aberta nos quatro documentos. | Visão 13.1 x decisões abertas | Produzir a matriz, mesmo que inicialmente só com "observar" e "preparar". |

---

## 4. Documentos que faltam na própria sequência prevista

Os documentos preveem uma sequência de doze etapas. As etapas 1, 2, 3, 5 e 6 existem. Faltam:

- **Especificação Funcional V1.0.** É onde campos, estados, cálculos, permissões e exceções deveriam estar. O repositório tem documentos de slice que fazem esse papel parcialmente, mas são técnicos e não foram validados pelo negócio.
- **Prompt de Design e protótipo navegável.** O gate da Fase 0 exige que usuários de todas as funções completem as jornadas no protótipo. Não há registro de que isso aconteceu.
- **Data Model e API Specification** como documento de negócio legível (o OpenAPI existe no código).
- **Glossário** (não previsto na sequência, mas necessário).
- **Catálogo de regras expandido.** O Anexo A define a estrutura de uma regra. Nenhuma regra foi escrita nesse formato. O Catálogo deveria ter uma entrada por regra: código, vigência, aplicabilidade, entradas, fórmula, arredondamento, saídas, testes.
- **Matriz de autonomia da IA.**
- **Inventário fiscal do recorte** (documentos, CFOPs, incidências, obrigações acessórias, quem emite o quê).

---

## 5. O que o Gabriel precisa primeiro

Em ordem de desbloqueio do piloto da JD:

1. **Glossário e definição de pesos e saldos** (seção 2.1). Uma página resolve metade das ambiguidades.
2. **Regras de qualidade e desconto** com método, ordem e arredondamento, usando a tabela da JD e um padrão provisório para o produto (2.3).
3. **Ordem de cálculo da liquidação**, peso oficial e marco do prazo de pagamento (2.5).
4. **Inventário fiscal de MT para soja e milho**, com correção dos nomes de fundo e agência (2.6). Isso é o insumo que o contador vai validar.
5. **Tolerâncias padrão e matriz de bloqueio** (2.13), porque é o que faz o sistema impedir pagamento errado, a promessa central do produto.
6. **Método de valorização do estoque** e definição de margem gerencial, para que a margem realizada que já está no código tenha respaldo (2.8 e 2.12).
7. **Revisão do Plano de Fases e do Catálogo** para refletir JD, MT, preço fixo e os cenários JD-01 a JD-04, resolvendo as inconsistências da seção 3.

Os itens de Produto (washout, cessão, quebra de safra, hedge) podem esperar, desde que registrados como decisão adiada e não como regra implícita.
