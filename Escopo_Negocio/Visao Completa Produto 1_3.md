# Visão Completa do Produto 1.3

**Produto:** Tier Trade, nome provisório do ERP independente de trading agrícola e commodities da Mountier Agro.
**Escopo inicial:** soja e milho no mercado brasileiro.
**Cobertura:** comercial, contratos, operação física, estoque, risco, financeiro, fiscal e contábil, com execução orientada por agentes de IA.
**Status:** produto implementado no recorte do primeiro piloto e em homologação com a JD; documento revisado para orientar produto, arquitetura, especificação, comercialização e implantação.
**Referências:** Escopo de Negócio 1.1, Escopo do MVP e Plano de Fases 1.3, Catálogo de Regras e Cálculos 1.1, Arquitetura de Multitenancy 1.1, Arquitetura Futura e Princípios de Domínio 1.2.
**Data:** 8 de outubro de 2026.

**O que muda em relação à versão 1.2.** A 1.2 descrevia um produto a construir. A 1.3 descreve um produto que existe no recorte do primeiro piloto e precisa ser homologado, vendido e implantado. Alinha o escopo inicial do MVP (item 13) ao Plano 1.3, resolvendo a divergência sobre barter, adiantamentos e cessões. Incorpora à tese e aos módulos as regras que o Catálogo 1.1 consolidou: contrato multidimensional (unidade, moeda, câmbio e fixação separados), peso físico e comercial, cadeia de reconciliação com beneficiário, cessões. Corrige a referência a fundos e agências fiscais. Atualiza o modelo comercial e os riscos com o que o piloto já ensinou. Não altera tese, mercado, concorrência, princípios ou relação com o Mountier Agro.

**Convenção de nome.** Tier Trade identifica o produto. "Sistema de trading agrícola da Mountier Agro" identifica o contexto organizacional. Mountier Agro continua sendo o aplicativo independente voltado ao produtor, integrado por APIs e eventos autorizados.

---

## Índice

1. Decisões consolidadas
2. Ideia e tese do produto
3. Problema de mercado
4. Clientes e usuários
5. Panorama competitivo
6. Paridade mínima e espaço de diferenciação
7. Princípios do produto
8. Modelo operacional do ERP
9. Módulos e funções
10. Trabalho humano e trabalho da IA
11. Funcionamento interno dos agentes
12. Fluxos principais do dia a dia
13. Escopo inicial do MVP
14. Arquitetura de informação e mapa de telas
15. Relação entre Tier Trade e Mountier Agro
16. Modelo comercial e implantação
17. Métricas de validação
18. Riscos e decisões abertas
19. Sequência documental

---

## 1. Decisões consolidadas

| Tema | Decisão |
|---|---|
| Estrutura do produto | Produto próprio dentro do ecossistema Mountier, com site, plataforma, código e operação independentes |
| Integração | Comunicação com o Mountier Agro exclusivamente por APIs e eventos autorizados |
| Mercado inicial | Tradings, cerealistas e armazenadores que compram e vendem soja e milho no mercado brasileiro |
| Primeiro piloto | JD, Mato Grosso, compra e venda a preço fixo; cenários JD-01 a JD-04 validados pelos diretores |
| Fronteira do ERP | Comercial, contratos, execução física, armazenagem, logística, risco, hedge, financeiro, fiscal e contábil |
| Fora da primeira fronteira | RH, folha e gestão agronômica da propriedade |
| Fonte das regras | O Catálogo de Regras e Cálculos é o documento de homologação; nenhum número oficial existe sem regra codificada nele |
| Canal principal | Aplicação web; interfaces móveis complementares para aprovações, pátio, balança e campo quando agregarem valor |
| Estratégia de validação | Produto implementado no recorte, homologado com a trading de referência por cenários aceitos, operação paralela e virada por unidade; segunda trading depois da virada |
| Arquitetura SaaS | Multi-tenant híbrida por células, isolamento progressivo, configuração versionada sem fork |

---

## 2. Ideia e tese do produto

O Tier Trade é um ERP para tradings agrícolas que conecta originação, negociação, contratos, execução física, estoque, posição, risco, financeiro, fiscal e contabilidade em uma única operação auditável. Seu diferencial é operar parte relevante do trabalho administrativo e analítico com agentes de IA, preservando cálculos determinísticos, políticas de aprovação e responsabilidade humana sobre decisões materiais.

A oportunidade não está em apresentar os mesmos módulos com interface mais moderna. Os sistemas atuais registram processos complexos, mas pressupõem que pessoas leiam mensagens e documentos, preencham cadastros, reconciliem fontes, acompanhem pendências e investiguem divergências. O produto reduz esse trabalho e organiza a rotina em torno de ações, decisões e exceções.

### 2.1 Promessa central

Permitir que uma trading opere mais contratos por pessoa, com posição, margem, estoque e caixa atualizados, enquanto agentes executam tarefas repetitivas e encaminham apenas exceções e decisões relevantes. A promessa se materializa em três garantias verificáveis: o sistema impede pagamento incorreto; apropria todos os custos ao contrato; explica a margem sem reconstrução manual.

