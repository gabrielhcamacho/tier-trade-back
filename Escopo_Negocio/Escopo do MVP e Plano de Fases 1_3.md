# Escopo do MVP e Plano de Fases 1.3

**Produto:** Tier Trade, nome provisório do ERP independente para tradings, cerealistas e armazenadores.
**Recorte do MVP:** soja e milho, mercado interno brasileiro.
**Primeiro piloto:** JD, Mato Grosso, compra e venda a preço fixo, cenários JD-01 a JD-04.
**Estratégia:** ciclos verticais completos, implantação progressiva e operação paralela.
**Referências:** Visão Completa 1.2, Escopo de Negócio 1.1, Catálogo de Regras e Cálculos 1.1, Arquitetura de Multitenancy 1.1.
**Data:** 8 de outubro de 2026.

**O que muda em relação à versão 1.2.** A versão 1.2 descrevia um plano a executar. A 1.3 reconhece que as Fases 1, 2 e a maior parte da 3 já estão implementadas e aguardam homologação, e reorganiza o plano em torno do que falta: regras oficiais, parametrização, aceite humano e virada. Fixa o recorte real do primeiro piloto (JD, preço fixo), move preço a fixar e câmbio para uma onda posterior nomeada, resolve a inconsistência entre Visão e Plano sobre barter e adiantamentos, incorpora cessões e reaplicação de carga como escopo, vincula cada gate às regras e cenários do Catálogo 1.1, e trata a contradição entre o critério de recuperação e a decisão de operar sem backup automático. As decisões abertas passam a usar os códigos D02 a D12 do repositório.

---

## Índice

1. Decisão executiva
2. Definição do MVP
3. Premissas do recorte
4. Estado atual do projeto
5. Estratégia de validação
6. Usuários do MVP
7. Jornadas obrigatórias
8. Plano geral de ondas
9. Onda A Homologação do piloto a preço fixo
10. Onda B Virada da JD
11. Onda C Preço a fixar, câmbio e cessões
12. Onda D Segunda trading e generalização
13. Fundação transversal
14. Inteligência artificial por onda
15. Matriz funcional por módulo
16. Dados, integrações e migração
17. Requisitos transversais
18. Critérios de aceite
19. Métricas do piloto
20. Implantação e virada
21. Fora do MVP
22. Decisões abertas
23. Sequência documental
Anexo A Síntese dos gates
Anexo B Correspondência entre fases 1.2, ondas 1.3 e plano de execução do repositório

---

## 1. Decisão executiva

O produto substituirá o ERP operacional da trading por cobertura progressiva de ciclos reais. Essa decisão permanece. O que muda é o momento: o código que cobre compra, contrato, recebimento, qualidade, estoque, fiscal, liquidação, venda, expedição e conciliação já existe e foi exercitado com dados demonstrativos. O risco do projeto deixou de ser "construir" e passou a ser "homologar contra regras que ninguém escreveu".

**Decisão.** O MVP continua sendo a soma das capacidades das antigas Fases 1, 2 e 3. A partir desta versão, o plano é organizado em ondas de homologação e virada, não em ondas de construção. Nenhuma capacidade é considerada entregue enquanto suas regras no Catálogo 1.1 não tiverem parâmetros homologados e cenários executados com aceite humano.

| Documento | Função |
|---|---|
| Escopo de Negócio Completo 1.1 | Define tudo o que o produto pretende operar no destino |
| Catálogo de Regras e Cálculos 1.1 | Define como cada cálculo e política do MVP funciona; é o documento de homologação |
| Escopo do MVP e Plano de Fases 1.3 | Define o recorte, as ondas, os gates e os critérios de aceite |
| Especificação Funcional | Detalha telas, estados, campos e exceções; hoje parcialmente coberta pelos documentos de slice do repositório |

---

## 2. Definição do MVP

O MVP é um ERP piloto capaz de assumir como fonte oficial uma parte delimitada da operação de uma trading real. A delimitação ocorre por empresa, unidade, commodity, modalidade contratual, fluxo logístico, UF, regime fiscal, banco e integrações homologadas. Não ocorre pela remoção de controles essenciais do ciclo.

### 2.1 O que completo significa

- Uma compra e uma venda cobertas nascem, são aprovadas, contratadas, executadas, liquidadas e contabilizadas.
- Cada número oficial tem regra no Catálogo 1.1, com código, versão, memória e origem rastreável.
- Contrato, obrigação, carga, estoque, documento fiscal, título, posição e lançamento permanecem relacionados.
- Exceções são registradas, aprovadas e auditadas sem alteração direta no banco.
- A operação manual continua possível quando a IA ou uma integração estiver indisponível.
- Nenhum valor de referência do Catálogo está em produção; todo parâmetro tem valor da trading e aprovação registrada.

