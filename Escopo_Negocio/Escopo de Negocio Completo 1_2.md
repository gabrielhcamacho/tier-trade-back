# Escopo de Negócio Completo 1.2

**Produto:** Tier Trade, ERP para comercialização de commodities agrícolas.
**Abrangência:** produto-alvo completo, independente do recorte do MVP.
**Núcleo validado:** soja e milho no mercado brasileiro; primeiro piloto com a JD em Mato Grosso.
**Expansão prevista:** multi-commodity, exportação e instrumentos avançados.
**Relação com o MVP:** o recorte executável está no Escopo do MVP e Plano de Fases 1.3; as regras de cálculo e política estão no Catálogo de Regras e Cálculos 1.1.
**Data:** 8 de outubro de 2026.

**O que muda em relação à versão 1.1.** A fronteira do produto não muda. A 1.2 acrescenta o que a revisão crítica e os documentos temáticos mostraram que faltava como capacidade do produto-alvo: glossário de pesos, saldos e preço; contrato multidimensional com unidade, moeda, câmbio e fixação separados; peso físico e comercial com os métodos de desconto; ordem de cálculo da liquidação; capítulo próprio para cessões, transferências e operações triangulares; estados ortogonais e campos materiais; saldo derivado como princípio. Corrige FETAB e IAGRO para FETHAB e INDEA. Referencia os códigos de regra do Catálogo 1.1 onde a capacidade já tem regra escrita e alinha as decisões abertas aos códigos D02 a D15. Mantém a numeração da versão anterior e acrescenta dois capítulos ao final da sequência lógica, renumerando a partir do item 22.

---

## Índice

1. Decisão de estrutura documental
2. Objetivo e fronteira do produto
3. Princípios operacionais
4. Atores e responsabilidades
5. Objetos centrais do negócio
6. Organização e administração
7. Contrapartes e conformidade
8. Originação e relacionamento
9. Negociação e formação de preço
10. Gestão completa de contratos
11. Obrigações e cláusulas executáveis
12. Documentos, garantias e assinaturas
13. Programação logística e transporte
14. Pátio, balança e qualidade
15. Armazenagem e estoque
16. Execução, alocação e liquidação física
17. Posição, risco e hedge
18. Financeiro e tesouraria
19. Fiscal
20. Contabilidade e controladoria
21. Cessões, transferências e operações triangulares
22. Exportação e operações avançadas
23. Inteligência artificial e trabalho humano
24. Relatórios, indicadores e gestão
25. Integrações
26. Regras transversais e segurança
27. Estados e eventos de negócio
28. Fronteiras e exclusões
29. Critérios de completude do produto
30. Impactos dos contratos analisados e do piloto
31. Decisões abertas
32. Sequência documental
Anexo A Amostras contratuais consideradas
Anexo B Glossário mínimo

---

## 1. Decisão de estrutura documental

| Documento | Pergunta respondida | Abrangência |
|---|---|---|
| Visão Completa do Produto | Por que o produto existe e como pretende competir? | Tese, mercado, diferenciais, módulos e direção |
| Escopo de Negócio Completo | Que negócio o produto inteiro precisa operar? | Capacidades, regras, objetos, atores, eventos e fronteiras |
| Escopo do MVP e Plano de Fases | O que será homologado e virado primeiro e em qual ordem? | Recorte, jornadas, ondas, gates e critérios de aceite |
| Catálogo de Regras e Cálculos | Como cada cálculo e política funciona? | Regras codificadas, fórmulas, parâmetros, cenários e decisões |
| Especificação Funcional | Como cada fluxo e tela deve se comportar? | Campos, estados, permissões, exceções e aceite |

**Decisão.** Este documento descreve capacidades. Onde uma capacidade já tem regra escrita, cita o código do Catálogo. Onde não tem, a regra é débito do Catálogo, não deste documento.

---

## 2. Objetivo e fronteira do produto

O Tier Trade é o sistema operacional da trading agrícola. Registra e coordena o ciclo completo desde a oportunidade de compra ou venda até o contrato, execução física, estoque, posição, risco, liquidação, fiscal, contabilização e resultado.

### 2.1 Dentro da fronteira

- Originação, CRM comercial, ofertas, demandas, negociação e formação de preço em qualquer combinação de unidade, moeda e modalidade.
- Contratos de compra, venda, barter, intercompany, armazenagem, serviços, adiantamentos e garantias, incluindo cessões, transferências e operações triangulares.
- Logística, frete, agendamento, pátio, pesagem, classificação, recebimento, expedição e ocorrências.
- Estoque próprio, de terceiros, depositado, em trânsito, comprometido e disponível, com peso físico e comercial distintos.
- Posição física e financeira, exposição a preço, base e câmbio, hedge, marcação a mercado, limites e resultado.
- Liquidação, tesouraria, contas a pagar e receber com beneficiário, conciliação e fluxo de caixa.
- Documentos fiscais, apuração necessária ao recorte, escrituração, contabilidade e controladoria.
- Documentos, assinaturas, obrigações, garantias, compliance, auditoria e relatórios.
- Agentes de IA executando tarefas autorizadas dentro dos fluxos.

### 2.2 Cobertura por commodity

O produto-alvo é multi-commodity. Soja e milho são os primeiros pacotes validados. Outras commodities entram por pacotes próprios de unidade, padrão de qualidade, formação de preço, documentos, fiscal e execução. A inclusão de um nome de produto não caracteriza suporte operacional completo.

---

## 3. Princípios operacionais

| Princípio | Regra de produto |
|---|---|
| Uma operação, uma história | Negociação, contrato, obrigação, carga, estoque, documento, título, posição e lançamento permanecem ligados |
| Contrato executável | Condições contratuais geram regras, prazos, bloqueios, cálculos e evidências, não apenas um PDF arquivado |
| Evento antes de consolidação | Cada fato operacional atualiza saldos e projeções; fechamentos confirmam, não recriam a história |
| Saldo derivado | Nenhum saldo é editável; todo saldo é consequência de eventos com origem |
| Cálculo determinístico | Preço, peso, desconto, câmbio, multa, posição, imposto e contabilização usam regras versionadas e reproduzíveis, codificadas no Catálogo |
| Dimensões separadas | Unidade de quantidade, unidade de preço, moeda de preço, moeda de liquidação, fixação de preço, fixação de câmbio, peso físico, peso comercial, contraparte e beneficiário são atributos distintos |
| Referência não é parâmetro | Valores de prática de mercado orientam; só valores homologados pelo cliente entram em produção |
| IA com ferramentas | A IA interpreta, prepara e coordena; alterações oficiais ocorrem por comandos tipados, permissões e auditoria |
| Trabalho por exceção | Rotinas conformes avançam automaticamente; pessoas recebem divergências, decisões e riscos materiais |
| Configuração com governança | Templates, fórmulas, padrões, políticas, alçadas e documentos são configuráveis, versionados e aprovados |

---

## 4. Atores e responsabilidades

