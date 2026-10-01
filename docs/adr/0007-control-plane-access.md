# ADR 0007 — Control Plane mínimo de acesso

- Status: aceito
- Data: 2026-10-01

## Decisão

O backend resolve o tenant a partir do `sub` autenticado consultando `control.membership_directory`. Durante o MVP, cada usuário possui no máximo uma membership ativa, portanto o navegador não envia nem configura `tenant_id`. O modo por cabeçalhos permanece exclusivamente para desenvolvimento local.

O convite é iniciado por um usuário com `ACCESS_MANAGE`. A API registra a tentativa, usa o adaptador administrativo do Supabase Auth para enviar o e-mail, cria a membership com capabilities explícitas e mantém auditoria e outbox no tenant. A secret key do Supabase permanece somente no backend. Os schemas `app` e `control` não são expostos pela Data API.

## Evolução prevista

A origem provisória do comando de convite será substituída por um painel administrativo interno. Esse painel permitirá ao time comercial liberar o acesso e registrar preço do plano e valor de implantação. Landing page, formulário de interesse, qualificação comercial e reformulação da tela de login pertencem a uma fase posterior e não entram no MVP atual.

Essa evolução deve reutilizar o mesmo serviço de provisionamento, as mesmas memberships e capabilities. Cobrança e implantação terão modelos próprios; não serão adicionadas como campos genéricos na tabela de convite.

## Consequências

- remover `NEXT_PUBLIC_TENANT_ID` elimina a seleção de tenant controlada pelo cliente;
- usuários sem membership ativa recebem acesso negado mesmo que estejam autenticados no Supabase;
- o primeiro administrador de cada tenant recebe `ACCESS_MANAGE` durante a migração quando já administra a política de margem;
- convites falhos ficam registrados sem criar membership e podem ser diagnosticados;
- suporte a múltiplos tenants ativos por usuário exige um seletor autenticado no Control Plane, não uma variável pública.