### 2.2 O que completo não significa

- Cobrir todas as commodities, UFs, regimes, instrumentos financeiros e modelos de armazenagem.
- Automatizar toda exceção antes de observar sua recorrência.
- Eliminar o legado antes de reconciliar ciclos completos em paralelo.
- Substituir decisão jurídica, tributária, comercial, financeira ou de risco por geração probabilística.

---

## 3. Premissas do recorte

| Dimensão | Primeiro piloto (Ondas A e B) | Extensão do MVP (Onda C) | Fora do MVP |
|---|---|---|---|
| Clientes | JD | JD e segunda trading | |
| Commodities | Soja e milho | Soja e milho | Demais |
| Mercado | Doméstico, Mato Grosso | Doméstico, UFs da segunda trading | Exportação |
| Moedas | Real; preço em real | Preço em dólar com câmbio por regra CX-01; liquidação em real | Liquidação em moeda estrangeira |
| Modalidades | Compra e venda spot ou futura a preço fixo | Preço a fixar, fixação parcial e de câmbio (PR-02 a PR-04, CX-02) | Opções e estruturas não lineares |
| Adiantamentos | Adiantamento em dinheiro com amortização proporcional (AD-01) | Idem | Obrigação em sacas e barter (AD-02), salvo decisão D02 |
| Cessões | Cessão de crédito, pagamento a terceiro autorizado e reaplicação de carga (CS-01, CS-02, CS-04) | Washout e transferência de saldo (CS-06, CS-04) | Cessão de posição, venda à ordem, back to back, intercompany, armazém com CDA |
| Logística | Rodoviária, origens e destinos homologados, armazenagem própria ou de terceiros | Idem | Ferroviário, portuário |
| Qualidade | Padrão da JD para soja e milho (QL-01) | Padrão da segunda trading | |
| Fiscal | Operações, estabelecimentos e regimes da JD em MT (item 12.1 do Catálogo) | UFs e regimes da segunda trading | |
| Contabilidade | Subledger e lançamentos do recorte, fechamento reconciliado, integração ou nativo conforme D07 | Idem | Consolidação avançada |
| IA | Observar, estruturar, preparar, cobrar; executar rotinas reversíveis por política após matriz aprovada | Idem | Autonomia irrestrita |

Esta tabela substitui a lista de "Incluído" da Visão 1.2, item 13.1, no que diz respeito a barter, adiantamentos e cessões. A Visão deve ser alinhada na próxima revisão.

### 3.1 Premissas arquiteturais do SaaS

Mantidas da versão 1.2: célula compartilhada com isolamento por tenant como padrão; código e migrations únicos; contexto de tenant em banco, jobs, arquivos, cache, filas e observabilidade; read models para dashboards; pipeline versionado de importação e reconciliação. O repositório confirma a implementação de tenant, RLS, auditoria, outbox e read models.

---

## 4. Estado atual do projeto

Síntese do plano de execução do repositório em 8 de outubro de 2026.

| Capacidade | Estado | O que falta |
|---|---|---|
| Oferta, cálculo, aprovação e contrato de compra a preço fixo | Implementada e publicada | Executar JD-01 e JD-02 com valores e aceite da JD |
| Recebimento, pesagem, qualidade, pátio, ocorrência, romaneio e estoque | Implementada | Parâmetros D03: limites, tolerâncias, contraprova e descontos oficiais |
| Fiscal de compra, contas a pagar, pagamentos e conciliação | Implementada | Matriz fiscal D05 e bancária D06 |
| Venda, alocação, expedição, fiscal de saída e contas a receber | Implementada | Executar JD-03 e JD-04 com os diretores |
| Relatórios e rastreabilidade transversal | Em execução | Concluir e validar |
| Comissão versionada, apropriação e margem realizada gerencial | Implementada | Validar MG-01 com o contador |
| Obrigações contratuais, documentos, assinaturas e bucket privado | Implementadas | Nada bloqueante |
| Governança avançada de usuários e permissões | Planejada | Não prioritária |
| Administração da plataforma e comercialização de planos | Posterior ao piloto | D12 |
| Preço a fixar, fixação parcial e câmbio | Não implementado | D02 e Onda C |
| Cessão de crédito e reaplicação de carga | Não implementado | Regras CS-01, CS-02, CS-04 do Catálogo |
| Contabilização por evento | Pendente de D07 | Plano de contas e política de reconhecimento |
| Backup automático e PITR | Desativado por decisão D10 | Reativar antes da virada (item 10) |

**Conclusão.** O trabalho remanescente para o primeiro piloto é majoritariamente de negócio: coletar parâmetros, validar regras com especialistas, executar cenários com aceite humano e preparar a virada. O desenvolvimento residual é pequeno e está listado nas Ondas A e C.

