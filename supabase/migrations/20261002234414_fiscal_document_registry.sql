BEGIN;

CREATE TABLE app.fiscal_documents (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('NFE')),
  direction text NOT NULL CHECK (direction IN ('OUTBOUND')),
  source_type text NOT NULL CHECK (source_type IN ('INVENTORY_DISPATCH')),
  source_id uuid NOT NULL,
  sales_contract_id uuid NOT NULL,
  financial_event_id uuid NOT NULL,
  document_number text NOT NULL CHECK (length(trim(document_number)) BETWEEN 1 AND 40),
  access_key text CHECK (access_key IS NULL OR access_key ~ '^[0-9]{44}$'),
  issued_at timestamptz NOT NULL,
  total_amount numeric(20,2) NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'BRL' CHECK (currency = 'BRL'),
  status text NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','VALIDATED','REJECTED')),
  validation_notes text CHECK (validation_notes IS NULL OR length(trim(validation_notes)) BETWEEN 3 AND 1000),
  rejection_reason text CHECK (rejection_reason IS NULL OR length(trim(rejection_reason)) BETWEEN 3 AND 500),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  validated_by uuid,
  validated_at timestamptz,
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,direction,document_type,document_number),
  UNIQUE (tenant_id,source_type,source_id,document_type),
  UNIQUE (tenant_id,financial_event_id),
  FOREIGN KEY (tenant_id,source_id) REFERENCES app.inventory_dispatches(tenant_id,id),
  FOREIGN KEY (tenant_id,sales_contract_id) REFERENCES app.sales_contracts(tenant_id,id),
  FOREIGN KEY (tenant_id,financial_event_id) REFERENCES app.financial_events(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,updated_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,validated_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (status='RECEIVED' AND validated_by IS NULL AND validated_at IS NULL AND rejection_reason IS NULL)
    OR (status='VALIDATED' AND validated_by IS NOT NULL AND validated_at IS NOT NULL
        AND rejection_reason IS NULL AND access_key IS NOT NULL)
    OR (status='REJECTED' AND validated_by IS NOT NULL AND validated_at IS NOT NULL
        AND rejection_reason IS NOT NULL)
  )
);

CREATE UNIQUE INDEX fiscal_documents_access_key
  ON app.fiscal_documents (tenant_id,access_key) WHERE access_key IS NOT NULL;
CREATE INDEX fiscal_documents_contract_issued
  ON app.fiscal_documents (tenant_id,sales_contract_id,issued_at,id);
CREATE INDEX fiscal_documents_created_by
  ON app.fiscal_documents (tenant_id,created_by);
CREATE INDEX fiscal_documents_updated_by
  ON app.fiscal_documents (tenant_id,updated_by);
CREATE INDEX fiscal_documents_validated_by
  ON app.fiscal_documents (tenant_id,validated_by) WHERE validated_by IS NOT NULL;

ALTER TABLE app.financial_titles ADD COLUMN fiscal_document_id uuid;
ALTER TABLE app.financial_titles
  ADD FOREIGN KEY (tenant_id,fiscal_document_id)
    REFERENCES app.fiscal_documents(tenant_id,id);
CREATE UNIQUE INDEX financial_titles_fiscal_document
  ON app.financial_titles (tenant_id,fiscal_document_id) WHERE fiscal_document_id IS NOT NULL;

ALTER TABLE app.fiscal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.fiscal_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.fiscal_documents
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_fiscal(p_tenant_id uuid,p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog,app
AS $$
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'')::uuid THEN
    RAISE EXCEPTION 'TENANT_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.tenants WHERE id=p_tenant_id AND is_demo=true) THEN
    RAISE EXCEPTION 'TENANT_IS_NOT_MARKED_AS_DEMO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.memberships
     WHERE tenant_id=p_tenant_id AND user_id=p_actor_id AND active=true
       AND 'FISCAL_EDIT'=ANY(capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITY_REQUIRED';
  END IF;
  UPDATE app.financial_titles SET fiscal_document_id=NULL WHERE tenant_id=p_tenant_id;
  DELETE FROM app.fiscal_documents WHERE tenant_id=p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_fiscal(uuid,uuid) FROM PUBLIC;

UPDATE app.memberships m
   SET capabilities=array_append(m.capabilities,'FISCAL_EDIT')
  FROM app.tenants t
 WHERE t.id=m.tenant_id AND t.is_demo=true
   AND NOT ('FISCAL_EDIT'=ANY(m.capabilities));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT,UPDATE ON app.fiscal_documents TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_fiscal(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
