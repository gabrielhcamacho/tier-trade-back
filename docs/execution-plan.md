# Plano vivo de execução do Tier Trade

Atualizado em 09/10/2026. Este documento é atualizado junto com cada entrega para evitar retrabalho e distinguir desenvolvimento, validação técnica e dependências externas.

## Estado das fases

| Fase | Objetivo | Estado | Evidência e pendências |
| --- | --- | --- | --- |
| 1 | Oferta, cálculo, aprovação e contrato de compra a preço fixo | Implementada, aguardando homologação humana | Fluxo automatizado e publicado. Falta executar os cenários JD-01 e JD-02 com valores e aceite da JD. |
| 2 | Recebimento, pesagem, qualidade, pátio, ocorrência, romaneio e estoque | Implementada, aguardando homologação humana | Motores, telas e testes integrados existem. Faltam limites, tolerâncias, contraprova e descontos oficiais da JD. |
| 3 | Fiscal de compra, contas a pagar, pagamentos e conciliação | Implementada, aguardando parametrização | NF-e de entrada, título, pagamento, estorno e conciliação existem. Falta a matriz fiscal e bancária oficial. |
| 4 | Venda, alocação, expedição, fiscal de saída e contas a receber | Implementada, aguardando homologação humana | Jornada técnica existe. Falta executar JD-03 e JD-04 com os diretores. |
| 5 | Relatórios e rastreabilidade transversal | Em execução | Relatórios contratuais já publicados. Este pacote adiciona financeiro, fiscal, estoque, operações e visão consolidada. |
| 6 | Governança avançada de usuários, unidades e permissões | Planejada, não prioritária | Plano preservado para retomada. O MVP mantém isolamento por tenant e capacidades atuais. |
| 7 | Administração interna da plataforma e comercialização de planos | Posterior ao piloto | Fora da prioridade atual do produto da trading. |

## Pacote em execução

| Atividade | Estado | Critério de conclusão |
| --- | --- | --- |
| Relatórios de financeiro, fiscal, estoque e operações | Implementado e validado | CSV autenticado, isolado por tenant e baseado nos dados persistidos; build de produção aprovado. |
| Rastreabilidade consolidada | Implementada e validada | Encadeia oferta, compra, carga, documento, estoque, venda e financeiro sem criar dados fictícios; tipagem e build aprovados. |
| Estados vazios e usabilidade da demonstração | Implementado e validado | Ausência de dados explica a próxima ação possível nas telas operacionais, fiscais, financeiras e de estoque alcançadas. |
| Automação oficial de venda, expedição e liquidação | Implementada e executada | `test:pilot:sales-settlement` aprovado no PostgreSQL descartável do Colima no HD externo. |
| Validação e publicação | Concluída | Tipagem, builds, ações de servidor e jornada integrada aprovados; frontend `625c65f` publicado e saudável, backend `a0443bf` versionado sem alteração de runtime. |

## Validação do pacote em 07/10/2026

- frontend: tipagem, verificação de ações de servidor e build de produção aprovados;
- backend: build aprovado;
- jornada integrada: uma prova executada e aprovada, com cinco cenários não selecionados corretamente ignorados pelo filtro do comando;
- banco de teste: `tier_trade_test` no Colima armazenado no HD externo, sem acesso ao Supabase de produção;
- revisão React: consultas independentes paralelizadas, páginas mantidas como componentes de servidor e nenhuma nova dependência enviada ao navegador.
- produção: deploy do frontend ficou `READY`; `/rastreabilidade` respondeu HTTP 200 e a API respondeu `ready` com banco `ok`.

## Decisões externas que continuam pendentes

- D02: limites, tolerâncias, contraprova e descontos por commodity da JD.
- D03: matriz fiscal oficial da JD no Mato Grosso.
- D04: bancos, formatos de extrato e aprovadores/alçadas nominais.
- D05: aceite dos quatro cenários reais pelos diretores da JD.
- D06: formato OFX/CNAB, somente se a importação bancária fizer parte do piloto.
- D07: regra futura de preço a fixar e fixações parciais.
- D08: matriz avançada de acesso por função e unidade.
- D09: integrações externas efetivamente contratadas para produção.
- D10: confirmar se a NF-e fiscal de compra deve obrigatoriamente manter o mesmo número e chave da NF-e do recebimento, e qual é o rito quando o documento de origem precisa ser corrigido. O backend atual não compara o número ao registrar o documento fiscal.