### 2.2 Forma de competir

- Cobrir o ciclo completo da operação para substituir o ERP no recorte definido.
- Usar a mesma fonte de verdade desde a negociação até a contabilização.
- Tratar o contrato como objeto multidimensional: unidade de quantidade, unidade de preço, moeda de preço, moeda de liquidação, fixação de preço e fixação de câmbio são dimensões separadas, com saldos próprios.
- Transformar documentos e conversas em trabalho executado, não em resumos.
- Oferecer implantação orientada por configuração: padrão de qualidade, matriz de alçadas, pacote fiscal, regra de câmbio e tolerâncias são parâmetros versionados por tenant.
- Conectar oferta autorizada do produtor ao ERP sem expor dados privados da operação rural.

---

## 3. Problema de mercado

A trading agrícola combina um negócio financeiro com uma operação física. Cada decisão comercial cria efeitos simultâneos em posição, risco de preço, logística, estoque, qualidade, caixa, fiscal e contabilidade. Quando esses efeitos são registrados em momentos diferentes ou em sistemas separados, surgem divergências, retrabalho e visão tardia do resultado.

### 3.1 Evidências validadas em entrevista e no piloto

A entrevista operacional e o trabalho com a JD confirmaram que o problema crítico está na continuidade entre os módulos e na ausência de regra escrita para os cálculos que mais importam.

- Parte do controle depende de planilhas e de uma pessoa capaz de reconstruir valores fiscais e financeiros manualmente.
- Logística e emissão ou vínculo de CT-e e MDF-e podem ficar fora do ERP e exigir controles paralelos.
- Retenções calculadas sobre base errada aumentam o valor pago ao fornecedor e acumulam perdas carga a carga.
- A diferença entre peso físico e peso comercial, e o método de desconto de qualidade, são as principais fontes de divergência entre trading e produtor, e raramente estão documentados.
- Frete, classificação, secagem, emissão documental, armazenagem e comissões precisam compor o custo direto do contrato.
- Contrato, nota, título, pagamento, tributo e lançamento contábil precisam reconciliar como uma única cadeia, inclusive quando o beneficiário do pagamento não é a contraparte do contrato.
- ERPs amplos cobrem mais funções, mas transferem complexidade para equipes dedicadas a alimentar telas.

| Problema | Consequência |
|---|---|
| Dados entram por WhatsApp, telefone, e-mail, PDF e planilha | Assistentes recadastram informações e o histórico fica incompleto |
| Contrato, carga, nota e pagamento são conferidos separadamente | Divergências aparecem tarde e exigem investigação manual |
| Regras de qualidade, tolerância e liquidação vivem na cabeça de uma pessoa | Cada carga é negociada de novo; o sistema não consegue impedir erro |
| Posição física e financeira depende de fechamento manual | O trader decide com informação atrasada ou parcial |
| Sistemas exigem navegação por muitas telas | O usuário descobre o que precisa fazer só depois de procurar |
| Regras variam por unidade, modalidade e alçada | Implantações viram projetos longos de customização |
| IA aparece como chat ou resumo | Conveniência sem redução real de trabalho |

---

## 4. Clientes e usuários

### 4.1 Cliente inicial

Trading, cerealista ou armazém de pequeno e médio porte que compra soja e milho de produtores ou intermediários, vende para indústrias, cooperativas, tradings maiores ou exportadores e precisa controlar contratos, entregas, estoques, preços, risco e liquidação no mercado nacional. A JD é a referência desse perfil.

### 4.2 Usuários

| Usuário | Responsabilidade principal | Valor esperado |
|---|---|---|
| Diretor ou sócio | Resultado, risco, caixa, limites, governança e parâmetros de política | Visão diária confiável e menor dependência de consolidação manual |
| Gestor comercial | Equipe, margem, aprovações, carteira, tolerância e condições de frete | Fila de decisões com contexto e impacto |
| Trader ou originador | Comprar, vender, precificar, fixar e administrar relacionamento | Menos cadastro e mais tempo de negociação |
| Contratos e backoffice | Formalização, documentos, assinaturas, obrigações, cessões | Minutas preparadas e pendências acompanhadas |
| Logística e operação | Agendamentos, cargas, transporte, recebimento, expedição, estadia | Programação integrada aos saldos e contratos |
| Balança e classificação | Peso, amostra, qualidade, descontos, contraprova, romaneios | Captura rápida, cálculo reproduzível e rastreabilidade |
| Risco e controladoria | Posição, exposição a preço e câmbio, hedge, MTM, P&L, limites | Exposição atualizada por evento |
| Financeiro, fiscal e contábil | Liquidação, títulos, beneficiários, notas, retenções, conciliação, escrituração | Processamento por exceção e vínculo com a origem |

---

## 5. Panorama competitivo

O mercado combina soluções de comercialização de commodities, ERPs agro, CTRMs globais e sistemas especializados de armazenagem. A comparação usa documentação pública dos fornecedores e descreve posicionamento aparente.