| Ator | Responsabilidade | Decisões reservadas | Parâmetros sob sua guarda |
|---|---|---|---|
| Direção | Resultado, caixa, risco, limites e governança | Políticas, exposição máxima, crédito, exceções materiais | Alçadas, campos materiais, lista de rejeição sem exceção, matriz de autonomia da IA |
| Gestão comercial | Carteira, margem, equipe e aprovação de negócios | Condições fora da política, limites e estratégia | Tolerância, condição de frete, referências de preço |
| Trader ou originador | Relacionamento, compra, venda, negociação e fixação | Intenção comercial, aceite das condições, fixações | |
| Contratos e jurídico | Minutas, cláusulas, obrigações, garantias, cessões e disputas | Cláusulas extraordinárias, cessões, litígios | Marco de pagamento, laudo que prevalece, documentação de cessão, consequência de não fixação |
| Logística | Programação, frete, rotas, capacidade e ocorrências | Reprogramações críticas, contratação, ruptura | Estadia, quebra de transporte |
| Pátio e qualidade | Entrada, pesagem, amostra, classificação e liberação | Contestação, reclassificação, rejeição excepcional | Padrão de qualidade, fórmulas de desconto, contraprova |
| Armazém | Movimentação, lotes, serviços, perdas e inventário | Ajustes e quebras fora de tolerância | Quebra de secagem, peso que consome saldo |
| Risco | Posição, exposição, hedge, MTM, limites e stress | Estratégia de proteção e instrumentos | Fontes de preço e câmbio de mercado |
| Financeiro | Liquidação, títulos, beneficiários, tesouraria e conciliação | Liberação de pagamento, conta e beneficiário | Ordem de cálculo, calendário, tolerâncias de conciliação, bancos |
| Fiscal e contábil | Documentos, classificação, impostos, lançamentos e fechamento | Tratamento tributário, reabertura, exceções | Inventário fiscal, retenções, plano de contas, valorização, reconhecimento |

---

## 5. Objetos centrais do negócio

| Objeto | Finalidade | Relações obrigatórias |
|---|---|---|
| Contraparte | Representar pessoas e empresas relacionadas à operação | Documentos, endereços, contas validadas, perfil tributário, risco, limites e papéis |
| Oportunidade | Registrar intenção ainda não vinculante | Origem, responsável, commodity, praça, volume, unidade e histórico |
| Cotação e cenário | Calcular preço e impacto antes da decisão | Referência, base, prêmio, câmbio, frete, qualidade, custos e margem |
| Negócio | Representar o acordo comercial aprovado | Partes, itens, termo de preço, execução, aprovações e versão das regras |
| Contrato | Formalizar direitos e obrigações | Negócio, partes e parte vigente, termo de preço, padrão de qualidade, tolerância, cláusulas, documentos, saldos, assinaturas e aditivos |
| Termo de preço | Definir como o preço é conhecido | Modalidade, moeda, unidade, referência, vencimento, prêmio, janela, regra de não fixação, método de alocação |
| Fixação | Tornar conhecido preço ou câmbio de uma quantidade | Contrato, quantidade, referência capturada, prêmio, taxa, data, autor, evidência |
| Obrigação | Transformar condição contratual em trabalho controlável | Responsável, prazo, condição, evidência e consequência |
| Programação | Planejar volumes e janelas | Contrato, local, capacidade, transportador e instruções |
| Carga | Registrar uma execução física | Veículo, motorista, pesos físico e comercial, laudo, documentos, origem e destino |
| Laudo | Registrar a classificação de uma carga ou lote | Carga, padrão, parâmetros medidos, classificador, versão, contraprova |
| Lote e estoque | Controlar identidade e disponibilidade física | Produto, qualidade ponderada, titularidade, custódia, localização e movimentos |
| Liquidação | Apurar o valor final devido | Quantidade elegível, preço descontado, câmbio, deduções, retenções, adiantamentos, beneficiário |
| Título | Representar direito ou obrigação financeira | Contrato, liquidação, beneficiário, vencimento, baixa |
| Posição | Consolidar compromissos e exposição | Commodity, safra, praça, período, saldos a fixar, câmbio e hedge |
| Componente de custo | Registrar custo previsto ou realizado | Contrato, carga ou lote, natureza, competência, documento, contraparte e apropriação |
| Comissão | Controlar remuneração comercial | Regra, beneficiário, base, condição, competência, aprovação, título, estorno, tributação |
| Obrigação tributária | Representar valor retido ou devido ao fisco | Regra, base, alíquota, documento, competência, vencimento, pagamento e lançamento |
| Evento de cessão ou transferência | Registrar mudança de parte, beneficiário, contrato ou destino | Instrumento, partes, contratos afetados, quantidades, valores, aprovação, versões |
| Caso de reconciliação | Tratar divergência entre fontes relacionadas | Contrato, carga, documento, título, banco, tributo, contabilização, tolerância e decisão |

---

## 6. Organização e administração

- Tenants isolados, grupos econômicos, empresas, filiais, estabelecimentos, armazéns, mesas e centros de resultado.
- Usuários, equipes, papéis, capacidades, alçadas, substituições temporárias e segregação de funções.
- Calendários, feriados nacionais, estaduais e municipais, fusos, dias úteis, moedas, unidades de medida e tabela de conversão versionada por commodity (UN-01).
- Catálogos de commodities, safras, cultivares, GMO ou não, padrões de qualidade versionados (QL-01), praças e locais.
- Parâmetros por empresa, unidade, operação, contraparte, commodity e vigência; regras de câmbio por tenant e por contrato (CX-01).
- Numeração, séries, templates, políticas, motivos de exceção, campos materiais e fluxos de aprovação.

### 6.1 Alçadas

Alçadas consideram valor financeiro, volume, margem, exposição, limite de crédito, tipo de alteração, instrumento, modalidade, contraparte, risco documental e segregação. Uma aprovação não é reutilizada depois que um campo material muda. A lista de campos materiais é configurável e tem padrão de produto (Catálogo 17.4). Cessão, washout, transferência com preço diferente, pagamento a terceiro e aceite condicionado têm alçadas próprias.

---

## 7. Contrapartes e conformidade

### 7.1 Cadastro e relacionamento

- Pessoa física e jurídica, grupo econômico, produtor, comprador, vendedor, corretor, transportador, armazém, terminal, prestador e cessionário.
- CNPJ ou CPF, inscrições, perfil tributário com condição de produtor rural e opção de recolhimento com vigência comprovada (TR-03), endereços, contatos, representantes, procurações, fazendas, locais operacionais e contas bancárias.
- Papéis simultâneos da mesma contraparte e relacionamento entre matriz, filial, sócio, fazenda e grupo.
- Histórico de negociações, contratos, volumes, qualidade recebida, pontualidade, contraprovas, disputas e ocorrências.

### 7.2 Compliance e crédito

| Controle | Capacidade |
|---|---|
| KYC e documentação | Checklist por tipo de contraparte, validade, fonte, aprovação, pendências e o que bloqueia quando vencido |
| Titularidade e ônus | Certidões, penhores, alienações, garantias, vínculos e impedimentos por origem ou estoque |
| Socioambiental | Origem declarada, imóvel, embargo, desmatamento, triangulação e evidências |
| Trabalhista e integridade | Declarações, listas restritivas, anticorrupção e trabalho proibido; aplicado também a cessionários e destinatários de entrega |
| Crédito | Limite, exposição calculada (adiantamentos em aberto, volume contratado a preço de mercado, títulos vencidos), garantias, bloqueios e revisões |
| Conta bancária | Titularidade validada, alteração com dupla validação e trilha; beneficiário alternativo só por cessão registrada ou autorização aprovada |

