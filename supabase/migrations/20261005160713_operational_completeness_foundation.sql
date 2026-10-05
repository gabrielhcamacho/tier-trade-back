BEGIN;

-- A planilha operacional da JD registra estes componentes separadamente. Eles
-- permanecem fatos medidos; limites e descontos continuam versionados fora do
-- recebimento para que uma planilha não se torne regra fiscal/comercial implícita.
ALTER TABLE app.load_receipts
  ADD COLUMN broken_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (broken_pct BETWEEN 0 AND 100),
  ADD COLUMN burnt_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (burnt_pct BETWEEN 0 AND 100),
  ADD COLUMN heat_damaged_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (heat_damaged_pct BETWEEN 0 AND 100);

ALTER TABLE app.load_receipt_reports
  ADD COLUMN broken_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (broken_pct BETWEEN 0 AND 100),
  ADD COLUMN burnt_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (burnt_pct BETWEEN 0 AND 100),
  ADD COLUMN heat_damaged_pct numeric(7,4) NOT NULL DEFAULT 0 CHECK (heat_damaged_pct BETWEEN 0 AND 100);

ALTER TABLE app.inventory_lots
  ADD COLUMN owner_counterparty_id uuid,
  ADD COLUMN custodian_counterparty_id uuid,
  ADD FOREIGN KEY (tenant_id,owner_counterparty_id) REFERENCES app.counterparties(tenant_id,id),
  ADD FOREIGN KEY (tenant_id,custodian_counterparty_id) REFERENCES app.counterparties(tenant_id,id);

CREATE INDEX inventory_lots_owner ON app.inventory_lots (tenant_id,owner_counterparty_id)
  WHERE owner_counterparty_id IS NOT NULL;
CREATE INDEX inventory_lots_custodian ON app.inventory_lots (tenant_id,custodian_counterparty_id)
  WHERE custodian_counterparty_id IS NOT NULL;

CREATE TABLE app.inventory_lot_events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  lot_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'CLASSIFICATION_CHANGED','TRANSFER_STARTED','TRANSFER_COMPLETED','TRANSFER_CANCELLED',
    'LOSS_RECORDED','COUNT_RECONCILED'
  )),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload)='object'),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  occurred_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES app.inventory_lots(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.inventory_transfers (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  lot_id uuid NOT NULL,
  source_location_id uuid NOT NULL,
  destination_location_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'IN_TRANSIT' CHECK (status IN ('IN_TRANSIT','COMPLETED','CANCELLED')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  cancelled_at timestamptz,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES app.inventory_lots(tenant_id,id),
  FOREIGN KEY (tenant_id,source_location_id) REFERENCES app.inventory_locations(tenant_id,id),
  FOREIGN KEY (tenant_id,destination_location_id) REFERENCES app.inventory_locations(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (source_location_id <> destination_location_id),
  CHECK (
    (status='IN_TRANSIT' AND completed_at IS NULL AND cancelled_at IS NULL) OR
    (status='COMPLETED' AND completed_at IS NOT NULL AND cancelled_at IS NULL) OR
    (status='CANCELLED' AND cancelled_at IS NOT NULL AND completed_at IS NULL)
  )
);

CREATE UNIQUE INDEX inventory_transfers_one_active_per_lot
  ON app.inventory_transfers (tenant_id,lot_id) WHERE status='IN_TRANSIT';
CREATE INDEX inventory_transfers_status_time
  ON app.inventory_transfers (tenant_id,status,started_at DESC,id DESC);

CREATE TABLE app.inventory_counts (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  lot_id uuid NOT NULL,
  system_quantity_kg numeric(20,3) NOT NULL CHECK (system_quantity_kg >= 0),
  counted_quantity_kg numeric(20,3) NOT NULL CHECK (counted_quantity_kg >= 0),
  difference_kg numeric(20,3) GENERATED ALWAYS AS (counted_quantity_kg-system_quantity_kg) STORED,
  occurred_at timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 1000),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,lot_id) REFERENCES app.inventory_lots(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

ALTER TABLE app.inventory_movements
  ADD COLUMN lot_event_id uuid,
  DROP CONSTRAINT inventory_movements_movement_type_check,
  ADD CONSTRAINT inventory_movements_movement_type_check
    CHECK (movement_type IN (
      'RECEIPT','RECEIPT_CORRECTION','RECEIPT_REVERSAL','DISPATCH','LOSS','COUNT_ADJUSTMENT'
    )),
  DROP CONSTRAINT inventory_movement_source_check,
  ADD CONSTRAINT inventory_movement_source_check CHECK (
    (movement_type LIKE 'RECEIPT%' AND source_load_id IS NOT NULL AND source_receipt_id IS NOT NULL
      AND allocation_id IS NULL AND dispatch_id IS NULL AND lot_event_id IS NULL) OR
    (movement_type='DISPATCH' AND source_load_id IS NULL AND source_receipt_id IS NULL
      AND allocation_id IS NOT NULL AND dispatch_id IS NOT NULL AND lot_event_id IS NULL) OR
    (movement_type IN ('LOSS','COUNT_ADJUSTMENT') AND source_load_id IS NULL AND source_receipt_id IS NULL
      AND allocation_id IS NULL AND dispatch_id IS NULL AND lot_event_id IS NOT NULL)
  ),
  ADD FOREIGN KEY (tenant_id,lot_event_id) REFERENCES app.inventory_lot_events(tenant_id,id);

CREATE INDEX inventory_movements_lot_event ON app.inventory_movements (tenant_id,lot_event_id)
  WHERE lot_event_id IS NOT NULL;

-- Políticas de comissão são versionadas e nunca inferidas dos valores digitados
-- na planilha. O primeiro motor usa eventos financeiros auditados como base.
CREATE TABLE app.commission_policies (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  code text NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','RETIRED')),
  basis text NOT NULL CHECK (basis IN ('FINANCIAL_EVENT_AMOUNT','REALIZED_MARGIN')),
  rate_pct numeric(9,6) NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 100),
  commodity text CHECK (commodity IS NULL OR commodity IN ('MILHO','SOJA')),
  beneficiary_name text NOT NULL CHECK (length(trim(beneficiary_name)) BETWEEN 2 AND 160),
  effective_from date NOT NULL,
  effective_to date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,code,version),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX commission_policies_one_active_version
  ON app.commission_policies (tenant_id,code) WHERE status='ACTIVE';

CREATE TABLE app.commission_accruals (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  policy_id uuid NOT NULL,
  financial_event_id uuid NOT NULL,
  basis_amount numeric(20,2) NOT NULL,
  commission_amount numeric(20,2) NOT NULL CHECK (commission_amount >= 0),
  status text NOT NULL DEFAULT 'ACCRUED' CHECK (status IN ('ACCRUED','APPROVED','PAID','REVERSED')),
  calculation_snapshot jsonb NOT NULL CHECK (jsonb_typeof(calculation_snapshot)='object'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,policy_id,financial_event_id),
  FOREIGN KEY (tenant_id,policy_id) REFERENCES app.commission_policies(tenant_id,id),
  FOREIGN KEY (tenant_id,financial_event_id) REFERENCES app.financial_events(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id)
);

CREATE TABLE app.documents (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  aggregate_type text NOT NULL CHECK (aggregate_type IN (
    'CONTRACT','SALES_CONTRACT','LOAD','FISCAL_DOCUMENT','COUNTERPARTY','INVENTORY_LOT'
  )),
  aggregate_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'CONTRACT_DRAFT','SIGNED_CONTRACT','AMENDMENT','GUARANTEE','INVOICE','ROMANEIO',
    'QUALITY_REPORT','WEIGHING_TICKET','OTHER'
  )),
  file_name text NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 240),
  mime_type text NOT NULL CHECK (length(trim(mime_type)) BETWEEN 3 AND 120),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  storage_bucket text NOT NULL DEFAULT 'tier-trade-documents',
  storage_path text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_UPLOAD' CHECK (status IN ('PENDING_UPLOAD','AVAILABLE','ARCHIVED')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  notes text CHECK (notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 1000),
  uploaded_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,storage_path),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK ((status='PENDING_UPLOAD' AND uploaded_at IS NULL) OR status<>'PENDING_UPLOAD')
);