| Fornecedor | Força observada | Espaço percebido |
|---|---|---|
| TOTVS Agro Comercialização | Negociação, contratos, preços, risco, qualidade, armazenagem, execução, documentos e financeiro operacional; ampla aderência ao Brasil | Pode depender de ERP integrado para fiscal e backoffice; oportunidade em unificar operação e execução assistida por agentes |
| Senior SimpleFarm | Contrato físico detalhado, precificação, entregas, embarque, romaneio, pré-notas, antecipações e integração ERP | Fluxos amplos e configuráveis, centrados no preenchimento e acompanhamento por usuários |
| SAP ACM e Commodity Management | Contratos complexos, settlements, pricing engine, inventário, risco e integração contábil em escala | Implantação e complexidade elevadas criam espaço para produto brasileiro mais rápido e acessível |
| ION Agtech e CTRM | Trading, grain accounting, hedge, logística, armazenamento, settlement, posição e margens em tempo real | Referência internacional; exige localização fiscal e operacional brasileira |
| Siagri e Aliare | ERP agro brasileiro com contratos, armazenagem, cerealistas, comercial, fiscal e contabilidade | Base ampla e consolidada; oportunidade em experiência web moderna e trabalho executado por IA |
| Agrotis | Armazenagem, contratos, cobrança de serviços, financeiro, fiscal, comercial e logística | Forte aderência operacional; diferenciação na integração entre mesa, risco e agentes |
| BPSS | Front office, margens, risco e resultado de operações de commodities | Pode coexistir com ERP administrativo; espaço para fonte única ponta a ponta |
| Sankhya | ERP empresarial com aplicações agro, estoque, contratos e barter | Cobertura horizontal; oportunidade em profundidade específica da trading de grãos |

---

## 6. Paridade mínima e espaço de diferenciação

Para ser substituto real, o produto precisa de paridade no núcleo operacional. A IA gera vantagem depois que esse núcleo mantém saldos, posição e contabilização consistentes.

| Capacidade | Paridade obrigatória | Diferenciação proposta |
|---|---|---|
| Originação | Cadastro, histórico, ofertas e propostas | Captura multicanal, preenchimento automático e próxima ação preparada |
| Precificação | Preço fixo e a fixar, base, prêmio, câmbio, frete, custos e margem | Cenários explicados, validação contra política e posição, fixação de preço e de câmbio como eventos independentes |
| Contratos | Compra, venda, adiantamentos, garantias, aditivos, saldos, cessões | Contrato gerado e conferido contra a negociação; saldos derivados de eventos; parte vigente e beneficiário rastreáveis |
| Execução física | Agendamento, carga, peso, qualidade, romaneio, entrega e expedição | Peso físico e comercial distintos, desconto reproduzível, contraprova versionada, conciliação contínua |
| Armazenagem | Estoque próprio e de terceiros, serviços, quebras, secagem e transferências | Previsão de capacidade e alertas por compromissos futuros |
| Risco | Posição física e financeira, hedge, MTM, P&L e limites | Exposição a preço e câmbio derivada dos saldos do contrato; explicação causal |
| Financeiro | Liquidação, títulos, adiantamentos, pagamentos, recebimentos, conciliação | Ordem de cálculo declarada, fila de liquidações prontas, bloqueio por condicionante, exceções justificadas |
| Fiscal e contábil | Documentos fiscais, tributos, lançamentos e fechamento | Catálogo tributário versionado com memória; retenção com obrigação separada; classificação e conciliação assistidas |
| Gestão | Dashboards, relatórios, auditoria e permissões | Central diária de decisões, riscos e trabalho pendente; margem explicada por componente |

---

## 7. Princípios do produto

| Princípio | Aplicação |
|---|---|
| Uma operação, uma história | Negócio, contrato, carga, estoque, nota, pagamento, posição e lançamento permanecem vinculados |
| Cálculo reproduzível | Saldo, margem, posição, MTM, impostos, descontos e contabilização são produzidos por regras versionadas e codificadas no Catálogo |
| Saldo derivado | Nenhum saldo é editável; todo saldo é consequência de eventos |
| Dimensões separadas | Unidade, moeda, câmbio, fixação, peso físico e comercial, contraparte e beneficiário são atributos distintos, não derivados uns dos outros |
| IA com ferramentas | O agente atua por comandos autorizados, recebe respostas estruturadas e não altera dados por texto livre |
| Trabalho por exceção | Rotinas coerentes avançam automaticamente; pessoas recebem divergências e decisões materiais |
| Alçada antes da ação | Valor, risco, tipo de mudança e papel determinam se a ação executa, pede aprovação ou bloqueia; alteração de campo material invalida aprovação anterior |
| Proveniência visível | Documento, mensagem, integração, regra e pessoa responsáveis por cada dado ficam registrados |
| Multiempresa desde o início | Cada trading é isolada; grupos, filiais, armazéns e centros de resultado pertencem ao seu tenant |
| Configuração antes de customização | Modalidades, fórmulas, padrões de qualidade, aprovações, pacotes fiscais e políticas são configuráveis e versionados |
| Referência não é parâmetro | Valores de prática de mercado orientam a implantação; só valores homologados pela trading entram em produção |
| Fechamento sem planilha paralela | O MVP só é válido quando conclui o ciclo e apura resultado no próprio sistema |