---

## 8. Originação e relacionamento

- Carteiras, territórios, produtores, intermediários, corretores, visitas, contatos e tarefas.
- Ofertas recebidas por tela, aplicativo do produtor, API, telefone, e-mail, mensagem ou documento.
- Demandas de compra e venda, campanhas, metas e prioridade por praça.
- Qualificação de commodity, safra, volume e unidade, origem, janela, qualidade, preço, moeda e condição.
- Histórico de propostas, contrapropostas, recusas, motivos e próximos passos.
- Detecção de duplicidade e conflito entre carteiras, ofertas e negociações.

### 8.1 Estados mínimos

Nova, incompleta, qualificada, em cotação, em negociação, aguardando resposta, aprovada, recusada, expirada, convertida e cancelada. Mudanças materiais preservam a versão anterior e o autor.

---

## 9. Negociação e formação de preço

### 9.1 Modalidades

- Compra, venda, intercompany, permuta, barter, armazenagem e prestação de serviços vinculada.
- Spot, entrega futura, preço fixo, preço a fixar, fixação parcial, preço médio e fórmulas parametrizadas.
- Moeda de preço e moeda de liquidação distintas; BRL, USD e outras; unidade de quantidade e unidade de preço distintas; conversões por tabela versionada (UN-01, UN-02).
- FOB, CIF, posto armazém e demais condições, com responsabilidades de frete, risco e custo.

### 9.2 Composição do preço

| Componente | Regra |
|---|---|
| Referência | Bolsa, indicador, preço regional ou valor direto, com fonte, vencimento, horário e regra de rolagem |
| Base e prêmio | Valor, moeda, unidade, praça, vigência e contraparte; fixado na assinatura ou separadamente |
| Câmbio | Fonte, tipo de taxa, data de referência, tratamento de dia não útil, casas decimais e evento de conversão (CX-01) |
| Frete e logística | Modal, rota, tarifa, pedágio, estadia, transbordo e custo de terminal |
| Qualidade | Bonificações, descontos de peso e de preço, rejeições e tolerâncias por padrão versionado |
| Financeiro | Prazo, adiantamento, custo de capital, impostos e despesas |
| Margem | Prevista, aprovada, realizada e explicação das variações |

### 9.3 Estrutura obrigatória do preço

Todo preço carrega valor, moeda, unidade e modalidade (PR-01). Contratos a fixar declaram referência, vencimento, prêmio, quem fixa, janela, lote mínimo, consequência de não fixação (PR-03) e método de ligação entre fixações e cargas: preço médio, fila ou alocação explícita (PR-04). Fixação de preço e fixação de câmbio são eventos independentes e parciais (PR-02, CX-02).

### 9.4 Controles

Antes da confirmação, o sistema mostra impacto em margem, posição, exposição a preço e câmbio, estoque, capacidade, limite de crédito e caixa. Condição fora de política segue para aprovação com motivo e diferença em relação ao parâmetro vigente.

---

## 10. Gestão completa de contratos

O contrato é uma estrutura versionada que liga termos comerciais, cláusulas, obrigações, saldos, documentos, aprovações e eventos de execução.

### 10.1 Ciclo de vida

1. Criar minuta a partir do negócio aprovado e do template vigente.
2. Comparar a minuta com a negociação e apontar campos ausentes ou divergentes.
3. Revisar cláusulas, anexos, garantias e responsáveis.
4. Aprovar por alçada e enviar para assinatura.
5. Ativar e gerar obrigações, saldos, limites, padrão de qualidade congelado e agenda.
6. Executar entregas, fixações de preço e câmbio, pagamentos, documentos e demais compromissos.
7. Formalizar aditivos, cessões, transferências, reaplicações, washout, compensação, cancelamento ou encerramento.
8. Arquivar a versão final com trilha e retenção.

### 10.2 Tipos de contrato

| Família | Cobertura |
|---|---|
| Compra e venda | Físico disponível, futuro, fixo, a fixar, parcial, em dólar, back to back, venda à ordem e intercompany |
| Barter e financiamento | Insumos por produção, equivalência, obrigação em sacas, CPR, adiantamento, garantias e liquidações vinculadas |
| Armazenagem e serviços | Depósito, recepção, secagem, limpeza, movimentação, expedição e cobrança |
| Logística | Frete, contratação, tabela, janela, estadia, ocorrência e desempenho |
| Instrumentos de risco | Futuros, opções, NDF, travas de câmbio e demais operações autorizadas |

### 10.3 Estrutura de dados contratuais

| Grupo | Informações |
|---|---|
| Identificação | Número interno e externo, empresa, filial, template, idioma, versão, datas, status e eixos de precificação e câmbio |
| Partes | Comprador, vendedor, parte vigente, intervenientes, representantes, destinatário da entrega, local de entrega, beneficiário do título |
| Produto | Commodity, tipo, GMO, safra, origem, especificação e padrão de qualidade congelado |
| Quantidade | Unidade contratual, quantidade na unidade, equivalente canônico em kg, tolerância, adicional, saldos e regras de variação |
| Preço | Termo de preço: modalidade, moeda, unidade, valor ou referência, vencimento, prêmio, fixações, método de alocação, regra de câmbio |
| Entrega | Período, disponibilidade, origem, destino, terminal, cadência, janela, modal, condição comercial e instruções |
| Qualidade | Padrão, parâmetros, limites, amostragem, aceite, desconto, bonificação, rejeição, contraprova e laudo que prevalece |
| Pagamento | Marco do prazo, dias úteis ou corridos, documentos condicionantes, conta, retenções, adiantamentos e prazo de cura |
| Risco e titularidade | Evento de transferência, custódia, depósito, seguro, força maior, quebra de safra e responsabilidades |
| Garantias | Tipo, valor, vigência, cobertura, documentos, substituição e liberação |
| Inadimplemento | Mora, multa, juros, correção, restituição, perdas, washout e vencimento antecipado, com fórmulas |
| Jurídico e compliance | Foro, lei, anticorrupção, LGPD, socioambiental, cessão e declarações |

---

## 11. Obrigações e cláusulas executáveis

Cada cláusula operacional pode produzir obrigações com parte responsável, condição de início, prazo, calendário, evidência, regra de conclusão, consequência do atraso, escalonamento e vínculo com a versão contratual.