## Recalibração após validação com diretor de trading em 09/10/2026

A validação confirmou a direção do produto — centralização, agenda de cargas, estoque físico, fluxo de caixa, preço médio, margem projetada e rastreabilidade — e não autoriza reimplementar capacidades que já existem. O próximo ciclo deve provar e completar o encadeamento econômico por carga: contrato, qualidade, pesos, custos, tributos, documentos, nota de compra, nota de venda, títulos e caixa.

| Frente | Estado encontrado | Incremento necessário | Gate de saída |
| --- | --- | --- | --- |
| Semântica financeira | Previsão, título, baixa, margem projetada e margem realizada já existem, mas podem ser confundidos na apresentação. | Definir glossário único e exibir composição/rastreabilidade de receita bruta, custo apropriado, margem projetada, margem realizada, a pagar, a receber e caixa. | Nenhum KPI financeiro é exibido sem nome, período, estado e memória; o usuário chega do indicador ao fato de origem. |
| Conciliação origem–destino | Pesos de recebimento, estoque, expedição, notas e títulos existem em módulos separados. | Criar uma visão por carga que confronte peso e valor de origem com peso e valor de destino, mostrando ganho/perda física, efeito monetário e causas. | Um cenário com diferença positiva e outro com diferença negativa fecham sem cálculo paralelo. |
| Qualidade e desconto | Indicadores, decisão humana e versionamento existem; valores oficiais continuam bloqueados por D02/D03. | Homologar tabela por commodity e contrato; aplicar desconto/bonificação com memória, contraprova, aprovação e ajuste financeiro, sem tratar a relação `1 p.p. = 1%` como regra universal. | O laudo explica peso/valor aceitos, ajuste da nota/título e reflexo posterior na margem e no estoque. |
| Formação de preço e margem | Custos persistidos e margem gerencial existem. | Garantir que classificação, frete, despesas contratuais, tributos e ajustes de qualidade participem da formação e da ponte projetado–realizado. | A margem final de um contrato com múltiplas cargas é reproduzível por componente e por carga. |
| Fiscal automático com revisão | Motor configurável, versionado e auditável existe; a matriz oficial da JD continua pendente. | Cadastrar catálogo governado por produto, UF de origem/destino, perfil da contraparte, natureza da operação e vigência; selecionar a regra aplicável automaticamente e exigir revisão quando houver ambiguidade. | Os cenários fiscais homologados são selecionados sem o operador montar alíquotas a cada contrato e mantêm memória da versão usada. |
| Entrada, saída e liquidação | NF de compra, NF de saída, contas a pagar/receber, baixas e estornos já existem. | Validar o pareamento por carga e contrato e resolver D10 para a cadeia documental de compra. | Compra e venda correlacionadas explicam quantidades, valores, vencimentos e saldos sem duplicidade. |
| Ticket de descarga e requisitos do sacado | Workflow manual e auditável implementado por sacado/terminal, com política versionada, responsável, prazo, ticket, portal, situação e consequência configurada. | Homologar V04 para decidir quando a consequência deixa de ser apenas informativa e passa a bloquear fechamento ou antecipação. | Uma expedição materializa a regra vigente e permanece na fila até envio, aceite, rejeição ou dispensa; nenhum bloqueio financeiro é inferido antes de V04. |
| Cotas e portais externos | Integrações ainda dependem de D09 e de viabilidade por provedor. | Primeiro operar checklist e evidência manual; depois levantar Rumo, Origem, CTA, Cutrale e demais portais, classificando API, credencial, termo de uso, estabilidade e retorno econômico. | Nenhuma automação é prometida antes de prova técnica por portal; o fluxo manual auditável permanece disponível. |
| Documentos/XML | Arquivo privado, upload, download e vínculos já existem. | Provar o fluxo real com arquivo autorizado e completar vínculos de XML, laudo, ticket e comprovante com carga/nota/contrato. | Documento real é localizado pela operação, baixado com autorização e preserva versão e auditoria. |

### Premissas de implementação

- Diferença entre balanças não recebe tolerância legal fixa no produto; o limite é contratual/configurável e a conformidade metrológica da balança é informação separada.
- `FETHAB`, `INDEA-MT`, `IAGRO-MS`, `SENAR` e demais itens devem ser tratados como conceitos distintos, com jurisdição, vigência, base e responsabilidade explícitas.
- A configuração fiscal continua versionada e auditável, mas o operador comum recebe uma regra sugerida pelo catálogo, em vez de reconstruir a tributação manualmente.
- Ticket de descarga pode ser requisito de cobrança, antecipação ou liberação de limite, mas esse efeito é parametrizado por sacado e produto financeiro.
- Margem realizada gerencial não será chamada de margem líquida contábil enquanto D07 não estiver resolvida.