---

## 8. Modelo operacional do ERP

A entidade central é o negócio comercial. Após aprovação, ele gera contratos e compromissos. Eventos físicos atualizam saldos e estoques; a classificação transforma peso físico em peso comercial; eventos de mercado atualizam posição e risco; eventos de fixação tornam conhecidos preço e câmbio; eventos financeiros e fiscais conduzem liquidação e contabilidade. O sistema mantém histórico imutável das mudanças relevantes e produz visões rápidas derivadas dessa base.

| Camada | Responsabilidade |
|---|---|
| Entradas | Telas, APIs, WhatsApp e e-mail integrados, documentos, balanças, market data, PTAX e instituições financeiras |
| IA documental e operacional | Extrair, classificar, relacionar, preparar comandos, acompanhar etapas e explicar exceções |
| Fluxos de trabalho | Estados, responsáveis, prazos, aprovações, filas e políticas de avanço |
| Motores determinísticos | Conversão de unidades, preço, câmbio, qualidade, estoque, posição, risco, liquidação, fiscal e contabilização, cada um com regra codificada |
| Registro oficial | Cadastros, negócios, contratos, fixações, movimentos, documentos, títulos, lançamentos e auditoria |
| Projeções e gestão | Dashboards, read models, relatórios, alertas, previsão e análises |

---

## 9. Módulos e funções

### 9.1 Central de operação

Painel por papel; fila de decisões, aprovações, exceções e tarefas; indicadores de posição, margem, contratos, cargas, caixa e fechamento; pesquisa global por contraparte, contrato, carga, nota ou título.

### 9.2 Identidade e administração

Empresas, filiais, unidades, armazéns e centros de resultado; usuários, papéis, capacidades, alçadas e segregação; parâmetros por commodity, unidade e modalidade; campos materiais; tabela de unidades; regras de câmbio; auditoria administrativa e suporte controlado.

### 9.3 Cadastros e contrapartes

Produtores, compradores, corretores, transportadores, armazéns, prestadores e cessionários; fazendas, locais, contas bancárias com validação de titularidade e documentos; perfil tributário com opção de recolhimento e vigência; limites comerciais e de crédito; vigência documental, duplicidades e relacionamento entre pessoas e empresas.

### 9.4 Originação e relacionamento

Carteira e território; ofertas recebidas e demandas de compra; histórico de contatos, visitas, propostas e recusas; agenda, follow ups e funil; canal de oportunidades do Mountier Agro mediante autorização.

### 9.5 Negociação e formação de preço

Compra, venda, permuta e intercompany; preço fixo e a fixar com referência, vencimento e prêmio; fixação total e parcial de preço e de câmbio; bolsa, base, prêmio, câmbio, frete, qualidade, despesas e custo financeiro; margem prevista e cenários; fluxo de aprovação e confirmação.

### 9.6 Contratos

Minutas e templates versionados; compra, venda, adiantamento e garantias; partes, parte vigente, itens, entregas, pagamentos, marco de pagamento e obrigações; quantidade em unidade contratual e canônica; termo de preço, fixações e método de alocação; tolerância e encerramento; aditivo, cessão de crédito, pagamento a terceiro, reaplicação de carga, transferência de saldo, washout, cancelamento e encerramento; assinatura e biblioteca documental.

### 9.7 Programação e logística

Janelas de entrega e retirada; agendamento, transportadora, veículo e motorista; cotação, contratação, tarifa e custo de frete; condição comercial e responsabilidade; quebra de transporte e estadia; rotas, instruções, ocorrências e prova de entrega; previsão de capacidade e atraso.

### 9.8 Pátio, balança e classificação

Chegada e fila; pesagem de entrada e saída com integração a equipamentos; amostragem, lacre e laudo versionado; padrão de qualidade por contrato com bases, limites e métodos; desconto de peso, desconto de preço, secagem; peso líquido físico e comercial; aceite, aceite condicionado, rejeição, contraprova e rejeição no destino; ticket e romaneio.

### 9.9 Armazenagem e estoque

Estoque físico, contábil, disponível e comprometido; próprio, terceiros, depositado e em trânsito; lotes, silos, transferências, mistura com qualidade ponderada, quebra de secagem e perda; serviços de recepção, secagem, limpeza e armazenagem; método de valorização declarado; previsão de ocupação e reconciliação.

### 9.10 Execução de contratos

Aplicação de cargas a contratos; saldos contratado, a fixar, programado, entregue e aceito, preço pendente, faturado e liquidado; tolerâncias, entregas parciais e sobras; vínculo compra venda e rastreabilidade; pendências de documentos e qualidade.

### 9.11 Posição, risco e hedge

Posição física por commodity, safra, praça, período e unidade; exposição a preço, base e câmbio derivada dos saldos a fixar; contratos futuros, opções e NDF quando aplicável; MTM, P&L, limites, stress e políticas de hedge; back to back, alocação e liquidação de posições.