| Exemplo de cláusula | Obrigação gerada | Resposta do sistema |
|---|---|---|
| Disponibilizar volume no primeiro dia | Confirmar disponibilidade até a data | Cobrar evidência, alertar risco e abrir exceção |
| Solicitar descarga com antecedência | Enviar solicitação por carga no prazo | Preparar solicitação, registrar envio e bloquear programação tardia |
| Pagamento após descarga e documentos | Confirmar ticket, laudo, CT-e, nota e demais requisitos | Liberar liquidação só com o checklist atendido (LQ-05) |
| Fixar até a data limite | Registrar fixações dentro da janela | Alertar, e no vencimento aplicar PR-03 |
| Alteração da origem por aditivo | Obter análise, aprovação e assinatura | Suspender carga da nova origem até a formalização |
| Estadia após franquia | Apurar horas elegíveis e documentação | Calcular valor, testar exclusões e encaminhar aprovação |
| Qualidade fora do padrão | Decidir rejeição ou aceite com desconto | Calcular cenários (QL-08) e registrar aceite de ambas as partes |
| Notificação de cessão | Conferir instrumento e conta do cessionário | Alterar beneficiário do título só após conferência (CS-01) |

### 11.1 Tipos de consequência

Alerta, cobrança, suspensão, bloqueio de carga, retenção de pagamento ou escalonamento; reprogramação, aditivo, alteração de preço, desconto, multa, juros, correção, washout e compensação; exigência de garantia, documento adicional, aprovação extraordinária ou tratamento jurídico.

---

## 12. Documentos, garantias e assinaturas

### 12.1 Documentos por evento

| Evento | Documentos possíveis |
|---|---|
| Cadastro | Societários, procurações, inscrições, certidões, dados bancários, opção de recolhimento, compliance |
| Contrato | Minuta, anexos, garantias, aprovações, aditivos, instrumentos de cessão, compensação e washout, comprovantes de assinatura |
| Programação e carga | Instrução, agendamento, ordem, RNTRC, CIOT, CT-e, MDF-e e comprovantes |
| Recebimento | Ticket de balança, laudo e versões, amostra lacrada, romaneio, comprovante de descarga e ocorrência |
| Fiscal | NF-e, notas complementares, remessa, retorno, remessa por conta e ordem, simbólicas, devolução, serviço, nota de débito e documentos de exportação |
| Titularidade e depósito | Certidões de ônus, certificado de depósito, warrant, termo de transferência e instrumento de depósito |
| Pagamento | Checklist, memória de cálculo, autorização, notificação de cessão, comprovante e conciliação |

### 12.2 Garantias

Garantias reais, fidejussórias, títulos, CPR, notas promissórias, cessões e outras estruturas. Para cada uma: emitente, beneficiário, objeto, valor, cobertura, prioridade, registro, vencimento, documentos, status, substituição, reforço e liberação. Cessão de posição exige substituição ou liberação aprovada.

### 12.3 Assinaturas

Assinatura eletrônica, certificado ICP-Brasil ou mecanismo aceito pela política. Registro de signatários, ordem, evidência, data contratual, data efetiva, recusas e expiração.

---

## 13. Programação logística e transporte

- Plano de entrega e retirada por contrato, período, dia, turno, local, modal e capacidade.
- Cadência mínima, máxima, acumulável ou não e instruções versionadas.
- Solicitação e aprovação de descarga, agendamento, reprogramação e no show.
- Cotação, contratação, tabela, ordem de frete, unidade da tarifa, pedágio, adiantamento e saldo; transportadora, veículo, motorista e rota.
- Condição comercial e responsabilidade por frete e risco em trânsito (CU-02).
- Origem, destino, destinatário de entrega quando diferente do comprador, transbordo, pátio regulador, terminal e local alternativo.
- Ocorrências, atraso, fila, recusa, desvio, avaria, falta documental, prova de entrega e rejeição no destino.
- Quebra de transporte com tolerância e dedução do frete.
- Estadia e demurrage com franquia, marco inicial, horas elegíveis, tarifa, teto, responsabilidade e exclusões.

### 13.1 Capacidade e conflito

A programação reconcilia saldo contratual, estoque, produto disponível por qualidade, capacidade de carga e descarga, janelas, restrições e compromissos concorrentes, mostrando a causa de cada conflito e alternativas.

---

## 14. Pátio, balança e qualidade

### 14.1 Fluxo físico

1. Pré-cadastro ou leitura da programação e dos documentos.
2. Chegada, fila, identificação do veículo e validações de acesso.
3. Pesagem de entrada, lacres e coleta de amostra composta identificada.
4. Classificação, laudo versionado, cálculo de desconto, aceite, aceite condicionado ou rejeição (QL-08).
5. Descarga ou carregamento, ocorrência e movimentação de estoque.
6. Pesagem de saída, peso líquido físico, descontos de peso, peso líquido comercial, ticket e romaneio (QL-06).
7. Vínculo definitivo ao contrato, nota, estoque, liquidação e posição.

### 14.2 Qualidade configurável

- Padrões versionados por commodity com parâmetros, unidades, métodos, bases, limites de aprovação e rejeição, método de desconto (peso ou preço), fórmula ou tabela, forma de combinação e vigência (QL-01).
- Desconto de peso por umidade e impureza (QL-02, QL-03); desconto de preço por avariados, ardidos, queimados, mofados, esverdeados, quebrados e carunchados (QL-04); taxa e quebra de secagem (QL-05); bonificação (QL-07).
- Umidade, impureza, avariados, ardidos, germinados, mofados, quebrados, granulometria, micotoxinas, transgenia e contaminantes conforme commodity.
- Contraprova com prazo, laboratório, tolerância, custo e laudo que prevalece (QL-09); reclassificação versionada; rejeição no destino após viagem (QL-10); qualidade de lote misturado por média ponderada (QL-11).
- Desconto de tabela e desconto negociado registrados separadamente, com a diferença como componente de margem.

---

## 15. Armazenagem e estoque

| Capacidade | Regra de negócio |
|---|---|
| Tipos de estoque | Próprio, de terceiros, depositado, comprado não retirado, em trânsito, em trânsito de terceiro (back to back), bloqueado, comprometido e disponível |
| Identidade | Commodity, safra, qualidade ponderada, lote, origem, titularidade, custódia, local, silo e condição |
| Pesos | Entra o peso líquido físico ou o peso seco; o comercial consome saldo e nota; a diferença é explicada, nunca ajustada |
| Movimentos | Entrada, saída, transferência, mistura, desdobramento, ajuste, reclassificação, transformação e transferência de titularidade sem movimento físico |
| Serviços | Recepção, armazenagem, secagem, limpeza, expurgo, movimentação e expedição |
| Perdas | Quebra técnica, quebra de secagem, diferença de peso, tolerância, responsabilidade, aprovação e ressarcimento |
| Valorização | Método declarado por tenant e validado pelo contador: custo médio, custo específico por lote ou rateio proporcional (MG-01) |
| Inventário | Contagem, reconciliação física e contábil, bloqueio, ajuste e trilha |

### 15.1 Titularidade e custódia

Quantidade física, propriedade, risco e custódia são dimensões distintas. O sistema registra o evento contratual que transfere cada uma, inclusive quando o produto permanece depositado com o vendedor ou terceiro após o pagamento ou é vendido sem sair do armazém.

---

## 16. Execução, alocação e liquidação física

