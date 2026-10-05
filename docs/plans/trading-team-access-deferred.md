# Plano futuro — acessos da equipe da trading por função e unidade

Status: **adiado por decisão do produto em 05/10/2026**. Este documento é uma proposta para retomar quando o usuário solicitar a criação dos acessos. Não autoriza migration, tela, alteração de permissões ou mudança no isolamento atual.

## Objetivo

Permitir que a própria trading cadastre/convide sua equipe, atribua funções e conceda acesso a uma, várias ou todas as unidades operacionais, sem confundir unidade com cidade ou estabelecimento fiscal. Deve servir tanto a uma equipe pequena quanto a uma estrutura com muitas unidades, mantendo a configuração simples.

## Proposta a validar antes de implementar

1. Separar três decisões: tenant autenticado; ação permitida sobre o recurso (`view`, `edit`, `approve`, `cancel`, `manage`); e escopo de unidades autorizado. Estado do fluxo e segregação de funções continuam sendo condições adicionais no backend. Não usar visibilidade de menu como autorização.
2. Começar com perfis predefinidos por função, com exceções explícitas apenas quando necessárias. O backend calcula permissões efetivas a partir de memberships ativas no banco, não de dados enviados pelo navegador ou de `user_metadata`.
3. Classificar cada agregado como pertencente a uma unidade, compartilhado entre unidades ou corporativo. Listagens, detalhes, busca, indicadores, exportações, documentos, jobs e comandos devem aplicar o mesmo escopo; totais são calculados após o filtro.
4. Manter RLS e chaves compostas para o isolamento por tenant como defesa adicional. A API centraliza a autorização por função, ação, unidade e estado; testes devem provar acessos permitidos e negados em todas as rotas afetadas.
5. Vincular obrigações contratuais a IDs de usuários da mesma trading, validando unidade e membership ativa. Preservar `responsible_name` existente como histórico durante a migração. Reatribuição e desativação exigem trilha de auditoria; não permitir a remoção do último administrador.
6. Construir o painel da **equipe da trading** separadamente do futuro painel administrativo interno do SaaS (criação de empresas, preços e implantação).

## Ordem sugerida ao retomar

1. Inventário de recursos e endpoints; matriz de permissão e classificação de escopo, com ADR e contratos de API.
2. Modelo de unidades, perfis, vínculos usuário–unidade e convite/gestão de equipe.
3. Primeira entrega ponta a ponta: obrigações contratuais atribuídas a usuários e fila individual.
4. Expansão da autorização para todos os módulos e read models, seguida de testes de isolamento entre unidades, acesso direto por ID, documentos, agregados, mudança de função e desativação.
5. Migração controlada dos dados atuais e validação antes de anunciar isolamento por unidade ao cliente.

## Decisões ainda abertas

- Confirmar que “unidade” significa unidade operacional e que estabelecimentos fiscais/CNPJs são cadastro separado.
- Definir visibilidade de contratos e movimentos que envolvam duas ou mais unidades, inclusive dados financeiros compartilhados.
- Confirmar perfis iniciais e quem pode conceder acesso consolidado a todas as unidades.

## Estado do código ao registrar a proposta

`app.memberships` guarda capabilities explícitas e o backend permite convite com `ACCESS_MANAGE`; o usuário possui no máximo uma membership ativa de tenant no MVP. Não há ainda painel de equipe nem escopo por unidade. Obrigações usam `responsible_name` livre. A visão geral rejeita o filtro de unidade não modelado. Referências: ADR 0007, `src/control-plane/access.service.ts`, `src/commercial/commercial.service.ts`, `src/overview/overview.service.ts` e migration `20261005213800_contract_obligation_workflow.sql`.
