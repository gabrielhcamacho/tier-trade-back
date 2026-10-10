# Cessões, transferências entre contratos e operações triangulares

**Objetivo:** definir as regras para operações em que o contrato muda de parte, de destino ou de contrapartida depois de assinado: cessão de crédito, cessão de posição contratual, transferência de saldo entre contratos, compensação, washout, venda à ordem, entrega em local diverso, back to back e intercompany.
**Relação com os demais documentos:** o Escopo 1.1 cita cessão, transferência, washout, intercompany, back to back e "triangulação legítima" nos itens 10.1, 10.2, 18.2, 19 e 21.2, sempre como palavra, nunca como regra. O Plano 1.2 deixa intercompany e back to back para pós-MVP, mas pagamento a terceiro e cessão aparecem na Fase 3.
**Status:** proposta de regras e lista de decisões. Tratamento fiscal e jurídico exige validação profissional.
**Data:** 8 de outubro de 2026.

---

## 1. Por que este tema merece documento próprio

Essas operações têm algo em comum: quebram a relação simples "um contrato, duas partes, uma entrega, um pagamento" que todos os fluxos principais assumem. Se o modelo de contrato não previr que a parte pode mudar, que o saldo pode migrar, que a entrega pode ir para um terceiro ou que dois contratos podem se anular, cada uma dessas situações vai virar ajuste manual, e ajuste manual sem origem é exatamente o que o Escopo 20.1 proíbe.

Elas também são a principal fonte de risco fiscal da trading: uma venda à ordem mal documentada ou uma entrega em local diverso sem o fluxo correto de notas transforma operação legítima em triangulação questionável.

---

## 2. Mapa das operações

| Operação | O que muda | Partes envolvidas | Frequência em trading de grãos |
|---|---|---|---|
| Cessão de crédito | O credor do título muda; o contrato não | Cedente, cessionário (banco, FIDC, fornecedor de insumos), devedor | Alta: produtor cede recebível a banco ou a revenda de insumos |
| Pagamento a terceiro | O beneficiário do pagamento muda sem cessão formal | Fornecedor, terceiro indicado, trading | Alta; é a forma informal da cessão |
| Cessão de posição contratual | Uma parte sai e outra entra com todos os direitos e obrigações | Cedente, cessionário, parte remanescente | Média: produtor transfere contrato para outro produtor ou para empresa do grupo |
| Transferência de saldo entre contratos | Quantidade migra de um contrato para outro da mesma contraparte | Mesmas partes, dois contratos | Alta: produtor entrega no contrato errado ou renegocia prazo |
| Compensação entre contratos | Compra e venda com a mesma contraparte liquidam pela diferença | Mesmas partes, dois contratos | Média: troca de insumos, acerto de saldo |
| Washout | Contrato não entregue é liquidado financeiramente pela diferença de preço | Mesmas partes | Média: quebra de safra, oportunidade de mercado |
| Novação | Contrato antigo substituído por novo | Mesmas partes | Baixa |
| Venda à ordem | Trading vende a B e entrega diretamente a C por ordem de B | Vendedor, adquirente originário, destinatário | Alta em venda para indústria com terminal |
| Entrega em local diverso | Produto entregue em endereço diferente do destinatário da nota | Vendedor, comprador, local de entrega | Alta |
| Back to back | Compra e venda casadas sem passar pelo estoque próprio | Fornecedor, trading, cliente | Média |
| Intercompany | Transferência entre empresas do mesmo grupo | Duas empresas do tenant | Depende da estrutura societária |
| Operação com armazém de terceiro | Produto do vendedor depositado em armazém, vendido sem movimentação física | Depositante, armazém, comprador | Alta em cerealistas |

---

## 3. Cessão de crédito e pagamento a terceiro

### 3.1 O que o sistema precisa fazer