- Saldos contratado, a fixar (preço), a fixar (câmbio), programado, carregado, entregue e aceito, preço pendente, rejeitado, faturado, liquidado, cancelado e encerrado, todos derivados de eventos (Catálogo 2.3, SL-01).
- Entregas parciais, tolerância com tratamento de excedente e falta (SL-02), sobras, volume adicional e necessidade de novo negócio ou aditivo.
- Alocação de compras e estoques a vendas por origem, qualidade, prazo, custo e rastreabilidade; alocação um para um em back to back.
- Vínculo de carga com contrato, item, programação, laudo, documentos, lote, nota, fixação e liquidação; reaplicação de carga entre contratos da mesma contraparte (CS-04).
- Reabertura controlada quando documento, contraprova ou fixação posterior altera peso, qualidade ou valor.

### 16.1 Encerramento

Um contrato encerra quando saldos e obrigações estão resolvidos, documentos presentes, divergências tratadas, liquidações conciliadas, garantias liberadas e lançamentos contabilizados (SL-03). Saldo residual dentro da tolerância encerra automaticamente; fora dela exige aditivo, washout ou decisão. Encerramento administrativo registra motivo e aprovação.

---

## 17. Posição, risco e hedge

### 17.1 Posição

- Posição física por commodity, safra, praça, período, unidade, empresa, mesa e centro de resultado.
- Compras, vendas, estoques, produção contratada, trânsito, compromissos, alocações e perdas.
- Exposição a preço (saldo a fixar valorizado), a base e prêmio, a câmbio (valor fixado sem taxa), a frete, a qualidade e a crédito, derivadas dos saldos do contrato.

### 17.2 Instrumentos e controles

| Capacidade | Escopo |
|---|---|
| Hedge | Futuros, opções, NDF, travas de câmbio vinculadas a contratos e instrumentos autorizados, com corretora, conta, lote, vencimento e custos |
| MTM | Curvas, preços, câmbio, fontes, horários, ajustes e versionamento; valor provisório de contrato a fixar |
| P e L | Previsto, realizado, atribuição por fator e ponte de variação |
| Limites | Volume, nocional, moeda, contraparte, instrumento, vencimento e stop |
| Stress | Cenários de preço, base, câmbio, frete, quebra, atraso e inadimplência |

---

## 18. Financeiro e tesouraria

### 18.1 Liquidação

A liquidação parte do valor bruto da carga (quantidade elegível em peso comercial, convertida para a unidade de preço, multiplicada pelo preço descontado por qualidade e convertida pelo câmbio aplicável), soma bonificações e reembolsos, e deduz, em ordem declarada, custos e serviços a cargo da contraparte, frete, amortização de adiantamento, retenções sobre a base definida por cada regra, multas e compensações (LQ-01, LQ-02). Peso oficial e divergência de peso seguem LQ-03.

### 18.2 Condicionantes de pagamento

- Marco do prazo declarado no contrato: descarga, emissão da nota, aceite da qualidade, último documento ou combinação; contagem em dias úteis ou corridos com calendário da praça (LQ-04).
- Checklist contratual por contraparte e operação, prazo de cura e retenção do pagamento quando houver pendência; preço definitivo obrigatório (LQ-05).
- Pagamento parcial, por carga, por período, por fechamento ou após lote completo (LQ-08).
- Beneficiário é a contraparte vigente, salvo cessão registrada ou autorização aprovada; conta validada (LQ-07).

### 18.3 Tesouraria

- Contas a pagar e receber com beneficiário, borderôs, previsões, baixas, compensações e conciliação bancária.
- Fluxo de caixa previsto e realizado por empresa, moeda, data, contraparte e contrato, considerando saldos a fixar por referência de mercado.
- Adiantamentos em dinheiro com juros e amortização (AD-01) e obrigações em sacas (AD-02), empréstimos, garantias, limites e exposição.
- Arquivos bancários, APIs, comprovantes, estornos e dupla aprovação.

### 18.4 Razão de custos e comissões por contrato

Cada contrato mantém visão econômica reproduzível. Um componente de custo possui natureza, origem, responsável, competência, estado, documento e critério de rateio (Catálogo 9, CU-01). Custos diretos incluem mercadoria, frete, classificação, secagem, armazenagem, estadia, serviços, emissão documental, comissão, penalidade, tributo não recuperável e diferença de qualidade. Comissões internas e externas admitem base por volume, receita, margem, preço, valor fixo ou fórmula, gatilho por assinatura, execução, recebimento ou encerramento, tributação própria e regra para cancelamento, washout e entrega parcial (CM-01 a CM-03).

### 18.5 Conciliação financeira, fiscal e contábil

Cinco perspectivas: valor esperado pelo contrato e execução, documento fiscal, título com beneficiário, movimento bancário e obrigação tributária; a contabilização confirma a consequência e mantém vínculo com todas. Tolerâncias por tipo de divergência com ação definida (CC-01); diferença de câmbio entre nota e pagamento prevista no contrato é variação cambial, não divergência. Diferença fora da tolerância abre caso com responsável, causa, evidências, prazo, decisão, aprovação e impacto. Baixa não encerra o caso enquanto documento, tributo e contabilização permanecerem incompatíveis.

---

## 19. Fiscal

- Perfis fiscais por empresa, estabelecimento, UF, produto, operação, origem, destino, finalidade e perfil da contraparte.
- NF-e de entrada e saída, emissão própria, nota do produtor, contranota, notas complementares, remessa, retorno, remessa por conta e ordem, simbólicas, devolução e serviços.
- Vínculo obrigatório entre documento fiscal, contrato, carga, laudo, estoque, título e lançamento; toda carga física com exatamente um documento que a acompanha.
- Validação de chave, emitente, destinatário, CFOP, NCM, quantidade em peso comercial, unidade, valor, impostos e eventos.
- Operações internas, interestaduais, armazenagem, venda à ordem, entrega em local diverso, triangulação legítima e exportação.
- Apuração, obrigações acessórias e integrações necessárias ao recorte ativado, nativas ou integradas.

**Limite.** A profundidade fiscal é definida por regime, UF, estrutura societária e modalidades dos clientes. O produto cobre o processo; o inventário fiscal por UF (Catálogo 12.1) fixa o que é nativo e o que é integrado.

### 19.1 Catálogo de regras tributárias

O catálogo determina aplicabilidade, base, alíquota, responsabilidade, retenção, vencimento e consequência por versão, com o contexto do Catálogo 4. Incidências citadas pelos pilotos entram como candidatas até validação. Em Mato Grosso, os nomes corretos são FETHAB (fundo estadual) e INDEA (agência de defesa agropecuária); IAGRO é de Mato Grosso do Sul e FETAB não existe. A opção do produtor por recolhimento na folha ou na comercialização é atributo temporal comprovável (TR-03).

### 19.2 Ciclo de retenção e obrigação tributária

O evento fiscal calcula a retenção com regra vigente, sobre a base definida pela regra, e registra memória (TR-01). O valor retido reduz o líquido somente quando responsabilidade e documento estão válidos. A confirmação cria ou atualiza obrigação tributária por competência, código, jurisdição e vencimento (TR-02). Pagamento ao fornecedor e recolhimento têm baixas independentes e conciliadas. Em cessão de crédito, a retenção é calculada sobre o cedente. Cancelamento, complemento, devolução ou correção gera recálculo e estorno por evento.