### Início da etapa 1 em 09/10/2026

A pauta [Workshop de decisões V01–V05](validation-workshop-v01-v05.md) foi preparada com recomendações, participantes, materiais prévios, perguntas de decisão e gates. V01–V05 estão **em preparação**, não aprovadas. A inspeção do sistema confirmou dois limites que precisam estar explícitos na reunião: a margem realizada atual não equivale à margem líquida contábil e a expedição ainda não registra o peso aceito no destino/ticket como fato próprio.

### Início da etapa 2 em 09/10/2026

Os cinco ensaios foram especificados em [Cenários de validação V01–V05](pilot-validation-scenarios-v01-v05.md), sempre com números sintéticos identificados e sem transformar simulação em regra oficial. A API passou a declarar o escopo da margem operacional realizada, incluindo e excluindo componentes explicitamente. A interface foi ajustada para distinguir fluxo líquido realizado de saldo bancário e margem operacional de margem líquida contábil. A conciliação origem–destino continua bloqueada apenas na consequência de negócio; o próximo incremento técnico pode registrar peso/ticket de destino sem aplicar tolerância ou ajuste automático.

Validação deste incremento: 24 testes locais aprovados, compilação da API aprovada, além de tipagem, verificação de ações de servidor e build de produção do frontend aprovados. A revisão React não encontrou novo estado, efeito, dependência de navegador ou aumento de fronteira cliente. A validação PostgreSQL integrada foi concluída na etapa seguinte.

### Etapa 3 — primeiro incremento de conciliação em 09/10/2026

Foi implementado o registro versionado do peso aceito e do ticket no destino por expedição. Uma correção preserva a versão anterior, o motivo e a auditoria; o quadro de estoque confronta peso expedido e peso aceito e mostra a diferença física positiva, negativa ou zero. Este evento não altera estoque, nota, título, caixa ou margem e sempre informa `PENDING_POLICY` enquanto V02–V04 não forem aprovadas.

O fluxo inclui migração com isolamento por tenant, permissão operacional, limpeza segura do ambiente demo, endpoint autenticado, validação temporal da descarga, formulário e quadro de conciliação. O teste integrado cobre peso positivo e correção para peso negativo. A migração foi aplicada pelo teste local em PGlite e pelo PostgreSQL descartável; os builds da API e do frontend, a tipagem e a verificação de ações de servidor foram aprovados.

### Recuperação e validação integrada em 09/10/2026

O perfil Colima `tier-trade` foi recuperado sem recriar a VM, o volume Docker ou o banco. A falha era causada por agentes e túnel SSH órfãos após a interrupção anterior: a VM voltou com o disco existente, o PostgreSQL concluiu a recuperação automática de WAL e a porta documentada `55432` foi restabelecida. Nenhum dado de produção ou projeto Supabase foi acessado.

A suíte completa passou no PostgreSQL dedicado `tier_trade_test`: **19 arquivos e 47 testes aprovados**, incluindo comercial, operações, estoque, fiscal, financeiro, risco, controle de acesso, reset demo e migrações. O cenário de destino confirmou versão 1 com diferença positiva, correção para versão 2 com diferença negativa, preservação do movimento de expedição e efeito financeiro `PENDING_POLICY`. As suítes comercial e fiscal também foram alinhadas ao contrato assíncrono atual do dashboard, aplicando as migrações do read model e solicitando atualização explícita antes de validar indicadores.

Situação dos cinco ensaios antes da etapa 4: VAL-01 e VAL-02 estavam automatizados no fluxo de destino; VAL-03 tinha componente manual de desconto e impacto no título, mas não os números exatos; VAL-04 tinha o motor fiscal, mas não o catálogo sintético isolado; VAL-05 apenas detectava o ticket ausente.

### Etapa 4 — fechamento técnico de VAL-03 a VAL-05 em 09/10/2026

