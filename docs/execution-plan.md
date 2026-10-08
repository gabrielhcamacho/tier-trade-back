# Plano vivo de execução do Tier Trade

Atualizado em 08/10/2026. Este documento é atualizado junto com cada entrega para evitar retrabalho e distinguir desenvolvimento, validação técnica e dependências externas.

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

## Próxima sequência recomendada

1. Concluir e publicar o pacote em execução acima.
2. Executar JD-01 a JD-04 com os diretores quando os dados oficiais estiverem disponíveis.
3. Parametrizar D02, D03 e D04 sem embutir regra específica da JD no código.
4. Corrigir as ressalvas do aceite e fechar a homologação do piloto.
5. Retomar preço a fixar e fixações parciais.

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

Próxima sequência técnica sem depender da JD: publicar e conferir os ajustes de apresentação, percorrer as categorias restantes dos relatórios e completar a navegação até anexos realmente armazenados. Em paralelo, permanece pendente o aceite humano JD-01 a JD-04 e a parametrização D02 a D04; nenhuma regra financeira, fiscal ou de qualidade foi inferida nesta entrega.