### 9.12 Liquidação e financeiro

Cálculo com ordem declarada: valor bruto da carga, bonificações, deduções, adiantamentos, retenções, multas e líquido; peso oficial e divergência; condicionantes documentais e bloqueio; beneficiário e conta validada, inclusive cessionário; contas a pagar e receber, tesouraria e fluxo de caixa; conciliação bancária com tolerâncias por tipo de divergência; razão de custos por contrato, carga e lote separando previsto, comprometido, realizado, faturado e pago; comissões com regra, base, gatilho, competência, provisão, estorno e tributação; variação de margem explicada por componente.

### 9.13 Fiscal

Entrada, saída, remessa, retorno, armazenagem, devolução, remessa por conta e ordem e documentos de serviço; emissão, recebimento, validação e vínculo; catálogo tributário versionado por empresa, estabelecimento, UF, produto, operação, perfil da contraparte e vigência; retenção que reduz o líquido e gera obrigação tributária separada; inventário fiscal por UF com documentos, CFOPs, ICMS diferido, fundos e agências estaduais (FETHAB e INDEA em Mato Grosso), Funrural e SENAR, PIS e COFINS e obrigações acessórias; apuração e acessórias compatíveis com o recorte, nativas ou integradas.

### 9.14 Contabilidade e controladoria

Plano de contas, centros de resultado e períodos; lançamentos automáticos originados nos eventos; política de reconhecimento de estoque e método de valorização; competência, provisões, apropriações, variação cambial e valorização de contrato a fixar; fechamento, balancete, DRE gerencial e razão; margem gerencial e contábil conciliadas; resultado por negócio, mesa, unidade e commodity.

### 9.15 Documentos e comunicação

Biblioteca com versionamento e permissões; captura por upload, e-mail e integrações; assinatura eletrônica e solicitações externas; conversas vinculadas ao objeto; retenção, hash, origem e evidência; bucket privado com URLs temporárias.

### 9.16 Relatórios e inteligência

Painéis por papel; relatórios operacionais, financeiros, fiscais, contábeis e de risco exportáveis; rastreabilidade consolidada de oferta a resultado; análises narrativas com evidências; camada analítica derivada do transacional.

---

## 10. Trabalho humano e trabalho da IA

| Função atual | Execução automatizável | Responsabilidade humana |
|---|---|---|
| Assistente de originação | Ler conversas, cadastrar oferta, completar dados, atualizar histórico e preparar contato | Relacionar, negociar e validar intenção real |
| Backoffice comercial | Criar registro do negócio, contrato, checklist, assinatura e acompanhamento | Aprovar condições e exceções comerciais |
| Analista de contratos | Comparar negociação, minuta, aditivos e obrigações; cobrar pendências; conferir instrumento de cessão | Decidir cláusulas fora da política, cessões e disputas |
| Programador logístico | Sugerir agenda, frete e rota; cobrar confirmação e reprogramar dentro de regras | Negociar capacidade e tratar ruptura |
| Conferente administrativo | Cruzar peso, laudo, contrato, romaneio e nota; localizar divergência; preparar cenários de aceite condicionado | Validar contestação, contraprova e evidência física |
| Analista de liquidação | Preparar preço final, descontos, adiantamentos, retenções, títulos e conciliação | Aprovar exceções, beneficiários alternativos e pagamentos relevantes |
| Analista financeiro júnior | Conciliar banco, classificar movimento, cobrar pendência e projetar caixa | Autorizar movimentação e gerir tesouraria |
| Analista fiscal e contábil júnior | Validar documento, sugerir classificação e contabilização, reconciliar saldos | Responder por interpretação, fechamento e exceções tributárias |
| Analista de risco júnior | Consolidar posição, calcular exposição a preço e câmbio e investigar variações | Definir limites e estratégia de proteção |
| Gestor | Receber resumo causal, riscos priorizados e alternativas calculadas | Tomar decisões materiais, definir políticas e parâmetros, responder pelo resultado |

---

## 11. Funcionamento interno dos agentes

Cada agente é uma capacidade do ERP com objetivo, ferramentas, dados permitidos, política de ação, orçamento, níveis de confiança e trilha de auditoria. A identidade do agente não substitui a responsabilidade da organização; a autorização vem de políticas e alçadas configuradas. A matriz de ações automáticas, com aprovação e proibidas é decisão da direção antes da virada do piloto.

| Nível | Comportamento | Exemplo |
|---|---|---|
| Observar | Lê e organiza sem alterar o registro oficial | Resume mensagens e aponta dados ausentes |
| Preparar | Cria rascunho e solicita revisão | Monta negócio, minuta, liquidação ou cenário de aceite |
| Executar com aprovação | Prepara comando e aguarda responsável | Agenda pagamento, altera condição, registra cessão |
| Executar por política | Age automaticamente dentro de regra explícita e reversível | Solicita documento vencido, vincula arquivo inequívoco, concilia movimento exato |
| Bloquear e escalar | Interrompe quando risco ou inconsistência excede limite | Carga fora da tolerância, pagamento divergente, fixação vencida |