| Regra | Detalhe |
|---|---|
| O título permanece vinculado ao contrato | A cessão muda o beneficiário do pagamento, não a origem da obrigação. Liquidação, retenções e conciliação continuam por contrato |
| Retenções seguem o cedente | Funrural, SENAR e demais retenções são calculadas sobre o produtor original, não sobre o cessionário. O cessionário recebe o líquido |
| Notificação do devedor | A cessão só é oponível à trading quando notificada. O sistema registra data, documento e quem conferiu |
| Documentação mínima | Instrumento de cessão assinado pelas partes, dados bancários do cessionário com validação de titularidade, e quando o cessionário for instituição financeira, o registro exigido |
| Cessão parcial | Um título pode ter mais de um beneficiário em proporções ou valores definidos; o sistema divide o título em parcelas por beneficiário |
| Cessão antes da liquidação | Permitida sobre valor estimado; o valor final do título substitui o estimado e a diferença segue a regra do instrumento (fica com o cedente ou com o cessionário) |
| Pagamento a terceiro sem cessão formal | Só com autorização escrita do fornecedor, aprovação por alçada e conta validada; o sistema trata como exceção auditada, não como fluxo normal |
| Conta bancária | A regra de "conta de titularidade do fornecedor" é quebrada deliberadamente; precisa de dupla aprovação e trilha |
| Estorno e devolução | Se a carga for devolvida ou a liquidação estornada após o pagamento ao cessionário, a cobrança do indevido é contra quem? O instrumento precisa dizer; o sistema registra o devedor da diferença |

### 3.2 Efeitos nos demais domínios

- Contas a pagar: o título muda de beneficiário ou se divide; o histórico mostra o beneficiário original.
- Fiscal: a NF-e continua em nome do fornecedor; nada muda.
- Contábil: fornecedor continua sendo o produtor; o pagamento ao cessionário baixa o mesmo passivo. O contador precisa confirmar o tratamento.
- Conciliação: o movimento bancário sai para o cessionário; a regra de conciliação precisa aceitar beneficiário diferente da contraparte do contrato quando há cessão registrada.
- Garantias: se o contrato tinha garantia em favor da trading, a cessão de crédito não a altera.

---

## 4. Cessão de posição contratual

Uma parte transfere a outra o contrato inteiro: direitos, obrigações, saldos, garantias e histórico.

| Regra | Detalhe |
|---|---|
| Anuência obrigatória | A parte remanescente precisa concordar formalmente; sem anuência não há cessão |
| Novo cadastro completo | O cessionário passa por KYC, compliance, crédito e validação de conta como qualquer contraparte nova |
| Saldo transferido | Quantidade não entregue, fixações abertas, adiantamentos em aberto e obrigações pendentes migram; o que já foi executado permanece com o cedente |
| Entregas já feitas | Permanecem liquidadas em nome do cedente; não há reemissão |
| Adiantamento em aberto | Precisa de decisão explícita: o cessionário assume a dívida ou o cedente quita antes da cessão |
| Garantias | Garantia dada pelo cedente é liberada ou substituída pelo cessionário; o sistema não deixa a cessão ativar sem a garantia equivalente, salvo aprovação |
| Perfil tributário | Se o cedente é pessoa física e o cessionário pessoa jurídica, ou vice-versa, as retenções das entregas futuras mudam; o motor fiscal precisa usar o perfil da parte vigente na data da carga |
| Preço e condições | Não mudam; se mudarem, é aditivo, não cessão |
| Versionamento | A cessão cria nova versão do contrato com a parte substituída e preserva a anterior |
| Numeração | O contrato mantém o número; o sistema exibe "cedido de" e "cedido para" |

---

## 5. Transferência de saldo entre contratos

Caso típico: o produtor tem dois contratos com a trading, entrega uma carga apontando o contrato A, mas a carga deveria consumir o B; ou renegocia e parte do saldo do contrato vencido passa para um novo contrato.

| Regra | Detalhe |
|---|---|
| Mesma contraparte e mesma commodity | Transferência entre contrapartes diferentes é cessão, não transferência |
| Dois tipos | Reaplicação de carga (uma carga já recebida muda de contrato) e transferência de saldo (quantidade ainda não entregue muda de contrato) |
| Reaplicação de carga | Permitida enquanto a carga não foi faturada; depois, exige cancelamento ou nota de ajuste e aprovação fiscal |
| Preço | A carga reaplicada liquida pelo preço do contrato de destino; se a liquidação já tinha sido calculada, recalcula e registra a diferença |
| Fixações | Fixação é do contrato; não migra com a carga. Saldo a fixar do contrato de origem volta a crescer; o de destino consome fixação própria |
| Transferência de saldo não entregue | Reduz o contratado do contrato de origem por aditivo e aumenta o de destino por aditivo, ou cria contrato novo; nunca por edição direta do saldo |
| Saldo com preço diferente | Transferir saldo de contrato a R$ 120 para contrato a R$ 130 é renegociação de preço; precisa de alçada e motivo registrado |
| Adiantamento | Adiantamento vinculado ao contrato de origem: a regra de amortização precisa dizer se acompanha o saldo ou permanece |
| Tolerância | A tolerância é recalculada sobre o novo contratado de cada contrato |
| Rastreabilidade | Evento de transferência com origem, destino, quantidade, motivo, autor, aprovação e versão de ambos os contratos |