---

## 20. Contabilidade e controladoria

- Plano de contas, históricos, regras de lançamento, centros de resultado, unidades, mesas e dimensões gerenciais.
- Lançamentos automáticos a partir de eventos de contrato, fixação, estoque, qualidade, fiscal, financeiro, cessão, washout, hedge e ajuste.
- Política de reconhecimento de estoque (no aceite ou na nota), método de valorização (MG-01), competência, provisões, apropriações, custo, receita, ICMS diferido, variação cambial, valorização de contrato a fixar, MTM e resultado.
- Conciliação entre subledgers, razão, estoque, títulos, bancos, posição e documentos fiscais.
- Fechamento com checklist, reabertura, balancete, razão, DRE gerencial, margem gerencial e contábil conciliadas e resultado por negócio.
- Trilha do lançamento até a transação de origem e regra contábil versionada.

### 20.1 Eventos contábeis da cadeia conciliada

Provisão de compra, reconhecimento de estoque, custo de frete, secagem e quebra, comissão, retenção, obrigação tributária, título, pagamento ao beneficiário, receita, baixa, fixação, variação cambial, washout e compensação nascem de eventos identificáveis (Catálogo 16). Nenhum saldo existe apenas como ajuste manual sem origem, motivo e alçada.

---

## 21. Cessões, transferências e operações triangulares

Operações em que o contrato muda de parte, de beneficiário, de destino ou de contrapartida depois de assinado. Todas são eventos com instrumento, partes, contratos afetados, quantidades, valores, aprovação e versões antes e depois; nenhuma edita saldo; têm alçada própria e compliance do terceiro envolvido (CS-10).

| Operação | Capacidade do produto | Regra |
|---|---|---|
| Cessão de crédito | Título com beneficiário cessionário, total ou parcial; retenções sobre o cedente; notificação conferida; conciliação aceita beneficiário diferente | CS-01 |
| Pagamento a terceiro | Exceção auditada com autorização do fornecedor, alçada superior e conta validada | CS-02 |
| Cessão de posição contratual | Parte vigente substituída com anuência, cadastro completo, migração de saldo, fixações e obrigações, decisão sobre adiantamento e garantia, perfil tributário da nova parte nas cargas seguintes | CS-03 |
| Reaplicação de carga | Carga muda de contrato da mesma contraparte antes da nota; depois, com tratamento fiscal; liquida pelo preço do destino; fixações não migram | CS-04 |
| Transferência de saldo | Aditivos nos dois contratos; preço diferente é renegociação com alçada; adiantamento conforme regra | CS-04 |
| Compensação | Instrumento; títulos baixados pelo menor valor com residual; retenções e notas íntegras | CS-05 |
| Washout | Diferença entre preço de referência e contrato sobre o não entregue, com câmbio, multa, comissão e documento próprios; contrato encerrado | CS-06 |
| Novação | Contrato substituído por novo com vínculo | |
| Venda à ordem e entrega em local diverso | Destinatário e local de entrega distintos do comprador; dois documentos de saída, uma saída de estoque, título contra o adquirente; fluxo por UF validado | CS-07 |
| Back to back | Compra e venda vinculadas por carga; estoque em trânsito de terceiro; laudo do destino para ambos; margem do par | CS-08 |
| Intercompany | Compra e venda entre empresas do tenant com preço de transferência; margem por empresa e consolidada | CS-09 |
| Armazém de terceiro | Venda transfere titularidade sem movimento físico; documentos simbólicos; CDA e warrant quando houver | CS-09 |

O modelo de contrato aceita os campos "parte vigente", "destinatário da entrega", "local de entrega" e "beneficiário do título" desde o primeiro piloto, mesmo sem fluxo associado.

---

## 22. Exportação e operações avançadas

### 22.1 Exportação

Destino exportação, contrato internacional, idioma, moeda de liquidação estrangeira, Incoterm, porto, terminal e embarque; DU-E, LPCO, averbação, instruções, documentos aduaneiros e eventos de embarque; diferença entre peso fiscal, recebido, armazenado e exportado; câmbio operacional, fechamento, liquidação e conciliação.

### 22.2 Operações avançadas

Barter com equivalência, insumos, produção, obrigação em sacas, CPR, garantias e liquidações cruzadas; opções e estruturas de hedge não lineares; novações e compensações múltiplas; gestão de navios, lotes de exportação e sobre-estadia marítima.

---

## 23. Inteligência artificial e trabalho humano

### 23.1 Capacidades dos agentes

| Agente | Trabalho executável | Limite humano |
|---|---|---|
| Originação | Ler mensagens, estruturar oferta com unidade e moeda, atualizar histórico, preparar follow up | Relacionamento, negociação e intenção |
| Negociação | Montar cenários de preço, câmbio e margem, testar políticas, preparar proposta | Aceite comercial e exceções |
| Contratos | Extrair termos, comparar minuta, gerar obrigações, conferir instrumento de cessão, cobrar pendências | Cláusulas extraordinárias, cessões, disputas |
| Execução | Conciliar saldos, cargas, laudos, documentos e prazos; preparar cenários de aceite condicionado | Contestações, contraprova e decisões físicas |
| Logística | Sugerir programação, pedir confirmação, reprogramar dentro de regra | Contratação e ruptura |
| Liquidação | Preparar memória na ordem declarada, descontos, retenções, beneficiário e títulos | Liberação de valores, beneficiários alternativos e exceções |
| Fiscal e contábil | Validar, classificar, sugerir lançamentos e reconciliar | Tratamento tributário, fechamento e reabertura |
| Risco | Consolidar posição e exposição a preço e câmbio, detectar limite, simular, explicar variação | Estratégia e execução de proteção |

### 23.2 Níveis de autonomia

Observar, preparar, executar com aprovação, executar por política, bloquear e escalar, conforme Visão 1.3 item 11. A matriz de ações por nível é decisão da direção.

### 23.3 Regras inegociáveis

Modelos de linguagem não produzem números oficiais quando existe regra determinística; toda ação oficial retorna resultado estruturado com identidade, política, evidência e trilha; o agente acessa só o permitido ao tenant, papel e caso; mudanças materiais exigem alçada e segregação; falha da IA não impede operação manual.

---

## 24. Relatórios, indicadores e gestão

| Área | Indicadores e visões |
|---|---|
| Comercial | Funil, conversão, volume, margem, carteira, propostas, saldos a fixar, perdas e produtividade |
| Contratos | Saldos por dimensão, obrigações, assinaturas, documentos, aditivos, cessões, atrasos e exposição jurídica |
| Operações | Programação, capacidade, cargas, atraso, tempo de ciclo, rejeições, contraprovas e estadia |
| Qualidade | Perfil recebido, descontos de tabela e negociados, rejeições, fornecedores, locais e tendência |
| Estoque | Físico, comercial, contábil, disponível, comprometido, ocupação, perdas, secagem e giro |
| Risco | Posição, exposição a preço e câmbio, hedge, MTM, P&L, limites e stress |
| Financeiro | Liquidações, caixa, títulos por beneficiário, atraso, crédito, conciliação e custo financeiro |
| Fiscal e contábil | Pendências, retenções, divergências, fechamento, reconciliações e resultado |
| Gestão | Resultado por negócio, margem explicada por componente, parâmetros pendentes, produtividade, automação, exceções e qualidade de dados |
| Rastreabilidade | Cadeia de oferta a resultado por contrato, carga, documento e título |