VAL-03 foi executado com os números sintéticos exatos: base didática de R$ 40.000,00, taxa candidata de 10%, componente manual de R$ 4.000,00 e saldo simulado de R$ 36.000,00. A suíte integrada confirma que o componente reduz o título de compra em R$ 4.000,00 e não altera o saldo físico. A descrição e a referência do componente o identificam como ensaio; a fórmula continua sem validade de produção até V03.

VAL-04 recebeu um catálogo estritamente isolado no teste, com `TRIBUTO_TESTE_A` a 1,00% e `TRIBUTO_TESTE_B` a 0,20% sobre R$ 100.000,00. A memória reproduz R$ 1.000,00 + R$ 200,00, total de R$ 1.200,00 e líquido de R$ 98.800,00. Nenhuma configuração sintética foi persistida ou disponibilizada ao operador. O fluxo fiscal integrado já cobre configuração versionada, cálculo, aceite, obrigação, título, liquidação e estorno com os tipos oficialmente suportados.

VAL-05 foi implementado como workflow por sacado e terminal. Uma política ativa e versionada define tipo de exigência, título, responsável, prazo em horas, portal e consequência potencial. Cada nova expedição correspondente recebe uma cópia imutável desses dados; o operador registra evidência, protocolo e transições `PENDING`, `SUBMITTED`, `ACCEPTED`, `REJECTED` ou `WAIVED`, todas auditadas. Ticket informado no destino é associado à pendência correspondente. A interface mostra a fila e permite cadastrar nova versão da política e atualizar a ocorrência. Consequências de fechamento ou antecipação são exibidas como **não aplicadas** até V04.

Validação desta etapa: **19 arquivos e 49 testes aprovados** no PostgreSQL local dedicado, incluindo o fluxo completo de política → expedição → pendência → protocolo; build da API, tipagem, verificação de ações de servidor e build de produção do frontend aprovados. A migration inclui RLS forçada por tenant, índices da fila, referências compostas e limpeza segura do tenant demo. Nenhum deploy, dado de produção ou regra oficial foi alterado.

### Etapa 5 — conciliação econômica por expedição em 10/10/2026

Foi implementada a visão econômica derivada por expedição, sem criar nova fonte de verdade. A cadeia liga contrato de compra, carga e lote à versão do contrato de venda, evento financeiro de receita, custo de aquisição proporcional, componentes ativos de compra, margem operacional, NF-e de saída, título a receber, baixas não estornadas e saldo em aberto. Peso aceito e ticket do destino aparecem na mesma linha para comparação documental, mas continuam sem aplicar ajuste em nota, título ou caixa.

A consulta usa somente vínculos persistidos e preserva a semântica já declarada de `OPERATIONAL_REALIZED_MARGIN_V1`: receita da expedição menos custo de aquisição proporcional e componentes ativos. Se a compra ainda não tiver evento valorizado, custo e margem ficam explicitamente pendentes; não são preenchidos por estimativa. NF-e, recebível e baixa também exibem ausências separadamente, permitindo localizar o ponto incompleto da cadeia.

A interface de Estoque recebeu o quadro “Da carga ao recebimento”, com links para a carga e colunas de volume expedido/destino, receita, custo, margem, NF-e, título, recebido e saldo. A implementação permaneceu no componente de servidor, sem novo estado cliente, efeitos ou chamadas em cascata.

Validação: todas as migrations e o seed demo foram aplicados em PostgreSQL embutido descartável; a prova ligou expedição, carga, custo proporcional, NF-e `NFE-DEMO-0001`, título `TR-2026-0001`, baixa de R$ 4.000,00 e saldo de R$ 7.360,00, além de conferir a identidade `margem = receita − custo − componentes`. A API compilou; **27 testes passaram e 23 integrações externas foram puladas** porque o volume `HD Externo`, que contém o Colima, deixou de estar visível ao macOS durante a execução. Tipagem, ações de servidor e build de produção do frontend passaram. Nenhum dado foi recriado ou apagado e nenhum deploy foi executado.

## Próxima sequência recomendada