---

## 5. Estratégia de validação

1. Homologar o Catálogo 1.1 com a JD antes de executar os cenários: cada parâmetro preenchido e aprovado por responsável nominal.
2. Executar os cenários JD-01 a JD-04 com dados reais e os diretores da JD, registrando aceite, ressalvas e evidências.
3. Operar transações reais em paralelo ao sistema atual e reconciliar diariamente saldos, documentos e valores pelas tolerâncias CC-01.
4. Transformar exceções recorrentes em configuração, regra ou fluxo; manter casos raros como exceção assistida.
5. Autorizar a virada por unidade, operação e modalidade que tenham cumprido os critérios de aceite.
6. Só depois da virada da JD selecionar a segunda trading para testar generalização.

### 5.1 Artefatos de validação

| Momento | Artefato | Evidência esperada |
|---|---|---|
| Antes dos cenários | Catálogo 1.1 parametrizado | Todo parâmetro com valor, responsável e aprovação |
| Cenários | Relatório de execução por cenário | Resultado esperado conferido, divergências com causa e decisão |
| Piloto paralelo | Relatório diário de reconciliação | Diferenças entre legado e Tier Trade explicadas e tratadas |
| Virada | Termo de cobertura operacional | Processos, unidades e modalidades autorizados a usar o Tier Trade como fonte oficial |

**Nota sobre o protótipo navegável.** A versão 1.2 previa um protótipo validado por usuários de todas as funções como gate da Fase 0. Não há registro formal desse gate. O sistema publicado passou a cumprir essa função; a validação de jornadas pelos usuários da JD ocorre na Onda A e é registrada no relatório de execução por cenário.

---

## 6. Usuários do MVP

Mantidos da versão 1.2, com acréscimo de uma responsabilidade por papel: cada papel é responsável nominal por um grupo de parâmetros do Catálogo.

| Papel | Trabalho principal no MVP | Decisões reservadas | Parâmetros do Catálogo |
|---|---|---|---|
| Direção e gestor | Acompanhar resultado, caixa, risco, limites, exceções | Políticas, alçadas, exposição, exceções materiais | Matriz de alçadas, campos materiais (17.4), lista de rejeição sem exceção |
| Trader ou originador | Ofertas, preço, negociação, carteira | Intenção comercial e condições | Tolerância SL-02, condição de frete CU-02, fonte de referência PR-01 |
| Contratos | Minuta, assinatura, ativação, obrigações, documentos | Cláusulas extraordinárias e disputas | Marco de pagamento LQ-04, laudo que prevalece QL-09, documentação de cessão CS-01 |
| Logística e operações | Programação, cargas, ocorrências | Rupturas e contratação | Estadia e quebra de transporte CU-02 |
| Pátio e qualidade | Pesar, classificar, aceitar, rejeitar | Contestação e aceite fora do padrão | Padrão QL-01, fórmulas QL-02 a QL-05, contraprova QL-09 |
| Estoque | Lotes, titularidade, disponibilidade | Ajustes e perdas | Quebra de secagem QL-05, peso que consome saldo QL-12 |
| Financeiro | Liquidações, títulos, pagamentos, conciliação | Liberação e alteração bancária | Ordem de cálculo LQ-02, calendário LQ-04, tolerâncias CC-01, bancos D06 |
| Fiscal e contábil | Documentos, classificação, lançamentos, fechamento | Tratamento tributário, reabertura | Inventário 12.1, TR-01 a TR-03, MG-01, eventos contábeis, D05 e D07 |
| Risco | Posição, exposição, MTM | Estratégia e limites | Fonte de preço de mercado D08 |

---

## 7. Jornadas obrigatórias

As quatro jornadas da versão 1.2 permanecem (compra de grãos, venda e atendimento, exceção contratual, economia do contrato e conciliação). Esta versão as vincula aos cenários e acrescenta uma quinta.

| Jornada | Cenários que a comprovam | Regras principais |
|---|---|---|
| Compra de grãos | JD-01, JD-02, P01, P02, P07, QC-01 a QC-09 | QL-02 a QL-08, LQ-01 a LQ-05, TR-01 |
| Venda e atendimento | JD-03, JD-04, QC-11, QC-12 | SL-01, QL-11, MG-01, MG-02 |
| Exceção contratual | JD-02, QC-06, QC-07, QC-10, CM-06, CM-07 | QL-08, QL-10, SL-02, SL-03 |
| Economia do contrato e conciliação | P03 a P06, P08 | 9, CM-01, CC-01, MG-02 |
| Cessão e reaplicação (nova) | CT-01, CT-02, CT-03, CT-05, CT-06 | CS-01, CS-02, CS-04, LQ-07 |