CREATE INDEX documents_aggregate ON app.documents
  (tenant_id,aggregate_type,aggregate_id,status,created_at DESC,id DESC);

CREATE TABLE app.document_signatures (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  document_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('MANUAL','DOCUSIGN','OTHER')),
  external_envelope_id text,
  signer_name text NOT NULL CHECK (length(trim(signer_name)) BETWEEN 2 AND 160),
  signer_email text,
  signer_role text NOT NULL CHECK (length(trim(signer_role)) BETWEEN 2 AND 80),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','SIGNED','DECLINED','CANCELLED')),
  sent_at timestamptz,
  signed_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,document_id) REFERENCES app.documents(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (signer_email IS NULL OR position('@' in signer_email) > 1),
  CHECK (status<>'SIGNED' OR signed_at IS NOT NULL)
);

CREATE INDEX document_signatures_document ON app.document_signatures
  (tenant_id,document_id,status,id);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'inventory_lot_events','inventory_transfers','inventory_counts',
    'commission_policies','commission_accruals','documents','document_signatures'
  ] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',table_name);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON app.%I USING (tenant_id = nullif((SELECT current_setting(''app.tenant_id'',true)),'''')::uuid) WITH CHECK (tenant_id = nullif((SELECT current_setting(''app.tenant_id'',true)),'''')::uuid)',
      table_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='tier_trade_runtime') THEN
    GRANT SELECT,INSERT ON app.inventory_lot_events,app.inventory_counts TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.inventory_transfers,app.inventory_lots TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.commission_policies,app.commission_accruals TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.documents,app.document_signatures TO tier_trade_runtime;
  END IF;
END $$;

-- O bucket é privado. Upload e download serão autorizados pela API após validar
-- membership e tenant; o navegador nunca recebe a chave secreta do Supabase.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='storage') THEN
    INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
    VALUES ('tier-trade-documents','tier-trade-documents',false,26214400,
      ARRAY['application/pdf','image/jpeg','image/png',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
    ON CONFLICT (id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,
      allowed_mime_types=EXCLUDED.allowed_mime_types;
  END IF;
END $$;

COMMIT;