1. Fechar as decisões V01–V05 registradas em `decisions-pending.md` com uma sessão curta de processo envolvendo direção, fiscal, financeiro e logística; pauta e recomendações já estão preparadas.
2. Quando o `HD Externo` voltar a ser reconhecido, iniciar o Colima e repetir a suíte integrada completa no PostgreSQL dedicado, sem recriar o volume.
3. Homologar e implementar o desconto de qualidade contratual com memória, contraprova, aprovação e ajuste financeiro.
4. Parametrizar a matriz fiscal oficial e adicionar seleção automática por contexto com revisão humana para exceções.
5. Provar upload/download e vínculos de documentos com arquivos de ensaio autorizados.
6. Executar os cenários JD-01 a JD-04 e VAL-01 a VAL-05 com os diretores; corrigir apenas lacunas observadas e registrar o aceite.
7. Após V04, ativar de forma controlada as consequências de fechamento ou antecipação que hoje são apenas registradas no workflow por sacado.
8. Levantar e priorizar integrações externas por portal somente depois do fluxo manual homologado e da análise de viabilidade.
9. Retomar preço a fixar, contábil e risco de mercado conforme D02, D07 e D08, sem concorrer com o fechamento do piloto operacional.

Itens concluídos nas rodadas de 09 e 10/10: execução exata de VAL-03; catálogo isolado e memória exata de VAL-04; workflow manual e auditável de VAL-05; conciliação econômica por expedição/carga/contrato. O item 1 permanece primeiro porque exige decisão humana. A repetição no PostgreSQL externo foi adicionada como atividade operacional por causa da desmontagem física do volume, não por falha funcional detectada.

## Pacote iniciado em 08/10/2026

| Atividade | Estado | Critério de conclusão |
| --- | --- | --- |
| Filtros e detalhamento da rastreabilidade | Implementado e validado | Filtra compra/venda, commodity, situação e texto, exibindo o estágio de cada elo persistido; tipagem e build aprovados. |
| Filtros de relatórios | Implementado e validado | Período e critério textual aplicados no servidor aos CSVs de financeiro, fiscal, estoque e operações; build aprovado. |
| Importação bancária extensível | Implementada e validada | Lote auditável, idempotência por conteúdo, deduplicação por lançamento, histórico e adapter CSV inicial; base preservada para OFX/CNAB sem presumir layouts bancários. |
| Validação e publicação do pacote | Concluída | Migration aplicada; 43 testes, tipagem e builds aprovados; frontend `525461b` READY na Vercel e backend `b01e38a` ACTIVE na DigitalOcean com banco `ok`. |

## Validação do pacote em 08/10/2026

- frontend: tipagem e build de produção aprovados, incluindo filtros, modelo CSV e interface de importação;
- backend: build aprovado e suíte completa com 43 testes aprovada no PostgreSQL do Colima no HD externo;
- importação bancária: duas linhas importadas, repetição do mesmo conteúdo com outro nome reconhecida sem duplicação e origem por lote/linha preservada;
- banco de produção: migration aplicada com RLS forçada e isolamento por tenant; o advisor de segurança não identificou ressalva na nova tabela;
- pendência de segurança externa ao pacote: a proteção contra senhas vazadas do Supabase Auth continua desativada e deve ser avaliada antes da abertura ampla do produto;
- performance: índices recém-criados aparecem como ainda não utilizados, comportamento esperado antes do primeiro uso em produção; não foram removidos.
- produção: rastreabilidade e modelo CSV responderam HTTP 200 no frontend; a prontidão do backend respondeu `ready` com banco `ok`.

## Consulta navegável dos relatórios

| Atividade | Estado | Critério de conclusão |
| --- | --- | --- |
| Exploração dos relatórios na interface | Implementada e validada por compilação | Os relatórios de financeiro, fiscal, estoque e operações permitem consultar as mesmas categorias e filtros do CSV, abrir uma linha e examinar seus campos de origem. |
| Navegação para objetos relacionados | Implementada e validada por compilação | Detalhes apontam para contrato, carga, recebível, lote ou cálculo fiscal quando existe tela correspondente, preservando a identidade do tenant nas consultas ao backend. |
| Arquivos de documentos | Parcial, sem simulação | Referências de NF-e, tickets e documentos aparecem nos registros; o acesso ao arquivo depende de anexo efetivamente vinculado à operação de origem. Não há link fictício para PDF inexistente. |
| Homologação autenticada em produção | Parcial | Conta demo abriu os quatro domínios, o detalhe financeiro chegou ao recebível, o detalhe fiscal chegou à carga, o filtro textual e de período funcionou e o CSV fiscal baixou com a linha esperada. Restam percorrer todas as categorias e resolver D10. |

Publicação técnica: frontend `a037983` no GitHub e deploy `READY` na Vercel; a rota nova respondeu HTTP 200 com redirecionamento correto para login quando acessada sem autenticação. Plano versionado no repositório do backend. Essa checagem não substitui o teste autenticado do conteúdo.