---

## 8. Plano geral de ondas

| Onda | Objetivo | Resultado liberado | Faixa indicativa |
|---|---|---|---|
| A | Homologar o piloto a preço fixo | Catálogo parametrizado, JD-01 a JD-04 aceitos, operação paralela iniciada | 6 a 10 semanas |
| B | Virar a JD para o Tier Trade como fonte oficial | Termo de cobertura por unidade e modalidade, legado em coexistência | 6 a 10 semanas após A |
| C | Preço a fixar, câmbio, washout e transferência de saldo | Contratos a fixar e em dólar operando na JD | 8 a 12 semanas, pode iniciar durante B |
| D | Segunda trading e generalização | Modelo suporta diferenças por configuração; onboarding repetível | 10 a 14 semanas após B |
| Pós-MVP | Expansão | Exportação, novas commodities, barter, operações avançadas | Roadmap contínuo |

As durações pressupõem equipe dedicada e respostas da JD e dos especialistas dentro de uma semana. O cronograma depende mais da velocidade das decisões D02 a D09 do que de desenvolvimento.

---

## 9. Onda A Homologação do piloto a preço fixo

### 9.1 Objetivo

Transformar o sistema implementado em sistema homologado: cada regra do Catálogo com parâmetro da JD, cada cenário executado com aceite, operação paralela iniciada.

### 9.2 Entregas de negócio

- Catálogo 1.1 parametrizado: QL-01 (tabela de qualidade), QL-02 a QL-05 (fórmulas e secagem), QL-08 e QL-09 (alçadas e contraprova), QL-12 (peso que consome saldo), SL-02 (tolerância), LQ-02 a LQ-04 (ordem de cálculo, peso oficial, marco de pagamento), CU-02 (frete e estadia), CC-01 (tolerâncias), 17.4 (campos materiais) e matriz de alçadas.
- Inventário fiscal 12.1 validado pelo especialista da JD; regras TR-01 a TR-03 com base, alíquota, responsabilidade e vigência; obrigações acessórias decididas entre nativo e integrado (D05).
- Bancos, formato de extrato e aprovadores nominais (D06).
- Política de reconhecimento de estoque, método de valorização MG-01 e plano de contas provisório validados pelo contador (D07, parte mínima).
- Documentação mínima de cessão de crédito e pagamento a terceiro (CS-01, CS-02).
- Contrato em que a JD figura como compradora mapeado campo a campo nas estruturas existentes, sem inferência.

### 9.3 Entregas técnicas

- Parametrização do tenant JD com os valores homologados, sem valores de referência.
- Cessão de crédito, pagamento a terceiro autorizado e reaplicação de carga antes da nota (CS-01, CS-02, CS-04 parte 1).
- Estados de carga "aceita condicionalmente", "em contraprova", "rejeitada no destino" e "entregue com preço pendente", se ainda ausentes.
- Conclusão dos relatórios e da rastreabilidade transversal.
- Importação do estoque inicial, contratos abertos e títulos abertos da JD por lote reconciliado (D09).

### 9.4 IA da onda

- Extrair oferta, termos contratuais e tickets de documentos da JD; apontar lacunas.
- Preparar liquidação, identificar documentos faltantes e explicar divergências.
- Nenhuma execução por política até a matriz de autonomia ser aprovada (D11 parte IA).

### 9.5 Gate de saída

- Todo parâmetro do Catálogo usado nos cenários JD tem valor da JD, responsável e aprovação registrada.
- JD-01 a JD-04 executados com dados reais e aceite formal dos diretores, com ressalvas listadas e classificadas.
- P01, P02, P03, P06, P07 e QC-01 a QC-09 executados com resultado esperado conferido.
- CT-01 e CT-05 executados, se a JD praticar cessão e reaplicação.
- Operação paralela iniciada com relatório diário de reconciliação por ao menos duas semanas.
- Nenhuma divergência fora de CC-01 sem caso aberto com causa e dono.

---

## 10. Onda B Virada da JD

### 10.1 Objetivo

Tornar o Tier Trade a fonte oficial para as unidades e modalidades homologadas, com o legado em coexistência deliberada por domínio.

### 10.2 Entregas

- Contabilização por evento conforme D07, ou integração com o sistema contábil, com fechamento de um período piloto reconciliado (P08).
- Matriz de autonomia da IA aprovada: ações automáticas, com aprovação e proibidas.
- Backup automático e PITR reativados, restauração ensaiada e documentada, RPO e RTO acordados. Esta entrega é condição da virada, não da Onda A.
- Domínio final, SMTP transacional, administradores definitivos, MFA e runbook (D11).
- Treinamento por jornada e papel com cenários reais e contingência.
- Dois ensaios de corte com rollback e reconciliação.