### 11.1 Agentes previstos

Originação, negociação, contratos, execução, logístico, liquidação, fiscal e contábil, risco e gestor, com as mesmas responsabilidades da versão 1.2.

### 11.2 Regras inegociáveis

- Modelos de linguagem não calculam números oficiais quando existe regra determinística.
- Toda ação usa ferramenta tipada e retorna resultado estruturado.
- O agente acessa somente dados e ações permitidos ao tenant, papel e caso de uso.
- A evidência de origem permanece acessível.
- Mudanças materiais exigem aprovação segundo valor, risco e segregação.
- Falha do provedor de IA não impede consulta nem operação manual.

---

## 12. Fluxos principais do dia a dia

### 12.1 Compra de grãos

1. A oferta chega pelo Mountier Agro, telefone, mensagem, e-mail, corretor ou cadastro direto.
2. A IA estrutura commodity, safra, praça, volume, unidade, janela, qualidade, preço, moeda e condições e solicita o que faltar.
3. O motor calcula cenários de preço, margem, logística, caixa e efeito na posição.
4. O trader negocia e submete o negócio à alçada adequada.
5. O contrato é gerado com termo de preço, padrão de qualidade, tolerância, condição de frete e marco de pagamento, revisado e assinado.
6. Entregas são programadas; cada carga produz peso físico, laudo, peso comercial e preço descontado; saldo e estoque são atualizados.
7. A liquidação é preparada na ordem declarada, conferida contra nota, aprovada, paga ao beneficiário correto e contabilizada.
8. Margem prevista e realizada ficam vinculadas ao mesmo negócio, com variação por componente.

### 12.2 Venda e alocação

1. O trader registra demanda ou contrato de venda com padrão de qualidade e destino, inclusive destinatário de entrega quando diferente do comprador.
2. O sistema verifica estoque, qualidade dos lotes, compras contratadas, janelas e custos de atendimento.
3. Posição e margem são atualizadas antes da aprovação.
4. Contratos de compra e lotes são alocados ao compromisso de venda.
5. Expedições e documentos reduzem saldo, geram títulos e atualizam resultado pelo método de valorização declarado.

### 12.3 Rotina diária por papel

| Papel | Primeira tela do dia |
|---|---|
| Trader | Ofertas novas, negociações esperando resposta, saldos a fixar, preço e margem, posição e limites |
| Contratos | Negócios sem minuta, assinaturas, obrigações, documentos vencendo, cessões a conferir |
| Operações | Agenda de cargas, ocupação, atrasos, cargas em contraprova, divergências de peso e qualidade |
| Financeiro | Liquidações prontas, bloqueadas por condicionante, divergentes, títulos do dia e conciliação |
| Fiscal e contábil | Documentos rejeitados, classificações pendentes, retenções a confirmar, conciliações e fechamento |
| Gestor | Riscos, decisões, margem, caixa, contratos críticos, parâmetros pendentes de aprovação e produtividade |

---

## 13. Escopo inicial do MVP

O MVP é completo no ciclo de soja e milho nacionais: uma operação selecionada nasce, executa, liquida e chega ao resultado e à contabilidade sem planilha paralela. A profundidade é limitada às modalidades e exceções cobertas. O detalhamento por onda está no Plano de Fases 1.3; esta seção o resume e substitui integralmente o item 13 da versão 1.2.

### 13.1 Primeiro piloto (Ondas A e B)

- SaaS multiempresa com filiais, unidades, armazéns, usuários, capacidades e alçadas.
- Soja e milho, mercado interno, Mato Grosso, real como moeda de preço e de liquidação.
- Compras e vendas spot e futuras a preço fixo.
- Adiantamento em dinheiro com amortização proporcional.
- Contratos, garantias, aditivos, assinaturas, saldos, tolerância, obrigações, cessão de crédito, pagamento a terceiro autorizado e reaplicação de carga.
- Programação, frete com condição comercial, pátio, pesagem, classificação com padrão da trading, secagem, contraprova, romaneio, recebimento e expedição.
- Armazenagem própria e de terceiros, serviços básicos e estoques com peso físico e comercial.
- Posição a entregar e exposição derivada dos saldos.
- Liquidação com ordem declarada, contas a pagar e receber, tesouraria, conciliação com tolerâncias e fluxo de caixa.
- Fiscal e contabilidade das operações cobertas, com pacote fiscal de Mato Grosso validado, fechamento e relatórios essenciais.
- Agentes de originação, contratos, execução, liquidação, risco e gestão nos níveis observar e preparar; execução por política após matriz aprovada.
- Integração autorizada com o Mountier Agro e importação de cadastros e saldos de implantação.

### 13.2 Extensão do MVP (Onda C)

- Preço em dólar com câmbio por regra declarada; liquidação em real.
- Preço a fixar com referência, prêmio, fixação parcial de preço e de câmbio, método de alocação de fixações a cargas.
- Washout e transferência de saldo entre contratos.
- Exposição a preço e a câmbio no painel.

