-- Development-only identities. Never run in a shared or production environment.
SELECT set_config('app.tenant_id', '11111111-1111-4111-8111-111111111111', false);
INSERT INTO app.tenants (id, legal_name, timezone)
VALUES ('11111111-1111-4111-8111-111111111111', 'Tenant local', 'America/Sao_Paulo');
INSERT INTO app.memberships (tenant_id,user_id,capabilities)
VALUES ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222',
  ARRAY['COMMERCIAL_APPROVE','COMMERCIAL_EDIT','COMMERCIAL_CANCEL','MARGIN_POLICY_MANAGE','ACCESS_MANAGE','OPERATIONS_EDIT','FINANCE_EDIT','FISCAL_EDIT','RISK_MANAGE']);
INSERT INTO app.counterparties (tenant_id,id,legal_name,tax_id,party_type)
VALUES ('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','Contraparte local','00000000000000','COMPANY');
INSERT INTO app.margin_policies
  (tenant_id,id,commodity,version,auto_approval_margin_per_sc,absolute_floor_margin_per_sc)
VALUES ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','MILHO',1,4.00,1.00);