---

## 6. Compensação entre contratos e washout

### 6.1 Compensação

Quando a trading tem contrato de compra e contrato de venda com a mesma contraparte (por exemplo, vendeu insumos e comprou grãos, ou vendeu e comprou grãos em datas diferentes), as partes podem liquidar pela diferença.

| Regra | Detalhe |
|---|---|
| Acordo formal | Instrumento de compensação assinado; o sistema não compensa automaticamente |
| Títulos permanecem | Cada contrato gera seu título; a compensação é um evento financeiro que baixa os dois pelo menor valor e deixa o residual |
| Retenções | Retenções sobre a compra são calculadas normalmente, mesmo que o pagamento seja por compensação; a obrigação tributária nasce igual |
| Fiscal | Cada operação tem sua nota; compensação não elimina documento fiscal |
| Produto físico | Compensação financeira não substitui entrega; se há entrega física compensando entrega física, é troca e exige notas de ambos os lados |

### 6.2 Washout

Contrato não executado fisicamente é encerrado por pagamento da diferença entre o preço contratado e o preço de referência na data do washout.

| Regra | Detalhe |
|---|---|
| Quem pode pedir | Contrato define; prática: qualquer parte, com anuência da outra, ou a parte inocente em caso de inadimplemento |
| Preço de referência | Preço de mercado na data, fonte definida no contrato (indicador regional, cotação da trading, bolsa mais base); mesma fonte usada em posição |
| Fórmula | valor_washout = (preço_referência − preço_contrato) × quantidade_não_entregue, com sinal definindo quem paga |
| Contrato em dólar | Diferença calculada na moeda do preço e convertida pela regra de câmbio do contrato na data do washout |
| Saldo a fixar | Se o contrato é a fixar, o washout fixa o saldo pela referência e a diferença é zero, salvo prêmio; precisa de regra explícita |
| Multa | Washout por inadimplemento pode acumular multa contratual além da diferença; são componentes separados |
| Documento | Washout não gera NF-e de mercadoria; gera documento de cobrança ou nota de débito, com tratamento fiscal a validar |
| Comissão | Comissão sobre contrato em washout: estornada, proporcional ou mantida, conforme regra da comissão |
| Saldos | Quantidade contratada reduzida ao entregue; contrato encerrado com motivo washout |
| Contabilidade | Resultado do washout é receita ou despesa financeira ou operacional, a definir com o contador |

---

## 7. Venda à ordem e entrega em local diverso

### 7.1 Venda à ordem

A trading vende para B, mas B determina que a entrega seja feita a C. É operação prevista na legislação do ICMS com fluxo documental específico: a trading emite nota de venda para B e nota de remessa por conta e ordem para C; B emite nota de venda para C. Os CFOPs e o tratamento exato dependem de UF e validação fiscal.

| Regra | Detalhe |
|---|---|
| Três partes no contrato | O contrato de venda com B precisa de campo "destinatário da entrega" diferente do comprador |
| Dois documentos de saída | Nota de venda (para B, sem transporte) e nota de remessa (para C, acompanha a carga); ambos vinculados à mesma carga |
| Estoque | Sai uma vez, na remessa física |
| Título | Contra B, pelo valor da venda; C não deve nada à trading |
| Qualidade | Classificação no destino é feita por C; a regra de prevalência precisa considerar que C não é parte do contrato |
| Rejeição por C | Volta para o item de rejeição no destino; a negociação é com B |
| Frete | Contratado conforme o contrato com B; destino é o endereço de C |

### 7.2 Entrega em local diverso

O comprador é B e a entrega é em local de B que não é o endereço da nota (filial, armazém de terceiro, terminal). Fluxo documental mais simples que venda à ordem, mas também com regras de preenchimento da nota (local de entrega). Precisa do mesmo campo "local de entrega" e validação fiscal.

### 7.3 O que separa operação legítima de triangulação questionável