### 10.3 Gate de conclusão do MVP para o recorte da JD

- Duas compras e duas vendas reais, com entregas parciais e ao menos uma divergência de qualidade, fecham de ponta a ponta.
- Estoque, posição, financeiro, fiscal, contabilidade e resultado reconciliam com o legado dentro de CC-01.
- Uma compra com retenção e uma comissão percorrem cálculo, aprovação, título, pagamento ou recolhimento e contabilização sem ajuste paralelo.
- Um contrato com múltiplas cargas apresenta margem projetada, comprometida e realizada e explica cada variação por MG-02.
- Nenhuma planilha paralela permanece como fonte oficial no recorte autorizado.
- Restauração de célula e recuperação do tenant executadas em ensaio documentado.
- A JD assina o termo de cobertura operacional por unidade e modalidade.

---

## 11. Onda C Preço a fixar, câmbio e cessões

### 11.1 Objetivo

Estender o contrato para as dimensões de preço e câmbio e para as operações de cessão restantes, sem migrar contratos existentes.

### 11.2 Pré-condições

- D02 decidida: referências, vencimento e rolagem, prêmio, quem fixa, janela, regra de não fixação (PR-03), método de alocação (PR-04), fonte, tipo e data da PTAX (CX-01), adiantamento em sacas dentro ou fora (AD-02).
- D08 parcial: fonte de preço de mercado para valor provisório de carga com preço pendente e para washout.
- Validação fiscal da nota em contrato em dólar, nota complementar após fixação e documento de washout.
- Tratamento contábil de variação cambial e de contrato a fixar no fechamento (D07).

### 11.3 Entregas

- Modelo de contrato com moeda de preço separada da moeda de liquidação, termo de preço versionado (PR-01), fixação de preço (PR-02) e de câmbio (CX-02) como eventos independentes, eixos de estado 17.1.
- Tabela de conversão UN-01 com tonelada e bushel; armazenamento canônico em kg (UN-02) se ainda não for o caso.
- Um método de alocação PR-04 implementado, com o campo que permite outro.
- Washout (CS-06) e transferência de saldo não entregue (CS-04 parte 2).
- Exposição a preço e a câmbio no painel, derivadas dos saldos.

### 11.4 Gate de saída

- CM-01 a CM-12 e CT-07 a CT-09 executados com números homologados pela JD.
- Um contrato real em dólar e um a fixar percorrem fixação, entrega, liquidação e contabilização na JD.
- Contratos a preço fixo existentes não sofrem alteração de comportamento (regressão dos cenários JD).

---

## 12. Onda D Segunda trading e generalização

### 12.1 Objetivo

Provar que o modelo absorve diferenças operacionais por configuração, sem customização estrutural, e que o onboarding é repetível.

### 12.2 Entregas

- Seleção da trading de contraste com critérios: outra UF ou regime, outro padrão de qualidade, outra prática de fixação, outro banco.
- Pacote fiscal da nova UF pelo inventário 12.1.
- Segundo padrão de qualidade QL-01 e segunda matriz de alçadas, só por configuração.
- Pipeline de importação reexecutado do zero para o novo tenant, com reconciliação.
- Lista priorizada de diferenças e decisão configuração versus produto para cada uma.

### 12.3 Gate de saída

- Segunda trading executa JD-01 a JD-04 equivalentes com seus próprios parâmetros.
- Nenhuma alteração de código específica por cliente; só configuração versionada.
- Testes de isolamento entre os dois tenants aprovados.

---

## 13. Fundação transversal

Mantida da versão 1.2 e já em operação: tenant context, memberships, RLS, auditoria, outbox, read models, storage privado, observabilidade. Pendências registradas: backup automático e PITR (D10, condição da Onda B), MFA e administradores definitivos (D11), quotas por tenant e promoção para banco dedicado (após Onda D).

---

## 14. Inteligência artificial por onda

| Capacidade | Onda A | Onda B | Onda C e D | Limite humano |
|---|---|---|---|---|
| Entrada não estruturada | Ofertas, contratos e tickets da JD | Extratos e documentos financeiros | Documentos da segunda trading | Confirmar ambiguidade material |
| Preparação | Liquidação, divergências, memória | Conciliação e fechamento | Cenários de fixação e câmbio | Aprovar ação material |
| Execução por política | Nenhuma até matriz aprovada | Cobranças, vínculos inequívocos, conciliações inequívocas | Idem | Definir política e alçada |
| Bloqueio e escalonamento | Pagamento sem requisito ou divergente | Carga fora de origem, janela ou padrão | Fixação vencida, exposição acima do limite | Decidir exceção |
| Análise | Margem e diferença contratual | Posição, caixa, P&L e reconciliação | Exposição cambial | Estratégia e responsabilidade |

