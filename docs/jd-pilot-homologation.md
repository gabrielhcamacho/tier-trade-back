# Homologação do piloto JD — soja e milho

## Objetivo

Validar ponta a ponta o primeiro piloto da JD para compras e vendas de soja e milho, com preço fixo nesta entrega. Preço a fixar e fixações parciais permanecem registrados no plano posterior e não são condição de aceite deste primeiro piloto.

## Cobertura técnica automatizada

- oferta de milho e soja com cálculo determinístico e política de margem versionada;
- aprovação comercial e ativação do contrato de compra;
- agendamento, pátio, pesagens, qualidade ampliada (umidade, impureza, avariados, quebrados, queimados e ardidos), ocorrência e romaneio versionado;
- entrada de estoque pelo recebimento aceito;
- NF-e de compra conferida contra peso e preço, título a pagar e estorno sem apagar histórico;
- composição configurável da compra: desconto de qualidade, frete, armazenagem, retenção e outros componentes;
- configuração fiscal separada para venda/expedição e compra/recebimento;
- contrato de venda, reserva de estoque, expedição, NF-e de saída, título a receber, recebimento e estorno;
- margem realizada por commodity usando receita expedida, custo de aquisição e componentes persistidos;
- política financeira versionada, lote de pagamento, alçada e segregação de função;
- registro manual auditado de lançamento de extrato e conciliação exata de crédito/recebimento ou débito/pagamento;
- isolamento por tenant, RLS, auditoria e eventos de saída.
- titularidade, risco, custódia, remaneios, perdas e inventários físicos em livro auditável;
- comissão por política versionada e valor-base financeiro persistido, sem arredondamento silencioso;
- metadados de documentos, versões, assinaturas e URLs temporárias em bucket privado do Supabase de produção.

### Evidência executável disponível

- cenário integrado de soja: oferta e margem, aprovação automática, contrato de compra, carga, recebimento, ocorrência, correção versionada do romaneio, NF-e e título de compra, desconto de qualidade explícito, lote de estoque, contrato de venda, alocação, expedição, NF-e de saída, recebimento parcial e conciliação bancária;
- cenário integrado de milho: compra, recebimento, estoque, venda, expedição e financeiro;
- teste de isolamento RLS para contas bancárias, componentes de custo de compra, políticas financeiras, lotes de pagamento, itens do lote e lançamentos de extrato;
- contrato OpenAPI atualizado para os fluxos fiscais de compra e para governança, lotes e conciliação financeira.

Os valores usados nessas provas são dados demonstrativos explícitos. A execução comprova encadeamento, persistência, rastreabilidade e isolamento; não homologa regras comerciais, fiscais ou de qualidade da JD.

### Comando oficial da jornada de preço fixo

`pnpm test:pilot:fixed-price` executa a suíte comercial que contém a prova automatizada do primeiro encadeamento do piloto e suas pré-condições. O cenário cria a contraparte, configura política versionada, registra e recalcula a oferta, exige e aprova a exceção de margem, converte a oferta em contrato, preserva versões e obrigações, formaliza o ciclo contratual, agenda a carga, valida pesos e janela, registra o recebimento, movimenta o estoque, atualiza as projeções e processa os eventos assíncronos. O teste também cobre rejeições por piso, saldo, janela, estado inválido e tentativa de acesso por outro tenant.

O comando exige `TEST_DATABASE_URL` apontando exclusivamente para o banco descartável `tier_trade_test`. Ele nunca deve apontar para o Supabase de produção.

## Estado publicado em 05/10/2026

- frontend e backend de produção responderam com saúde normal;
- acesso autenticado com a conta de demonstração foi validado no ambiente publicado;
- contratos, cargas e fiscal exibem o fluxo integrado de documentos e evidências, com seleção do tipo, observação, envio e histórico;
- o download usa uma URL temporária emitida pelo backend e o arquivo permanece no bucket privado `tier-trade-documents`;
- financeiro exibe o cadastro versionado de políticas de comissão e a apropriação de comissão sobre valor-base persistido;
- as páginas verificadas não apresentaram sobreposição de erro nem erro de aplicação no navegador;
- a verificação desta data foi somente de leitura para não inserir arquivo, política ou apropriação artificial na conta de demonstração.

O próximo aceite técnico controlado deve usar um documento e valores deliberadamente escolhidos para o piloto, confirmar a persistência e depois decidir se esses registros permanecem como dados demonstrativos.

## Auditoria da conta demo em 07/10/2026