O sistema não decide isso, mas precisa impedir os padrões que o fisco questiona: nota de venda sem documento de transporte compatível, remessa sem nota de venda correspondente, produto saindo do estoque duas vezes ou nenhuma, e preço de venda incompatível com o praticado. A regra mínima é: toda carga física tem exatamente um documento que a acompanha, e todo documento de venda tem a carga ou a remessa que o sustenta.

---

## 8. Back to back

A trading compra de A e vende para C sem que o produto passe por estoque ou local próprio: a carga sai de A direto para C.

| Regra | Detalhe |
|---|---|
| Dois contratos vinculados | Contrato de compra e contrato de venda com vínculo explícito; a alocação é um para um por carga |
| Estoque | O sistema registra entrada e saída na mesma carga, ou um estoque "em trânsito de terceiro", para que titularidade e risco fiquem registrados mesmo sem posse física |
| Classificação | Feita no destino (C) ou por terceiro; serve para os dois contratos; discrepância entre o laudo que a trading aceita de A e o que C aceita da trading é risco da trading |
| Documentos | Nota de compra de A para a trading; nota de venda da trading para C; o transporte acompanha a nota de venda, com local de retirada em A. Fluxo exato a validar por UF |
| Frete | Um frete, apropriado a qual contrato? Regra: ao contrato que assumiu a responsabilidade (FOB ou CIF) |
| Margem | Margem do par compra-venda é a métrica relevante; o sistema precisa mostrar o par |
| Risco | Se C rejeita, a trading fica com a carga sem destino; precisa de fluxo de redirecionamento |

---

## 9. Intercompany

Transferência entre empresas legais do mesmo tenant.

| Regra | Detalhe |
|---|---|
| Contrato interno | Modelado como compra e venda entre duas empresas, com preço de transferência definido por política |
| Fiscal | Cada empresa emite e recebe nota; é operação tributada normalmente, salvo regime específico |
| Consolidação | A margem consolidada do tenant elimina o resultado intercompany; a margem por empresa o mantém |
| Estoque | Sai de uma empresa e entra na outra; titularidade muda, custódia pode não mudar |
| Liquidação | Pode ser por compensação de conta corrente entre empresas, com regra própria |

Está fora do MVP pelo Plano 1.2, mas o modelo de contrato precisa aceitar que comprador e vendedor sejam empresas do mesmo tenant sem tratamento especial no código.

---

## 10. Operações com armazém de terceiro

Produto do vendedor depositado em armazém geral ou na trading, vendido sem sair do lugar.

| Regra | Detalhe |
|---|---|
| Titularidade sem movimento físico | A venda transfere titularidade do lote no armazém; o estoque físico não se move |
| Documentos | Remessa para depósito, retorno simbólico, venda e nova remessa simbólica em nome do comprador; sequência a validar por UF |
| Certificado de depósito | Quando existe CDA ou warrant, a transferência é do título, com regras próprias |
| Classificação | Feita na entrada no armazém; a venda usa o laudo do lote |
| Custo de armazenagem | Até a venda, do depositante; após, do comprador ou conforme contrato |

---

## 11. Regras transversais

- Toda operação deste documento é um evento com tipo, partes, contratos afetados, quantidade, valores, motivo, autor, aprovação, documentos e versão dos contratos antes e depois.
- Nenhuma delas edita saldo diretamente; todas geram aditivo, reaplicação, evento financeiro ou documento.
- Alçadas específicas: cessão de posição, washout, transferência com preço diferente e pagamento a terceiro exigem alçada superior à do contrato original.
- Compliance: o cessionário e o destinatário da entrega passam por verificação de lista restritiva e cadastro antes da operação ativar.
- Posição: cessão e washout alteram a posição da trading na data do evento; transferência de saldo não altera a posição líquida.
- Conciliação: os cinco lados (contrato, documento fiscal, título, banco, tributo) precisam aceitar que a parte que paga ou recebe seja diferente da parte do contrato quando há cessão registrada.

---

## 12. Estados e eventos a acrescentar

| Objeto | Estado ou evento novo |
|---|---|
| Contrato | Cedido (com referência), encerrado por washout, encerrado por compensação, vinculado back to back |
| Título | Cedido parcial, cedido total, beneficiário alternativo autorizado, compensado |
| Carga | Reaplicada, remessa por conta e ordem, rejeitada no destino de terceiro |
| Saldo contratual | Transferido para, recebido de |
| Documento fiscal | Remessa por conta e ordem, remessa simbólica, retorno simbólico, nota de débito de washout |