## Teste autenticado da conta demo em 07/10/2026

- `financeiro/eventos`: dois registros carregados; a linha de venda abriu o detalhe e o vínculo chegou ao recebível com título, saldo e memória de cálculo.
- `fiscal/entradas`: uma NF-e localizada por `NF-SMOKE`, zero registros no período de setembro e CSV exportado com a mesma NF-e e colunas esperadas. O detalhe trouxe a carga e o contrato relacionados.
- `estoque/lotes`: dois lotes carregados; `operacoes/recebimentos`: três cargas carregadas. Não foi executada mutação de dados nesses testes.
- falhas de apresentação identificadas e corrigidas no frontend: a rota de relatórios destacava incorretamente Comercial no menu, e valores/quantidades/datas eram exibidos em formato bruto. A formatação agora preserva as casas decimais originais sem arredondamento financeiro implícito.
- ressalva de consistência da conta demo: o documento fiscal de entrada `NF-SMOKE-1161539417` aponta para a carga `d700...0003`, cuja tela mostra como NF-e do recebimento vigente `NF-DEMO-2026-0045`. A criação fiscal exige recebimento aceito e vigente, mas não compara o número informado com o número do recebimento. D10 deve ser decidido antes de impor bloqueio ou alterar registros de produção.
- publicação da correção de apresentação: frontend `a94f2bf` em produção, deploy `READY`; conferência autenticada no navegador mostrou o submenu Fiscal e `R$ 52.575,00` na linha da NF-e filtrada. O build de produção, a tipagem, a verificação de ações de servidor e testes da formatação decimal passaram.

## Relatórios completos e arquivo de documentos em 08/10/2026

| Atividade | Estado | Evidência ou limite |
| --- | --- | --- |
| Percorrer todas as categorias restantes | Concluída na conta demo | Títulos 2, liquidações 2, conciliação 0; saídas fiscais 1, cálculos 0, obrigações 0; movimentos 3, vendas 1; pátio 3, qualidade 3, ocorrências 1. As categorias vazias carregaram sem erro e não foram artificialmente populadas. |
| Ligações de anexos nos detalhes dos relatórios | Implementada e validada por build | Consulta a API de documentos para os objetos de origem do registro. Exibe download apenas para arquivo `AVAILABLE`, sempre pela rota autenticada que emite URL temporária do bucket privado; também aponta para a tela de origem onde o arquivo pode ser enviado. |
| Nova tela de arquivo transversal | Implementada e validada por build | `/documentos` consulta metadados persistidos do tenant, filtra por origem, tipo, situação, período e critério, e abre origem ou arquivo real. Não produz PDF a partir de referência textual. |
| Armazenamento | Envio corrigido; falta prova de upload real nesta entrega | O navegador agora envia o arquivo diretamente ao Supabase por URL assinada, sem passar os bytes pelo limite das ações de servidor da Vercel. O backend autoriza, registra metadados e só marca `AVAILABLE` após conferir a presença do objeto. O download exige autenticação e gera URL de 60 segundos. O teste atual de relatório não inseriu arquivo fictício no banco de produção. |

Validação técnica desta entrega: tipagem, build de produção e verificação de ações de servidor aprovados. O frontend `9479a17` foi publicado no GitHub e a Vercel informou deploy de produção `READY` para esse commit. A conta demo abriu `/documentos` com zero arquivos reais e o detalhe da NF-e de entrada exibiu a ausência de anexo, além de links para a carga e o contrato onde é possível anexar. Nenhuma migration ou alteração de regra fiscal, financeira ou de tenant foi necessária. D10 continua pendente e os números da NF-e divergente da conta demo não foram modificados.

Próxima sequência técnica sem depender da JD: testar upload e download real de um arquivo de ensaio em ambiente controlado ou com um documento de demonstração autorizado, ampliar cobertura automatizada dos vínculos dos anexos e paginar a consulta global de documentos para volumes maiores. Em paralelo, permanece pendente o aceite humano JD-01 a JD-04 e a parametrização D02 a D04; nenhuma regra financeira, fiscal ou de qualidade foi inferida nesta entrega.

## Correção de navegação entre listas e detalhes em 08/10/2026