---

## 25. Integrações

| Categoria | Integrações previstas |
|---|---|
| Mountier Agro | Oportunidades autorizadas, propostas e eventos contratuais, sem acesso cruzado aos bancos |
| Mercado | Bolsas, indicadores, PTAX e câmbio de mercado, curvas, preços regionais e provedores de risco |
| Logística | Transportadoras, rastreamento, terminais, agendamento e prova de entrega |
| Equipamentos | Balanças, leitores, classificadores, sensores e automação de pátio |
| Documentos | Assinatura eletrônica, e-mail, captura, OCR e armazenamento |
| Fiscal | SEFAZ, provedores de documentos e obrigações acessórias conforme arquitetura |
| Financeiro | Bancos, pagamentos, extratos, conciliação, corretoras, câmbio e travas |
| Identidade e dados | SSO, diretórios, BI, data warehouse, exportações e APIs para parceiros |

---

## 26. Regras transversais e segurança

- Isolamento multiempresa, criptografia, gestão de segredo e acesso mínimo.
- Auditoria imutável de criação, alteração, aprovação, execução, importação, parametrização e ação da IA.
- Idempotência, versionamento, origem do dado, correlação entre eventos e reconciliação.
- Decimal com escala explícita para dinheiro, quantidades, taxas e câmbio; quilograma como unidade canônica; datas civis e instantes distintos.
- Retenção, descarte, exportação, consentimento, base legal e LGPD.
- Segregação de ambientes, continuidade, backup, recuperação e operação degradada.
- Importações e migrações com validação, prévia, rejeições, reprocessamento e relatório de saldo inicial.
- Parâmetros de regra com responsável nominal, aprovação e vigência; valores de referência nunca em produção.

---

## 27. Estados e eventos de negócio

| Objeto | Estados principais | Eventos materiais |
|---|---|---|
| Negócio | Rascunho, em aprovação, aprovado, confirmado, cancelado | Proposta, contraproposta, aprovação, confirmação, alteração de campo material |
| Contrato (ciclo de vida) | Minuta, revisão, assinatura, ativo, suspenso, cedido, encerrado por execução, washout, compensação ou administrativo | Assinatura, aditivo, cessão, transferência, inadimplemento, washout, encerramento |
| Contrato (precificação) | Fixo; a fixar sem fixação; parcialmente fixado; totalmente fixado; fixação vencida sem decisão | Fixação, estorno, vencimento da janela |
| Contrato (câmbio) | Não aplicável; aberto; parcialmente fixado; totalmente fixado | Fixação de câmbio, trava, estorno |
| Obrigação | Pendente, em andamento, atendida, vencida, dispensada | Evidência, lembrete, atraso, escalonamento, dispensa |
| Programação | Planejada, solicitada, aprovada, confirmada, executada, cancelada | Agendamento, alteração, no show, reprogramação |
| Carga | Prevista, em trânsito, no pátio, amostrada, classificada, aceita, aceita condicionalmente, em contraprova, reclassificada, rejeitada, rejeitada no destino, reaplicada, entregue com preço pendente, concluída | Pesos, amostra, laudo, decisão, descarga, ocorrência, reaplicação, liberação |
| Lote | Criado, disponível, comprometido, bloqueado, em secagem, misturado, transferido, baixado | Entrada, movimento, mistura, transferência de titularidade, ajuste |
| Liquidação | Prevista, preparada, bloqueada por condicionante, divergente, aprovada, paga, conciliada | Cálculo, documento, retenção, autorização, pagamento, baixa |
| Título | Previsto, emitido, bloqueado, cedido parcial, cedido total, beneficiário alternativo, compensado, pago, estornado | Liquidação, cessão, compensação, pagamento, estorno |
| Documento fiscal | Recebido, validado, vinculado, divergente, complementado, cancelado, devolução, remessa por conta e ordem, simbólico | Emissão, validação, vínculo, complemento, cancelamento |
| Obrigação tributária | Calculada, confirmada, recolhida, estornada | Retenção, confirmação, recolhimento, estorno |
| Caso de reconciliação | Aberto, em análise, decidido, resolvido, perda aprovada | Divergência, evidência, decisão, correção |

Toda transição tem guarda, evento de auditoria e versão da regra. Estado sem transição não é regra testável.

---

## 28. Fronteiras e exclusões

### 28.1 Fora do produto principal

Folha, ponto, benefícios e RH; gestão agronômica detalhada, receituário, manejo e telemetria; manutenção industrial e módulos horizontais sem relação com a trading; consultoria jurídica, tributária ou contábil substituída por decisão autônoma do software.

### 28.2 Extensões possíveis

Marketplace de frete, financiamento, seguros, crédito, dados de mercado e rede de contrapartes podem tornar-se produtos ou módulos próprios. Não são requisitos para o ERP operar a trading.

---

## 29. Critérios de completude do produto

O escopo completo está materializado quando o produto opera, nos pacotes suportados, sem planilha paralela como fonte oficial:

- Comprar, contratar em qualquer combinação de unidade, moeda e modalidade, programar, receber, classificar com peso físico e comercial, estocar, liquidar na ordem declarada e contabilizar.
- Vender, alocar origem e estoque, expedir, faturar, receber e apurar resultado por método de valorização declarado.
- Controlar contratos a fixar, fixações de preço e câmbio, posição, exposição, hedge, MTM, limites e resultado.
- Executar obrigações contratuais, documentos, garantias, penalidades, cessões, transferências, washout e exceções.
- Fechar posição, estoque, financeiro, fiscal e contabilidade com reconciliação rastreável e tolerâncias declaradas.
- Permitir que agentes executem rotinas autorizadas sem comprometer controle, segurança ou explicabilidade.
- Ter toda regra de cálculo e política codificada no Catálogo, com parâmetro homologado por cliente.

---

## 30. Impactos dos contratos analisados e do piloto

Foram analisados dois contratos reais de compra e venda de milho e o trabalho de implementação e homologação com a JD.