Regras inegociáveis mantidas: modelos de linguagem não produzem números oficiais quando existe regra determinística; toda ação oficial passa por ferramenta tipada, autorização, idempotência e auditoria; a IA apresenta evidência, confiança, impacto e próxima ação; alterações irreversíveis exigem alçada humana; o ERP opera em modo manual sem o provedor de IA.

---

## 15. Matriz funcional por módulo

| Módulo | Onda A | Onda B | Onda C | Onda D e pós |
|---|---|---|---|---|
| Administração | Parâmetros da JD, alçadas, campos materiais | MFA, administradores, políticas de fechamento | Tabela de unidades, regras de câmbio | Quotas, planos, marketplace |
| Contrapartes | Perfil tributário TR-03, conta validada, documentação de cessão | Exposição e histórico financeiro | Cessionário e parte vigente | Scoring e rede ampliada |
| Comercial | Cenários a preço fixo, impacto de capacidade | Margem realizada e performance | Referências, prêmio, fixação | Otimização e inteligência de mercado |
| Contratos | Tolerância, marco de pagamento, obrigações, reaplicação | Encerramento SL-03, garantias | Termo de preço, fixações, washout, transferência | Cessão de posição, venda à ordem, back to back, barter, exportação |
| Operações | Frete, estadia, estados de carga novos | Custos e conciliações | Preço pendente | Ferroviário, portuário |
| Estoque | Peso físico e comercial, secagem, quebra | Valorização MG-01, reconciliação contábil | Valor provisório | Armazém com CDA |
| Qualidade | QL-01 a QL-12 parametrizadas | | Segundo padrão | |
| Financeiro | LQ-01 a LQ-08, cessão de crédito, bancos D06 | Conciliação completa, caixa | Câmbio, variação cambial | Crédito e financiamento |
| Fiscal | TR-01 a TR-03, inventário 12.1, emissão ou integração | Apuração e acessórias do recorte | Nota em dólar, complementar, washout | Novas UFs, exportação |
| Contábil | Plano provisório, política de reconhecimento | Lançamentos, fechamento, DRE | Variação cambial, contrato a fixar | Consolidação |
| Risco | Posição a entregar | Exposição e P&L | Exposição a preço e câmbio | Hedge, MTM, stress |

---

## 16. Dados, integrações e migração

### 16.1 Prioridade de integrações

| Prioridade | Integrações | Regra |
|---|---|---|
| Obrigatória para a Onda A | Emissão ou recepção fiscal da JD, banco ou arquivo bancário da JD, assinatura | Homologar só o necessário aos cenários JD |
| Obrigatória para a Onda C | Fonte de preço de mercado e de PTAX | Necessária para fixação e valor provisório |
| Condicional | Balança, terminal, rastreamento, corretora, armazenamento documental | Entrar quando a ausência gerar digitação inviável ou risco |
| Preparada | Mountier Agro, parceiros, outras tradings | API versionada, consentimento, sem banco compartilhado |

### 16.2 Migração inicial da JD

- Empresas, estabelecimentos, usuários, contrapartes com perfil tributário, contas bancárias, produtos, locais e parâmetros.
- Contratos abertos a preço fixo, obrigações, saldos, entregas, garantias e documentos.
- Estoque inicial por lote, qualidade, titularidade, local e condição, em peso físico.
- Títulos abertos, adiantamentos, saldos bancários.
- Plano de contas e saldos necessários ao fechamento piloto.

### 16.3 Regras de migração

Mantidas: origem, data, versão, responsável, validações, rejeições e relatório; dados insuficientes como pendência explícita; dois ensaios de corte; linhagem source_system, source_record_id, import_batch_id, mapping_version; nenhum arquivo legado nas tabelas oficiais; reconciliação de contagens, quantidades, valores, vínculos e saldos antes do aceite.

---

## 17. Requisitos transversais

Mantidos da versão 1.2 (segurança, autorização, auditoria, integridade, disponibilidade, privacidade, performance, explicabilidade, multitenancy, células, relatórios, implantação, continuidade), com uma precisão:

| Tema | Onda A (piloto assistido) | Onda B (fonte oficial) |
|---|---|---|
| Continuidade | Backup manual antes de cada migration e de cada carga de dados reais; risco aceito por decisão D10 | Backup automático, PITR, restauração ensaiada, RPO e RTO acordados; condição de virada |
| Acesso | Convite por API administrativa, ambiente compartilhado | Domínio final, MFA, administradores definitivos, runbook |

---

## 18. Critérios de aceite