### 13.3 Preparado para expansão

- Barter, obrigação em sacas e CPR.
- Cessão de posição contratual, venda à ordem, entrega em local diverso, back to back, intercompany e armazém com certificado de depósito. O modelo de contrato aceita os campos necessários desde o primeiro piloto, sem fluxo associado.
- Exportação, DU-E, LPCO, câmbio operacional e embarque marítimo.
- Café, algodão, açúcar, etanol, trigo, arroz e outras commodities.
- Opções, estruturas avançadas de hedge e gestão de navios.
- Folha de pagamento, RH, produção agrícola e manejo.

### 13.4 Critério de conclusão

O MVP está apto à virada quando: todo parâmetro do Catálogo usado no recorte tem valor homologado pela trading; os cenários de aceite foram executados com dados reais e aceite dos diretores; duas compras e duas vendas reais, com entregas parciais e diferença de qualidade, fecham de ponta a ponta reconciliadas com o legado; backup e restauração foram ensaiados; e a trading assina o termo de cobertura operacional.

---

## 14. Arquitetura de informação e mapa de telas

| Área | Telas |
|---|---|
| Central | Visão geral, Minha fila, Aprovações, Alertas, Pesquisa global, Rastreabilidade |
| Comercial | Carteira, Ofertas, Demandas, Negociações, Formação de preço, Fixações, Confirmações |
| Contratos | Lista, Detalhe, Minuta, Termo de preço, Fixações, Entregas, Saldos, Garantias, Aditivos, Cessões, Assinaturas, Comissões |
| Operações | Agenda, Pátio, Cargas, Balança, Classificação, Contraprova, Romaneios, Ocorrências, Transporte |
| Estoque | Posição por unidade, Lotes, Movimentos, Armazenagem de terceiros, Serviços, Secagem, Ocupação, Inventário |
| Risco | Posição, Exposição, Hedge, MTM, P&L, Limites, Cenários |
| Financeiro | Liquidações, Contas, Beneficiários, Tesouraria, Conciliação, Caixa, Inadimplência, Comissões |
| Fiscal | Documentos, Regras, Retenções, Obrigações, Apuração, Pendências |
| Contábil | Lançamentos, Conciliações, Fechamento, Balancete, DRE, Razão |
| Gestão | Resultados, Margem por contrato, Controladoria, Auditoria, Relatórios, Produtividade |
| Administração | Empresas, Unidades, Pessoas, Produtos, Padrões de qualidade, Unidades de medida, Regras de câmbio, Políticas, Alçadas, Campos materiais, Integrações |

### 14.1 Padrão de experiência

Cada área combina uma fila operacional com registros completos. A fila responde o que precisa ser feito agora; as telas de registro permitem inspeção, edição autorizada e auditoria. Toda memória de cálculo é exibida no objeto que a originou. A IA aparece no contexto do objeto e da tarefa, com evidência, ação proposta e impacto. Não há página isolada de assistente como centro do produto. Estados vazios explicam a próxima ação possível.

---

## 15. Relação entre Tier Trade e Mountier Agro

Produtos separados; nenhum acessa o banco do outro; vínculo por APIs versionadas, eventos assinados, consentimento e mapeamento explícito de identidades.

| Fluxo | Regra |
|---|---|
| Oportunidade do produtor | Somente campos publicados entram no mercado e são vistos pelas tradings autorizadas |
| Proposta da trading | Objeto próprio; não concede acesso à operação privada do produtor |
| Negócio aceito | Cada produto registra sua visão contratual e recebe eventos autorizados de status e execução |
| Produtor fora da plataforma | A trading cadastra e opera normalmente; o ERP não depende do aplicativo do produtor |
| Dados agregados | Uso analítico entre produtos exige finalidade, base jurídica, anonimização e governança |

---

## 16. Modelo comercial e implantação

A comercialização tende a combinar mensalidade SaaS, usuários ou faixas de volume, módulos avançados e serviço de implantação. A IA é precificada de forma que uso intensivo não destrua margem; o cliente compra resultado operacional, não tokens. Preços, planos de isolamento e implantação self-service são decisão posterior ao primeiro piloto (D12).

### 16.1 O que o piloto ensinou sobre implantação

A implantação é majoritariamente trabalho de negócio, não de software: coletar a tabela de qualidade, a matriz fiscal, os bancos, os aprovadores, as tolerâncias e as alçadas da trading, e homologar cada um. O serviço de implantação deve ser vendido e dimensionado como um projeto de parametrização do Catálogo, com responsáveis nominais do cliente por grupo de parâmetros.

### 16.2 Implantação proposta

1. Parametrização do Catálogo com valores do cliente, sem valores de referência.
2. Configuração de empresas, unidades, papéis, alçadas, modalidades, padrões de qualidade e pacote fiscal.
3. Importação de contrapartes com perfil tributário, contratos abertos, saldos, estoque, títulos e posição inicial, por lote reconciliado.
4. Integração com balanças, bancos, assinatura, documentos fiscais e fontes de mercado necessárias.
5. Execução dos cenários de aceite com os responsáveis do cliente.
6. Operação paralela ou coexistência deliberada com reconciliação diária.
7. Virada por unidade ou processo após critérios de consistência e termo de cobertura.
8. Acompanhamento e evolução das exceções para regras ou fluxos configuráveis.