| Atividade | Estado | Evidência ou limite |
| --- | --- | --- |
| Contratos: custos, entregas e demais subtelas | Implementada e validada por build | Linhas da carteira abrem o detalhe do contrato pelo topo, sem âncora automática nem troca para Operações. A subtela e os filtros de origem seguem na URL e no caminho de volta. |
| Demais tabelas com âncora para outra página | Implementada e validada por build | A navegação compartilhada das linhas remove a âncora quando o destino é outra página e solicita rolagem ao topo. Detalhes expandidos na própria página de relatório preservam a âncora intencional. |
| Navegação de terceiro nível | Implementada e validada por build | O detalhe de contrato mantém o submenu de Contratos, destaca a subtela de origem e oferece breadcrumb e retorno a ela; obrigações têm retorno específico. |
| Voltar e feedback de navegação | Implementada e validada por build | Controle de voltar compartilhado redesenhado como botão de ícone discreto junto ao breadcrumb, inclusive no roteiro e nos relatórios. Aviso flutuante “Abrindo página…” removido; permanece somente a barra superior sutil de progresso. |

Validação: tipagem, verificação de ações de servidor e build de produção aprovados. Frontend `7395dfa` publicado no GitHub e deploy de produção `READY` na Vercel. Com a conta demo, Custos e margem abriu o detalhe sem fragmento e com rolagem inicial em zero; Entregas > Cooperativa Vale do Cerrado manteve o submenu de Contratos e o botão retornou a Entregas. O aviso flutuante não aparece mais; só a barra de progresso foi observada. Sem alteração de banco, backend, regras de domínio ou dados da conta demo. Seguem depois upload/download real de arquivo de ensaio autorizado, testes dos vínculos de anexos e paginação do arquivo transversal.

## Ajuste visual de anexos e números em 08/10/2026

| Atividade | Estado | Evidência ou limite |
| --- | --- | --- |
| Seletor de arquivo nos detalhes | Implementado e publicado | O botão nativo foi ocultado sob um controle acessível com ícone e nome do arquivo selecionado. Tipo, arquivo, observação e ação compartilham o mesmo alinhamento no desktop; a grade permanece responsiva. O envio continua usando o mesmo campo `file` e o armazenamento privado existente. |
| Zero sem traço diagonal | Implementado e publicado | Valores e identificadores operacionais usam Geist Sans, preservando algarismos tabulares para alinhamento. Não houve mudança de valores, fórmulas ou precisão. |

Validação: tipagem, ações de servidor e build de produção aprovados. Frontend `88b9b77` publicado no GitHub e deploy de produção `READY` na Vercel. Conferência autenticada no detalhe do contrato mostrou os três rótulos e controles na mesma altura, seletor nativo invisível e valores calculados em Geist Sans. A interação de upload/download não foi repetida nesta entrega; o fluxo funcional de arquivo de ensaio segue na próxima sequência, sem criar nem alterar documentos de produção neste ajuste.

Próxima sequência sem depender de regra da JD: validar de ponta a ponta a seleção, o envio, a listagem e o download de um arquivo de ensaio apropriado; automatizar os vínculos dos anexos entre relatórios e objetos de origem; paginar a consulta transversal de documentos. Permanecem para aceite humano os cenários JD-01 a JD-04 e as decisões D02 a D04 e D10.

## Paginação do arquivo transversal em 08/10/2026

| Atividade | Estado | Evidência ou limite |
| --- | --- | --- |
| Consulta paginada por tenant | Implementada e testada localmente | Endpoint autenticado separado de `/v1/documents`, com 25 documentos por página, total exato, ordenação estável por data e ID e os filtros de origem, tipo, situação, período e critério aplicados no PostgreSQL. A consulta já usada nos detalhes de contrato e carga não foi alterada. Suíte completa: 43 testes aprovados no Colima. |
| Tela geral de documentos | Implementada e validada por build | Total e página atual visíveis; navegação anterior/próxima preserva os filtros. Busca não carrega todo o arquivo no navegador. |
| Índice de consulta | Migration criada e testada no Colima; pendente em produção | Índice `(tenant_id, created_at DESC, id DESC)` para a listagem geral. A credencial vinculada ao Supabase CLI recebeu 403 e a credencial de runtime não tem privilégio de DDL; não foi executada mudança direta no banco de produção. O endpoint funciona sem o índice, mas ele deve ser aplicado para volumes maiores. |
| Upload e download reais | Pendente para teste conjunto | Esta entrega só altera consulta de metadados e navegação. Não substitui a prova autenticada de seleção, envio, listagem e download de um arquivo de ensaio. |