| Dimensão | Critério |
|---|---|
| Regras | Toda regra usada no recorte tem parâmetro homologado e ao menos um cenário executado |
| Funcional | Jornadas obrigatórias concluídas por usuários reais da JD nos cenários JD-01 a JD-04 |
| Financeira | Liquidações, títulos, baixas e conciliações reproduzem os valores aprovados e explicam diferenças por LQ-02 e CC-01 |
| Física | Contrato, cargas, qualidade, estoque, titularidade e posição reconciliam por evento, com peso físico e comercial distintos |
| Fiscal | Documentos do recorte emitidos, recebidos, validados e vinculados; retenções TR-01 com obrigação TR-02 separada |
| Contábil | Eventos geram lançamentos, subledgers reconciliam, período piloto fecha com DRE gerencial e método MG-01 validado |
| Segurança | Testes de autorização, segregação, acesso cruzado e auditoria aprovados |
| Operacional | Fila de trabalho, treinamento, suporte e contingência definidos |
| Adoção | Nenhuma planilha paralela como fonte oficial no recorte |
| Isolamento | Um tenant não lê, altera, vincula, exporta ou recebe eventos de outro |
| Migração | Carga repetível sem duplicidade e reconciliada até o registro original |
| Performance | Dashboard e relatório pesado dentro dos SLOs sem degradar operações críticas |
| Recuperação | Restauração de célula e recuperação de tenant em ensaio documentado antes da virada |

### 18.1 Definition of Done por história

Mantida: regra, estado, permissão, alçada, auditoria, erro, contingência e teste definidos; cálculos com exemplos, arredondamento, vigência, memória e teste automatizado; saldos atualizam consumidores e participam da reconciliação; interface cobre vazio, carregamento, sucesso, conflito, bloqueio e recuperação; documentação e treinamento atualizados. Acréscimo: a história cita o código da regra do Catálogo que implementa ou altera.

---

## 19. Métricas do piloto

Mantidas da versão 1.2 (confiabilidade, velocidade, produtividade, automação, qualidade, adoção, resultado), com duas métricas de homologação acrescentadas: percentual de parâmetros do Catálogo com valor homologado, e percentual de cenários executados com resultado esperado conferido. Ambas devem chegar a cem por cento no recorte antes do gate da Onda A.

---

## 20. Implantação e virada

1. Parametrizar o tenant da JD com o Catálogo homologado; nenhum valor de referência.
2. Executar migrações de ensaio e corrigir cadastros, duplicidades, chaves e saldos.
3. Executar os cenários JD com os diretores e registrar aceite.
4. Treinar por jornada e papel com cenários reais, exceções e contingência.
5. Operar em paralelo com reconciliação diária e reunião curta de divergências.
6. Reativar backup automático, ensaiar restauração, congelar alterações não essenciais, repetir o corte.
7. Autorizar virada por unidade ou modalidade com termo de cobertura.
8. Manter suporte intensivo, indicadores, rollback controlado e backlog de estabilização.

### 20.1 Estratégia para dois parceiros

| Parceiro | Papel | Risco controlado | Momento |
|---|---|---|---|
| JD (referência) | Define o fluxo base, fornece dados, usuários, parâmetros e decisões | Evita produto genérico sem operação real | Ondas A, B e C |
| Trading de contraste | Valida se o modelo suporta diferenças sem customização estrutural | Evita transformar a JD no produto inteiro | Onda D, selecionada após a virada da JD |

---

## 21. Fora do MVP

- Exportação completa, DU-E, LPCO, câmbio operacional, embarque marítimo e navios.
- Café, algodão, açúcar, etanol, trigo, arroz e demais commodities.
- Barter, obrigação em sacas (salvo decisão D02 em contrário), CPR e garantias além das modalidades escolhidas.
- Cessão de posição contratual, venda à ordem, entrega em local diverso, back to back, intercompany e armazém com CDA. O modelo de contrato deve aceitar os campos "parte vigente", "destinatário da entrega", "local de entrega" e "beneficiário do título" desde a Onda A, sem fluxo associado.
- Liquidação em moeda estrangeira.
- Opções, estruturas não lineares, negociação eletrônica e execução em corretoras.
- Marketplace de frete, crédito, seguros, financiamento e rede aberta de contrapartes.
- Folha, RH, gestão agronômica e manutenção industrial.
- Autonomia irrestrita da IA e decisão jurídica, tributária ou financeira autônoma.

Itens fora do MVP podem aparecer na interface como visão futura, mas não podem parecer disponíveis.

---

## 22. Decisões abertas