| Evidência observada | Requisito confirmado ou acrescentado |
|---|---|
| Quantidade em toneladas, quilogramas e sacas | Unidade canônica em kg, unidade contratual, tabela de conversão versionada (UN-01, UN-02) |
| Preço em dólar por saca, PTAX, referência de bolsa | Moeda de preço e de liquidação distintas, regra de câmbio, fixação de preço e de câmbio como eventos (PR-01 a CX-03) |
| Disponibilidade, período, cadência e instruções de terminal | Obrigações logísticas, capacidade, antecedência, aprovação e reprogramação |
| Qualidade detalhada e padrões distintos | Padrão versionado por contrato, congelado na assinatura, com método de desconto por parâmetro (QL-01 a QL-07) |
| Aceite, rejeição e desconto negociado | Aceite condicionado, desconto de tabela versus negociado, contraprova (QL-08, QL-09) |
| Peso que entra na balança diferente do peso pago | Peso líquido físico e comercial como conceitos distintos com efeitos separados (QL-06, QL-12) |
| Estadia após franquia com tarifa e exclusões | Motor condicionado a tempo, peso, responsabilidade e documentação (CU-02) |
| Pagamento após descarga, lote total ou documentos | Marco de pagamento declarado e bloqueio por condicionante (LQ-04, LQ-05) |
| Ticket, CT-e, NF-e, certidões, depósito e promissória | Checklist documental dinâmico por cláusula e evento |
| Titularidade, risco e fiel depósito | Controle separado de propriedade, custódia, disponibilidade e risco |
| Multa, juros, correção, restituição, perdas e washout | Motor de penalidade e washout com fórmula, câmbio e comissão (CS-06) |
| Produtor cede recebível a banco ou revenda | Beneficiário do título distinto da contraparte, retenção sobre o cedente (CS-01) |
| Carga entregue no contrato errado | Reaplicação de carga com recálculo (CS-04) |
| Origem, ônus, socioambiental, anticorrupção e LGPD | Compliance ligado ao contrato, produto, imóvel, origem, contraparte e cessionário |
| Exportação, PTAX e diferença de peso | Preparação para moeda, eventos de exportação e reconciliação de peso fiscal e físico |
| Contrato bilíngue e assinatura eletrônica | Templates multilíngues, versão paralela e evidência de assinatura |
| Código implementado antes da regra escrita | Catálogo como documento de homologação; regra do código validada ou alterada, nunca mantida por omissão (MG-01) |

### 30.1 Conclusão da revisão

A arquitetura geral permanece correta. A revisão 1.1 subestimava a granularidade dos contratos; a 1.2 constata que subestimava também as dimensões do contrato (unidade, moeda, câmbio, fixação), a distinção entre peso físico e comercial, e as operações em que parte, beneficiário ou destino mudam depois da assinatura. O escopo agora trata esses elementos como objetos operacionais do ERP.

### 30.2 Validação por entrevista e piloto

A entrevista e o piloto confirmaram que a prioridade é o ciclo básico de compra e venda, e que o valor aparece quando o sistema impede pagamentos incorretos, apropria todos os custos e explica a margem. Confirmaram também que o trabalho de implantação é majoritariamente de parametrização e homologação de regras, com responsáveis nominais do cliente. A coexistência com o legado por domínio permanece opção legítima; a substituição total é objetivo possível, não pré-condição.

---

## 31. Decisões abertas

| Código | Tema | Decisão necessária |
|---|---|---|
| D02 | Preço a fixar e câmbio | Referências, rolagem, prêmio, quem fixa, janela, não fixação, alocação, PTAX, adiantamento em sacas |
| D03 | Qualidade | Tabelas, fórmulas, base da impureza, combinação, secagem, peso que consome saldo, contraprova, laudo, rejeição sem exceção, alçadas |
| D04 | Frete | Condição comercial, tarifa, quebra, estadia, documentos |
| D05 | Fiscal | Inventário por UF validado; nomes e incidências corretos |
| D06 | Tesouraria | Bancos, formatos, aprovadores, calendário |
| D07 | Contábil | Plano, reconhecimento, valorização, variação cambial, washout, fechamento |
| D08 | Risco | Fontes de mercado, instrumentos, corretoras, executor |
| D09 | Migração | Fontes, qualidade, volumes, corte, tolerâncias |
| D10 | Continuidade | Backup, PITR, RPO, RTO antes da virada |
| D11 | Operação e IA | Acesso, administradores, runbook; matriz de autonomia |
| D12 | Comercial | Nome, precificação, planos, implantação como projeto de parametrização |
| D13 | Cessões e triangulares | Operações praticadas, documentação, fluxo por UF, alçadas |
| D14 | Tolerância e campos materiais | Percentuais, consequências, lista de campos, matriz de alçadas |
| D15 | Segunda trading | Critérios e candidata |
| Produto | Barter, hedge, exportação, templates adicionais | Coletar modalidades, instrumentos, documentos e templates dos parceiros para os pacotes pós-MVP |

---

## 32. Sequência documental

| Etapa | Documento | Estado |
|---|---|---|
| 1 | Visão Completa do Produto 1.3 | Vigente |
| 2 | Escopo de Negócio Completo 1.2 | Este documento |
| 3 | Escopo do MVP e Plano de Fases 1.3 | Vigente |
| 4 | Catálogo de Regras e Cálculos 1.1 | Vigente; documento de homologação |
| 5 | Arquitetura Futura e Princípios de Domínio 1.2 | Vigente; separar conteúdo do Mountier Agro na próxima revisão |
| 6 | Arquitetura de Multitenancy Dados e Implantação 1.1 | Vigente |
| 7 | Especificação Funcional | Consolidar a partir dos documentos de slice após a homologação do piloto |
| 8 | Data Model e API Specification | OpenAPI no repositório; versão legível por negócio pendente |
| 9 | Relatórios de execução por cenário e termo de cobertura | Produzidos nas ondas de homologação e virada |

---

## Anexo A Amostras contratuais consideradas

- Contrato de compra e venda de milho, bilíngue, com execução logística, qualidade, preço, pagamento, inadimplemento, compliance e assinatura eletrônica (Complete_with_Docusign_Contrato_CMP0120253-A.pdf).
- Contrato de compra e venda de milho com quantidade, entrega, qualidade, pagamento após descarga, garantia, multa e washout (Contrato 537_2026 JD.pdf).
- Contrato em que a JD figura como compradora: pendente de recebimento e mapeamento campo a campo.
- Planilha de exemplos operacionais da JD: fonte de fatos de pesagem e qualidade; valores não homologados.

A leitura foi usada para identificar requisitos de produto. Interpretação jurídica, validade de cláusulas e adequação regulatória devem ser confirmadas por profissionais antes da implantação.

---

## Anexo B Glossário mínimo

Definições completas no Catálogo 1.1, seção 2. Resumo dos termos que mais geram ambiguidade:

| Termo | Definição |
|---|---|
| Peso líquido físico | Bruto menos tara; entra no estoque |
| Peso líquido comercial | Físico menos descontos de peso; consome saldo, vai para a nota e é pago |
| Quantidade elegível | Peso comercial da carga aceita, na unidade de preço |
| Unidade canônica | Quilograma; toda quantidade é armazenada assim |
| Unidade contratual e unidade de preço | Unidade negociada para a quantidade e unidade sobre a qual o preço é expresso; podem diferir |
| Moeda de preço e moeda de liquidação | Moeda negociada e moeda do pagamento; podem diferir |
| Fixação de preço e fixação de câmbio | Eventos independentes e parciais que tornam conhecidos preço e taxa |
| Parte vigente | Parte do contrato na data do fato, após cessões |
| Beneficiário | Quem recebe o pagamento; igual à contraparte salvo cessão |
| Desconto de tabela e negociado | Desconto do padrão versus acordado; a diferença é variação de margem |
| Campo material | Campo cuja alteração invalida aprovação anterior |
| Referência e parâmetro | Valor de prática de mercado versus valor homologado pelo cliente |