Publicação: backend `8ba4cfe` implantado e `ACTIVE` na DigitalOcean; frontend `29554ad` com deploy de produção `READY` na Vercel. Na conta demo, `/documentos` exibiu um arquivo já existente, total de um registro e indicador “Página 1 de 1”. Nenhum arquivo foi enviado, baixado ou alterado nessa conferência. Build do backend e frontend aprovado; 43 testes do backend passaram no banco de teste do Colima. O índice de produção permanece pendente por falta de permissão de DDL, sem impedir a consulta no volume atual.

Próxima sequência proposta sem depender de novas regras da JD: automatizar a cobertura dos vínculos de anexos a contratos, cargas e relatórios; melhorar a tela de documentos com busca por origem e acesso direto ao registro relacionado; retomar telas operacionais já previstas no plano, priorizando lacunas reais verificadas no código antes de abrir novos módulos. O envio de arquivo de ponta a ponta será testado com o usuário na sequência combinada. Decisões D02 a D04, D07, D08 e D10 continuam fora deste pacote.

## Publicação das novas Visões Gerais em 08/10/2026

| Atividade | Estado | Evidência ou limite |
| --- | --- | --- |
| Visões Gerais dos oito módulos | Publicadas | Frontend `51a69f9` no GitHub, deploy de produção `READY` na Vercel e alias `tier-trade-front.vercel.app` apontando para essa revisão. |
| Snapshots e desdobramentos dos indicadores | Publicados | Backend `171cc54` no GitHub e deployment `ACTIVE` na DigitalOcean, com API e worker no serviço combinado existente. A API respondeu `ready` com banco `ok`. |
| Banco de produção | Alinhado para este pacote | Migration idempotente `grant_dashboard_pricing_read` registrada; a permissão `SELECT` de runtime em `app.pricing_scenarios` foi confirmada. Os oito módulos têm snapshot persistido com `breakdowns`; fila de atualização sem erro pendente na conferência. |
| Testes de regressão | Aprovados | Suíte completa do backend: 47 testes em 19 arquivos no PostgreSQL do Colima no HD externo. Build da API aprovado. No frontend, tipagem, verificação de server actions e build de produção aprovados antes da publicação. |
| Teste visual autenticado | Pendente | O deploy, a saúde da API e os snapshots foram verificados, mas esta entrega não percorreu visualmente as oito telas com a conta demo em produção. |

Próximo passo: conferir as oito Visões Gerais autenticadas, em desktop e largura menor, com dados da conta demo e estados sem dados. Depois retomar a prova real de upload/download e vínculos dos anexos, sem antecipar regras financeiras ou fiscais pendentes de validação da JD.

## Dados nas Visões Gerais da conta demo em 08/10/2026

- A conta `demo@tiertrade.com.br` foi identificada por associação ativa a um único tenant marcado como demonstração. Não houve reset da base, exclusão nem substituição dos registros que o usuário pode editar.
- Os oito snapshots foram enfileirados novamente somente para esse tenant. A conferência posterior encontrou os oito módulos persistidos e nenhuma atualização pendente ou com erro. A sessão autenticada exibiu indicadores e gráficos de Central, Comercial, Contratos, Operações, Estoque, Risco, Financeiro e Fiscal.
- O problema principal era a combinação de snapshots anteriores ao novo detalhamento e ausência de atualização automática da página após o worker recalcular. O frontend `22080e8` adicionou consulta automática limitada para estados `STALE` e `REBUILDING`; tipagem, verificação de server actions e build passaram, e o deploy de produção ficou `READY` na Vercel.
- Evidência de origem: o tenant demo preserva 4 ofertas, 2 contratos de compra, 1 de venda, 3 cargas, 2 lotes, 2 títulos e 2 documentos fiscais. Esses dados alimentam os painéis por meio da API, não por números embutidos nas telas.
- Limite honesto: no Fiscal, documentos e validações aparecem, mas gráficos de apuração, componentes tributários e obrigações continuam sem lançamentos porque a configuração fiscal está em rascunho e não existe cálculo homologado para o tenant. Não foram inventados tributos ou obrigações apenas para preencher a demonstração.

Próxima sequência: testar a atualização automática em uma nova atualização assíncrona real e revisar a densidade dos gráficos com a conta demo; para enriquecer o cenário com soja e tributos, criar registros pelos fluxos de domínio e somente após validar as regras fiscais necessárias. Permanece também o teste completo de upload/download de anexos.