---

## 13. Cenários que precisam ter resultado esperado

| ID | Cenário | O que verifica |
|---|---|---|
| CT-01 | Produtor cede 100% do recebível de um contrato a banco antes da primeira carga | Título nasce com beneficiário cessionário, retenções sobre o produtor, conciliação aceita |
| CT-02 | Cessão parcial de 60% a revenda de insumos | Título dividido, dois pagamentos, um passivo |
| CT-03 | Pagamento a terceiro sem instrumento de cessão | Bloqueio; só segue com autorização, alçada e conta validada |
| CT-04 | Cessão de posição de produtor PF para empresa PJ com adiantamento em aberto | Anuência, KYC, decisão sobre adiantamento, mudança de perfil de retenção nas cargas seguintes |
| CT-05 | Carga recebida no contrato A reaplicada ao contrato B antes da nota | Recálculo pelo preço de B, saldos de A e B, fixações intactas |
| CT-06 | Reaplicação após NF-e emitida | Exige tratamento fiscal; sem ele, bloqueado |
| CT-07 | Transferência de 200 t de saldo de contrato vencido para contrato novo com preço maior | Aditivos nos dois, alçada por renegociação de preço |
| CT-08 | Washout de 300 t em contrato a preço fixo em real | Diferença calculada, sinal correto, contrato encerrado, comissão tratada |
| CT-09 | Washout em contrato em dólar a fixar | Fixação pela referência, câmbio pela regra, diferença e prêmio separados |
| CT-10 | Compensação entre compra de grãos e venda de insumos | Dois títulos, baixa pela compensação, residual, retenção íntegra |
| CT-11 | Venda à ordem com entrega em terminal de C | Dois documentos de saída, uma saída de estoque, título contra B |
| CT-12 | C rejeita a carga na venda à ordem | Negociação com B, redirecionamento, documentos de retorno |
| CT-13 | Back to back com classificação no destino divergente da origem | Par de contratos, risco da diferença na trading, margem do par |
| CT-14 | Venda de lote depositado em armazém de terceiro sem movimento físico | Titularidade transferida, documentos simbólicos, estoque físico inalterado |
| CT-15 | Intercompany entre duas empresas do tenant | Dois lados fiscais, margem por empresa e consolidada |

---

## 14. Decisões abertas para a trading piloto

| Decisão | Quem responde | Bloqueia |
|---|---|---|
| Quais dessas operações ocorrem hoje e com que frequência | Comercial e financeiro | Escopo do MVP para o tema |
| Documentação mínima aceita para cessão de crédito e para pagamento a terceiro | Jurídico e financeiro | Fluxo de cessão |
| Se a trading aceita cessão de posição contratual e com quais condições | Direção e jurídico | Modelo de parte vigente |
| Regra de reaplicação de carga após nota emitida | Fiscal | Transferência |
| Fonte do preço de referência para washout | Comercial | Fórmula |
| Tratamento fiscal e contábil do washout e da nota de débito | Fiscal e contador | Documento |
| Fluxo documental de venda à ordem e entrega em local diverso nas UFs do piloto | Fiscal | Expedição |
| Se há back to back e como o frete é apropriado | Operações | Par de contratos |
| Se há operação com armazém de terceiro e CDA | Operações | Estoque depositado |
| Política de preço de transferência intercompany, se aplicável | Direção e contador | Fora do MVP |
| Alçadas específicas para cada operação | Direção | Workflow |

---

## 15. Recomendação de sequência

1. Levantar com a trading piloto quais dessas operações existem de fato. Provavelmente cessão de crédito, pagamento a terceiro, reaplicação de carga e entrega em local diverso são as frequentes.
2. Modelar desde já no contrato os campos "parte vigente", "destinatário da entrega" e "local de entrega", e no título o campo "beneficiário", mesmo que o piloto não use. É barato agora e caro depois.
3. Implementar reaplicação de carga e cessão de crédito com os cenários CT-01 a CT-06, porque são as que mais aparecem e as que mais quebram a conciliação.
4. Deixar washout, venda à ordem e back to back com regras escritas e validadas pelo fiscal antes de codificar.
5. Manter intercompany e armazém com CDA fora do MVP, como o Plano já faz, mas sem bloquear no modelo.
