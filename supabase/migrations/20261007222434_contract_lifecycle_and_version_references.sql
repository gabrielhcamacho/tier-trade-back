BEGIN;

ALTER TABLE app.contracts DROP CONSTRAINT contracts_status_check;
ALTER TABLE app.contracts
  ADD CONSTRAINT contracts_status_check CHECK (status IN (
    'DRAFT','AWAITING_SIGNATURE','SIGNED','ACTIVE','CLOSED','CANCELLED'
  )),
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN signed_at timestamptz,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason text,
  ADD CONSTRAINT contracts_lifecycle_metadata_check CHECK (
    (status <> 'SIGNED' OR signed_at IS NOT NULL)
    AND (status <> 'CLOSED' OR closed_at IS NOT NULL)
    AND (status <> 'CANCELLED' OR (
      cancelled_at IS NOT NULL AND length(trim(cancellation_reason)) BETWEEN 3 AND 500
    ))
  );

ALTER TABLE app.contracts
  ALTER COLUMN activated_at DROP NOT NULL,
  ALTER COLUMN activated_at DROP DEFAULT;

CREATE TABLE app.contract_versions (
  tenant_id uuid NOT NULL,
  contract_id uuid NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN (
    'DRAFT','AWAITING_SIGNATURE','SIGNED','ACTIVE','CLOSED','CANCELLED'
  )),
  change_type text NOT NULL CHECK (change_type IN (
    'CREATED','TERMS_UPDATED','STATUS_TRANSITION','AMENDMENT'
  )),
  reason text CHECK (reason IS NULL OR length(trim(reason)) BETWEEN 3 AND 1000),
  terms jsonb NOT NULL CHECK (jsonb_typeof(terms)='object'),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,contract_id,version_number),
  FOREIGN KEY (tenant_id,contract_id)
    REFERENCES app.contracts(tenant_id,id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id,recorded_by)
    REFERENCES app.memberships(tenant_id,user_id)
);

INSERT INTO app.contract_versions
  (tenant_id,contract_id,version_number,lifecycle_status,change_type,reason,terms,recorded_by,recorded_at)
SELECT c.tenant_id,c.id,1,c.status,'CREATED','Versão inicial do contrato existente',
       jsonb_build_object(
         'offerId',c.offer_id,
         'commodity',o.commodity,
         'unit',o.unit,
         'quantitySc',o.quantity_sc::text,
         'deliveryStart',o.delivery_start::text,
         'deliveryEnd',o.delivery_end::text,
         'purchasePricePerSc',s.purchase_price_per_sc::text,
         'saleReferencePerSc',s.sale_reference_per_sc::text,
         'costBreakdown',s.cost_breakdown,
         'projectedMarginPerSc',s.projected_margin_per_sc::text,
         'purchaseTerms',CASE WHEN pct.contract_id IS NULL THEN NULL ELSE jsonb_build_object(
           'externalNumber',pct.external_number,
           'cropYear',pct.crop_year,
           'signedOn',pct.signed_on,
           'pickupLocation',pct.pickup_location,
           'deliveryCondition',pct.delivery_condition,
           'freightPayer',pct.freight_payer,
           'weighingResponsibility',pct.weighing_responsibility,
           'qualityTerms',pct.quality_terms,
           'requiredDocuments',pct.required_documents,
           'paymentTerms',pct.payment_terms,
           'termsVersion',pct.version
         ) END,
         'status',c.status
       ),
       c.created_by,c.activated_at
  FROM app.contracts c
  JOIN app.offers o ON (o.tenant_id,o.id)=(c.tenant_id,c.offer_id)
  JOIN app.pricing_scenarios s
    ON (s.tenant_id,s.offer_id)=(o.tenant_id,o.id) AND s.is_current=true
  LEFT JOIN app.purchase_contract_terms pct
    ON (pct.tenant_id,pct.contract_id)=(c.tenant_id,c.id);

CREATE TABLE app.contract_amendments (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  contract_id uuid NOT NULL,
  contract_version_number integer NOT NULL CHECK (contract_version_number > 1),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  effective_on date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,contract_id,contract_version_number),
  FOREIGN KEY (tenant_id,contract_id,contract_version_number)
    REFERENCES app.contract_versions(tenant_id,contract_id,version_number),
  FOREIGN KEY (tenant_id,created_by)
    REFERENCES app.memberships(tenant_id,user_id)
);

ALTER TABLE app.loads ADD COLUMN contract_version_number integer;
UPDATE app.loads l
   SET contract_version_number=(
     SELECT max(v.version_number) FROM app.contract_versions v
      WHERE v.tenant_id=l.tenant_id AND v.contract_id=l.contract_id
   );
ALTER TABLE app.loads
  ALTER COLUMN contract_version_number SET NOT NULL,
  ADD FOREIGN KEY (tenant_id,contract_id,contract_version_number)
    REFERENCES app.contract_versions(tenant_id,contract_id,version_number);

ALTER TABLE app.sales_contracts DROP CONSTRAINT sales_contracts_status_check;
ALTER TABLE app.sales_contracts
  ADD CONSTRAINT sales_contracts_status_check CHECK (status IN (
    'DRAFT','AWAITING_SIGNATURE','SIGNED','ACTIVE','CLOSED','CANCELLED'
  )),
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN signed_at timestamptz,
  ADD COLUMN closed_at timestamptz,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_reason text,
  ADD CONSTRAINT sales_contracts_lifecycle_metadata_check CHECK (
    (status <> 'SIGNED' OR signed_at IS NOT NULL)
    AND (status <> 'CLOSED' OR closed_at IS NOT NULL)
    AND (status <> 'CANCELLED' OR (
      cancelled_at IS NOT NULL AND length(trim(cancellation_reason)) BETWEEN 3 AND 500
    ))
  );