A coexistência não é fracasso quando for decisão explícita de arquitetura e responsabilidade por domínio.

### 16.3 Modelo SaaS e isolamento

Arquitetura híbrida por células; célula compartilhada com isolamento por tenant como padrão; banco ou célula dedicada sem fork; tenant, empresa legal, estabelecimento, unidade e usuário distintos; Control Plane e Data Plane; PostgreSQL como fonte oficial com read models e relatórios assíncronos; pipeline de raw, staging, mapeamento, validação, efetivação e reconciliação; configurações versionadas por cliente. Detalhamento na Arquitetura de Multitenancy 1.1.

---

## 17. Métricas de validação

| Dimensão | Métrica |
|---|---|
| Homologação | Percentual de parâmetros do Catálogo com valor homologado; percentual de cenários executados com resultado conferido |
| Eficiência | Contratos, cargas e liquidações por pessoa e tempo médio por etapa |
| Automação | Percentual de tarefas concluídas automaticamente, preparadas pela IA e tratadas como exceção |
| Qualidade | Divergências por contrato, reprocessamentos, ajustes após pagamento, documentos rejeitados, diferença entre desconto de tabela e negociado |
| Velocidade | Tempo entre negociação e contrato, entrega e liquidação, fechamento e resultado |
| Confiabilidade | Diferença entre posição, estoque, financeiro e contabilidade durante operação paralela |
| Adoção | Usuários ativos por papel, tarefas na fila, planilhas paralelas retiradas da condição de fonte oficial |
| Resultado | Margem prevista versus realizada, perdas evitadas por bloqueio, pagamentos incorretos impedidos |

---

## 18. Riscos e decisões abertas

| Tema | Risco ou decisão | Código |
|---|---|---|
| Regras sem dono | O maior risco atual: parâmetros do Catálogo sem responsável nominal na trading atrasam a homologação mais do que qualquer desenvolvimento | D03 a D07, D13, D14 |
| Fiscal e contábil | Profundidade por regime, UF e modelo societário; inventário de Mato Grosso a validar; método de valorização e reconhecimento a confirmar com o contador | D05, D07 |
| Preço a fixar e câmbio | Referências, PTAX, alocação de fixações; sem decisão, a Onda C não inicia | D02 |
| Continuidade | Produção sem backup automático durante o piloto assistido; condição obrigatória da virada | D10 |
| Operação | Domínio, MFA, administradores, runbook e matriz de autonomia da IA antes do acesso não assistido | D11 |
| Barter e adiantamento em sacas | Decidir se entram na Onda C ou ficam para depois; frequentes em compra de produtor | D02 |
| Cessões e triangulares | Quais operações o cliente pratica; fluxo documental por UF | D13 |
| Migração | Fontes, qualidade dos dados e data de corte | D09 |
| Segunda trading | Critérios de seleção; risco de a JD virar o produto inteiro | D15 |
| Precificação | Unidade comercial do SaaS e custo de implantação como projeto de parametrização | D12 |
| Nome final | Confirmar Tier Trade ou outro nome; a troca não altera domínio, arquitetura ou contratos técnicos | D12 |
| Documentação | Visão, Escopo e Arquitetura Futura precisam de pequenas revisões de alinhamento; a Especificação Funcional está dispersa nos documentos de slice | Sequência documental |

---

## 19. Sequência documental

| Etapa | Documento | Estado |
|---|---|---|
| 1 | Visão Completa do Produto 1.3 | Este documento |
| 2 | Escopo de Negócio Completo 1.1 | Vigente; corrigir FETAB e IAGRO para FETHAB e INDEA na próxima revisão |
| 3 | Escopo do MVP e Plano de Fases 1.3 | Vigente |
| 4 | Catálogo de Regras e Cálculos 1.1 | Vigente; documento de homologação |
| 5 | Arquitetura Futura e Princípios de Domínio 1.2 | Vigente; separar conteúdo do Mountier Agro na próxima revisão |
| 6 | Arquitetura de Multitenancy Dados e Implantação 1.1 | Vigente |
| 7 | Especificação Funcional | Consolidar a partir dos documentos de slice após a Onda A |
| 8 | Data Model e API Specification | OpenAPI no repositório; versão legível por negócio pendente |
| 9 | Relatórios de execução por cenário | Onda A |
| 10 | Termo de cobertura operacional | Onda B |

### Fontes públicas consultadas

TOTVS Agro Comercialização, Senior SimpleFarm, SAP Agricultural Contract Management, ION Agtech, Siagri Agribusiness e Armazéns Gerais, Agrotis Armazenagem, BPSS, Sankhya ERP para Agronegócio, conforme listadas na versão 1.2. As descrições representam capacidades publicamente documentadas em setembro de 2026.