| Código | Tema | Decisão necessária | Responsável | Onda que bloqueia |
|---|---|---|---|---|
| D02 | Preço a fixar e câmbio | Referências, rolagem, prêmio, quem fixa, janela, não fixação, alocação, PTAX, adiantamento em sacas | Direção comercial, produto | C |
| D03 | Qualidade | Tabela da JD, fórmulas, base da impureza, aditivo ou sequencial, secagem, peso que consome saldo, contraprova, laudo, rejeição sem exceção, alçadas | Qualidade, comercial | A |
| D04 | Frete | Condição comercial, tarifa, quebra de transporte, estadia, documentos, gatilho | Operações | A |
| D05 | Fiscal MT | Inventário 12.1 validado: documentos, CFOPs, ICMS diferido, FETHAB, INDEA, Funrural e SENAR, PIS e COFINS, acessórias, base das retenções | Especialista fiscal da JD | A |
| D06 | Tesouraria | Banco, formato, aprovadores nominais, OFX ou CNAB, calendário | Financeiro da JD | A |
| D07 | Contábil | Plano, política de reconhecimento, MG-01, variação cambial, washout, fechamento, nativo ou integrado | Contador da JD | A (mínimo), B (completo) |
| D08 | Risco | Fonte de preço e câmbio de mercado, praça, frequência, executor | Direção | C |
| D09 | Migração | Fontes, responsáveis, volumes, mapeamentos, corte, tolerâncias | JD e produto | A |
| D10 | Continuidade | Reativar backup automático e PITR, RPO e RTO, ensaio de restauração | Produto | B |
| D11 | Operação e IA | Domínio, SMTP, administradores, MFA, runbook; matriz de autonomia da IA | Produto, direção | B |
| D12 | Comercial | Nome, precificação, planos de isolamento, implantação self-service | Direção | D |
| D13 | Cessões | Quais operações a JD pratica; documentação; reaplicação após nota; alçadas | Jurídico, financeiro | A (CS-01, CS-02, CS-04), C (CS-06) |
| D14 | Tolerância e campos materiais | Percentual e consequências SL-02; lista 17.4; matriz de alçadas | Direção comercial | A |
| D15 | Segunda trading | Critérios de seleção e candidata | Direção | D |

---

## 23. Sequência documental

| Etapa | Documento | Estado |
|---|---|---|
| 1 | Visão Completa do Produto 1.2 | Vigente; alinhar item 13.1 ao recorte do item 3 deste plano |
| 2 | Escopo de Negócio Completo 1.1 | Vigente; corrigir FETAB e IAGRO para FETHAB e INDEA |
| 3 | Escopo do MVP e Plano de Fases 1.3 | Este documento |
| 4 | Catálogo de Regras e Cálculos 1.1 | Vigente; documento de homologação |
| 5 | Arquitetura Futura e Princípios de Domínio 1.2 | Vigente; separar conteúdo do Mountier Agro do Tier Trade na próxima revisão |
| 6 | Arquitetura de Multitenancy Dados e Implantação 1.1 | Vigente |
| 7 | Especificação Funcional | Parcialmente coberta pelos documentos de slice do repositório; consolidar após a Onda A |
| 8 | Data Model e API Specification | OpenAPI no repositório; documento legível por negócio pendente |
| 9 | Relatórios de execução por cenário | Produzidos na Onda A |
| 10 | Termo de cobertura operacional | Produzido na Onda B |

---

## Anexo A Síntese dos gates

| Gate | Pergunta de decisão | Saída |
|---|---|---|
| Onda A | As regras estão homologadas e os cenários da JD foram aceitos pelos diretores? | Autorizar operação paralela e preparação da virada |
| Onda B | O ciclo completo fecha, reconcilia, tem backup e a JD assina o termo? | Virada do recorte da JD |
| Onda C | Contratos a fixar e em dólar operam sem regressão no preço fixo? | Liberar modalidade na JD |
| Onda D | A segunda trading opera só por configuração? | Produto pronto para onboarding repetível |

---

## Anexo B Correspondência entre fases 1.2, ondas 1.3 e plano de execução do repositório

| Fase 1.2 | Conteúdo | Plano de execução (repositório) | Onda 1.3 |
|---|---|---|---|
| Fase 0 | Protótipo e preparação | Sem registro formal; sistema publicado cumpre a função | A (validação pelos usuários da JD) |
| Fase 1 | Núcleo comercial e contratual | Fase 1 implementada, aguardando homologação | A |
| Fase 2 | Execução física e estoque | Fase 2 implementada, aguardando parâmetros | A |
| Fase 3 | Liquidação, fechamento e piloto | Fases 3 e 4 implementadas; fase 5 em execução; contabilização pendente de D07 | A (homologação) e B (virada) |
| Pós-MVP parcial | Preço a fixar, câmbio | Não implementado | C |
| Fase 3 (segunda trading) | Generalização | Não iniciado | D |
| Fases 6 e 7 do repositório | Governança avançada, administração da plataforma | Planejadas | Pós-MVP |