ALTER TABLE app.sales_contracts ALTER COLUMN status SET DEFAULT 'DRAFT';

CREATE TABLE app.sales_contract_amendments (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  sales_contract_id uuid NOT NULL,
  sales_contract_version_number integer NOT NULL CHECK (sales_contract_version_number > 1),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 3 AND 1000),
  effective_on date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,sales_contract_id,sales_contract_version_number),
  FOREIGN KEY (tenant_id,sales_contract_id,sales_contract_version_number)
    REFERENCES app.sales_contract_versions(tenant_id,sales_contract_id,version_number),
  FOREIGN KEY (tenant_id,created_by)
    REFERENCES app.memberships(tenant_id,user_id)
);

ALTER TABLE app.inventory_allocations ADD COLUMN sales_contract_version_number integer;
UPDATE app.inventory_allocations a
   SET sales_contract_version_number=(
     SELECT max(v.version_number) FROM app.sales_contract_versions v
      WHERE v.tenant_id=a.tenant_id AND v.sales_contract_id=a.sales_contract_id
   );
ALTER TABLE app.inventory_allocations
  ALTER COLUMN sales_contract_version_number SET NOT NULL,
  ADD FOREIGN KEY (tenant_id,sales_contract_id,sales_contract_version_number)
    REFERENCES app.sales_contract_versions(tenant_id,sales_contract_id,version_number);

ALTER TABLE app.financial_events ADD COLUMN sales_contract_version_number integer;
UPDATE app.financial_events e
   SET sales_contract_version_number=COALESCE(
     (SELECT a.sales_contract_version_number
        FROM app.inventory_allocations a
        JOIN app.inventory_dispatches d
          ON (d.tenant_id,d.allocation_id)=(a.tenant_id,a.id)
       WHERE d.tenant_id=e.tenant_id AND d.id=e.inventory_dispatch_id),
     (SELECT max(v.version_number) FROM app.sales_contract_versions v
       WHERE v.tenant_id=e.tenant_id AND v.sales_contract_id=e.sales_contract_id)
   )
 WHERE e.sales_contract_id IS NOT NULL;
ALTER TABLE app.financial_events
  ADD FOREIGN KEY (tenant_id,sales_contract_id,sales_contract_version_number)
    REFERENCES app.sales_contract_versions(tenant_id,sales_contract_id,version_number);

ALTER TABLE app.documents
  ADD COLUMN contract_version_number integer,
  ADD COLUMN sales_contract_version_number integer;
UPDATE app.documents d
   SET contract_version_number=(
     SELECT max(v.version_number) FROM app.contract_versions v
      WHERE v.tenant_id=d.tenant_id AND v.contract_id=d.aggregate_id
   )
 WHERE d.aggregate_type='CONTRACT';
UPDATE app.documents d
   SET sales_contract_version_number=(
     SELECT max(v.version_number) FROM app.sales_contract_versions v
      WHERE v.tenant_id=d.tenant_id AND v.sales_contract_id=d.aggregate_id
   )
 WHERE d.aggregate_type='SALES_CONTRACT';
ALTER TABLE app.documents
  ADD FOREIGN KEY (tenant_id,aggregate_id,contract_version_number)
    REFERENCES app.contract_versions(tenant_id,contract_id,version_number),
  ADD FOREIGN KEY (tenant_id,aggregate_id,sales_contract_version_number)
    REFERENCES app.sales_contract_versions(tenant_id,sales_contract_id,version_number),
  ADD CONSTRAINT documents_contract_version_scope_check CHECK (
    (aggregate_type='CONTRACT' AND contract_version_number IS NOT NULL
      AND sales_contract_version_number IS NULL)
    OR (aggregate_type='SALES_CONTRACT' AND sales_contract_version_number IS NOT NULL
      AND contract_version_number IS NULL)
    OR (aggregate_type NOT IN ('CONTRACT','SALES_CONTRACT')
      AND contract_version_number IS NULL AND sales_contract_version_number IS NULL)
  );

CREATE INDEX contract_versions_recorded
  ON app.contract_versions (tenant_id,contract_id,recorded_at DESC,version_number DESC);
CREATE INDEX contract_versions_recorded_by
  ON app.contract_versions (tenant_id,recorded_by);
CREATE INDEX contract_amendments_contract_effective
  ON app.contract_amendments (tenant_id,contract_id,effective_on DESC,id DESC);
CREATE INDEX contract_amendments_created_by
  ON app.contract_amendments (tenant_id,created_by);
CREATE INDEX sales_contract_amendments_contract_effective
  ON app.sales_contract_amendments (tenant_id,sales_contract_id,effective_on DESC,id DESC);
CREATE INDEX sales_contract_amendments_created_by
  ON app.sales_contract_amendments (tenant_id,created_by);
CREATE INDEX loads_contract_version
  ON app.loads (tenant_id,contract_id,contract_version_number,id);
CREATE INDEX inventory_allocations_contract_version
  ON app.inventory_allocations (tenant_id,sales_contract_id,sales_contract_version_number,id);
CREATE INDEX financial_events_contract_version
  ON app.financial_events (tenant_id,sales_contract_id,sales_contract_version_number,id)
  WHERE sales_contract_id IS NOT NULL;

ALTER TABLE app.contract_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.contract_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.contract_versions
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.contract_amendments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.contract_amendments
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

ALTER TABLE app.sales_contract_amendments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sales_contract_amendments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.sales_contract_amendments
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id',true)),'')::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT ON app.contract_versions TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.contract_amendments TO tier_trade_runtime;
    GRANT SELECT,INSERT ON app.sales_contract_amendments TO tier_trade_runtime;
  END IF;
END $$;

COMMIT;