- `demo@tiertrade.com.br` possui membership ativa no tenant `Cerrado Trading — Demonstração`, marcado como demonstração e provisionado com a versão 8 do seed;
- a conta possui nove capacidades e pode criar ou editar os fluxos liberados para a demonstração;
- o tenant contém cinco contrapartes, quatro ofertas com quatro cenários de preço, três aprovações, dois contratos versionados, três cargas e três recebimentos;
- também existem dois lotes de estoque, dois títulos financeiros, dois documentos fiscais e 164 eventos de auditoria;
- não foram encontrados oferta sem cenário, contrato sem versão, carga sem contrato, recebimento sem carga, movimento sem lote nem evento de auditoria sem membership correspondente;
- todos os 164 eventos de saída estavam publicados no momento da consulta;
- os relatórios de carteira e o histórico de versões do contrato passam a ser exportáveis em CSV pelo frontend, sempre consultando o backend com a identidade autenticada.

## Auditoria de escopo em 07/10/2026

- liquidação de venda, contas a pagar/receber, pagamentos, recebimentos, estornos, lotes, alçada, comissão, conciliação exata e margem realizada já estão implementados; não são desenvolvimento pendente;
- o extrato hoje entra por formulário auditado. Importação automática por OFX/CNAB só será implementada se o formato real fizer parte de D06/D09;
- pátio, ocorrências, romaneio, remaneios, perdas, inventário e reconciliação física já integram a base técnica;
- o que falta para homologar não é reconstruir esses motores: são as regras oficiais D02–D09, os quatro cenários reais abaixo e o aceite dos diretores;
- comissionamento agora possui entrada própria pela navegação de Contratos e do Financeiro, usando o mesmo backend e a mesma política versionada.

## Evolução de obrigações contratuais — publicada em 05/10/2026

- A trading pode criar obrigações vinculadas a um contrato ativo e atualizar responsável, prazo, descrição e situação diretamente no detalhe do contrato.
- Cada mudança registra autor, estado anterior e novo estado na auditoria, gera evento e atualiza a projeção do contrato; a carteira e a Central contam obrigações pendentes ou em andamento.
- A agenda de cargas continua distinguindo as duas pré-condições operacionais conhecidas das demais obrigações. Obrigações criadas pelo usuário não se tornam automaticamente bloqueios da carga.
- Os testes integrados em PostgreSQL descartável no Colima do HD externo passaram (41 testes em 17 arquivos), assim como o build da API e do front.
- A migration foi desenhada para coexistir com a versão anterior da API durante a promoção. O autor de conclusão de registros históricos permanece desconhecido quando não existe evidência auditável; não é inferido do criador do contrato.
- Migration `contract_obligation_workflow` aplicada ao projeto de produção `zinqommbmajnvjkhwnks` (histórico remoto `20261005224312`); as oito colunas esperadas foram confirmadas após a aplicação.
- A API foi publicada no DigitalOcean a partir do commit `0ecac1e` e respondeu `ready` com conexão ao banco. O frontend foi publicado na Vercel a partir do commit `ae630ac`.
- O teste autenticado de leitura com `demo@tiertrade.com.br` confirmou que a Central mostra a fila do tenant e abre a obrigação no contrato correspondente. Nenhum registro de demonstração foi criado ou alterado nesse teste.
- Exceção de implantação: o usuário autorizou explicitamente esta publicação sem backup prévio. O projeto Supabase permanece no plano Free, sem backup automático nem PITR; essa decisão não altera a recomendação geral de backup antes de futuras migrations.

## Cenários mínimos para aceite humano

| Cenário | Commodity | Operação | Resultado esperado |
| --- | --- | --- | --- |
| JD-01 | Milho | Compra com recebimento aceito | Peso, qualidade, NF-e, custos e título rastreáveis |
| JD-02 | Soja | Compra com ocorrência/ajuste | Decisão e ajuste preservam motivo, autor e versão |
| JD-03 | Milho | Venda e expedição | Estoque, NF-e, contas a receber e margem realizados |
| JD-04 | Soja | Venda e liquidação parcial | Saldo, estorno e conciliação permanecem consistentes |

## Pendências externas para homologação final

1. Receber o contrato em que a JD figura como compradora e mapear campos e obrigações sem inferência.
2. Homologar com a JD os limites, tolerâncias, contraprova e descontos por commodity. A planilha recebida já cobre os campos e exemplos operacionais, mas contém percentuais variáveis e entradas manuais que não podem ser promovidos automaticamente a regra.
3. Receber a matriz fiscal aplicável à JD/MT, com CFOPs, tratamentos, alíquotas, fundos e responsabilidades.
4. Receber bancos, formatos de extrato e matriz nominal de aprovadores/alçadas.
5. Executar os quatro cenários acima com os diretores da JD e registrar aceite, ressalvas e evidências.

Até essas informações chegarem, o sistema permite configurar e testar valores explícitos, mas não inclui alíquotas, descontos, tolerâncias ou alçadas fictícias.
