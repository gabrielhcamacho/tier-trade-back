BEGIN;

CREATE TABLE app.load_yard_events (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  load_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('CHECKED_IN','QUEUED','CALLED_TO_SCALE','RELEASED','DEPARTED')),
  location_code text,
  occurred_at timestamptz NOT NULL,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,load_id) REFERENCES app.loads(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (location_code IS NULL OR location_code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  CHECK (notes IS NULL OR length(trim(notes)) BETWEEN 1 AND 500)
);

CREATE INDEX load_yard_events_timeline
  ON app.load_yard_events (tenant_id,load_id,occurred_at DESC,id DESC);
CREATE INDEX load_yard_events_created_by
  ON app.load_yard_events (tenant_id,created_by);

CREATE TABLE app.load_occurrences (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  load_id uuid NOT NULL,
  category text NOT NULL CHECK (category IN ('DOCUMENT','WEIGHT','QUALITY','VEHICLE','YARD','OTHER')),
  severity text NOT NULL CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 1000),
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED')),
  resolution text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  FOREIGN KEY (tenant_id,load_id) REFERENCES app.loads(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  FOREIGN KEY (tenant_id,resolved_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (
    (status='OPEN' AND resolution IS NULL AND resolved_by IS NULL AND resolved_at IS NULL)
    OR
    (status='RESOLVED' AND length(trim(resolution)) BETWEEN 10 AND 1000
      AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

CREATE INDEX load_occurrences_timeline
  ON app.load_occurrences (tenant_id,load_id,status,occurred_at DESC,id DESC);
CREATE INDEX load_occurrences_created_by
  ON app.load_occurrences (tenant_id,created_by);
CREATE INDEX load_occurrences_resolved_by
  ON app.load_occurrences (tenant_id,resolved_by) WHERE resolved_by IS NOT NULL;

CREATE TABLE app.load_receipt_reports (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL,
  load_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  reference text NOT NULL CHECK (reference ~ '^RM-[A-Z0-9_-]{2,32}-[0-9]{4}-[A-Z0-9]{8}$'),
  version integer NOT NULL CHECK (version > 0),
  is_current boolean NOT NULL DEFAULT true,
  issued_at timestamptz NOT NULL,
  inbound_invoice_number text NOT NULL,
  inbound_invoice_series text NOT NULL,
  inbound_invoice_access_key text,
  document_weight_kg numeric(20,3) NOT NULL CHECK (document_weight_kg > 0),
  arrival_weight_kg numeric(20,3) NOT NULL CHECK (arrival_weight_kg > 0),
  considered_weight_kg numeric(20,3) NOT NULL CHECK (considered_weight_kg > 0),
  accepted_weight_kg numeric(20,3) NOT NULL CHECK (accepted_weight_kg > 0),
  scale_ticket_number text,
  moisture_pct numeric(7,4) NOT NULL CHECK (moisture_pct BETWEEN 0 AND 100),
  impurity_pct numeric(7,4) NOT NULL CHECK (impurity_pct BETWEEN 0 AND 100),
  damaged_pct numeric(7,4) NOT NULL CHECK (damaged_pct BETWEEN 0 AND 100),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id),
  UNIQUE (tenant_id,load_id,version),
  UNIQUE (tenant_id,reference,version),
  FOREIGN KEY (tenant_id,load_id) REFERENCES app.loads(tenant_id,id),
  FOREIGN KEY (tenant_id,receipt_id) REFERENCES app.load_receipts(tenant_id,id),
  FOREIGN KEY (tenant_id,created_by) REFERENCES app.memberships(tenant_id,user_id),
  CHECK (inbound_invoice_access_key IS NULL OR inbound_invoice_access_key ~ '^[0-9]{44}$')
);

CREATE UNIQUE INDEX load_receipt_reports_one_current
  ON app.load_receipt_reports (tenant_id,load_id) WHERE is_current;
CREATE INDEX load_receipt_reports_created_by
  ON app.load_receipt_reports (tenant_id,created_by);
CREATE INDEX load_receipt_reports_receipt
  ON app.load_receipt_reports (tenant_id,receipt_id);

-- Somente o tenant de demonstração recebe uma linha do tempo retroativa. Os
-- demais tenants não ganham fatos operacionais inferidos silenciosamente.
INSERT INTO app.load_yard_events
  (tenant_id,id,load_id,event_type,location_code,occurred_at,notes,created_by,created_at)
SELECT l.tenant_id,md5(l.id::text || ':' || event.event_type)::uuid,l.id,event.event_type,
       event.location_code,COALESCE(r.received_at,l.updated_at,l.created_at) + event.offset_value,
       'Dado demonstrativo retroativo para apresentação do fluxo de pátio.',l.created_by,
       COALESCE(r.received_at,l.updated_at,l.created_at) + event.offset_value
  FROM app.loads l
  JOIN app.tenants t ON t.id=l.tenant_id AND t.is_demo=true
  LEFT JOIN app.load_receipts r
    ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
 CROSS JOIN LATERAL (VALUES
   ('CHECKED_IN',interval '-30 minutes','PORTARIA_01'),
   ('QUEUED',interval '-20 minutes','PATIO_DEMO'),
   ('CALLED_TO_SCALE',interval '-10 minutes','BALANCA_DEMO'),
   ('RELEASED',interval '10 minutes','PORTARIA_01')
 ) AS event(event_type,offset_value,location_code)
 WHERE l.status IN ('IN_RECEIVING','RECEIVED')
   AND (event.event_type <> 'RELEASED' OR l.status='RECEIVED')
   AND NOT EXISTS (
     SELECT 1 FROM app.load_yard_events existing
      WHERE existing.tenant_id=l.tenant_id AND existing.load_id=l.id
   );

INSERT INTO app.load_occurrences
  (tenant_id,id,load_id,category,severity,title,description,occurred_at,status,created_by,created_at,updated_at)
SELECT l.tenant_id,md5(l.id::text || ':REVIEW_OCCURRENCE')::uuid,l.id,'QUALITY','WARNING',
       'Classificação aguardando decisão',
       'O recebimento demonstrativo permanece em revisão pelo responsável operacional.',
       r.received_at,'OPEN',l.created_by,r.received_at,r.received_at
  FROM app.loads l
  JOIN app.tenants t ON t.id=l.tenant_id AND t.is_demo=true
  JOIN app.load_receipts r
    ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
 WHERE r.quality_decision='REVIEW_REQUIRED';

INSERT INTO app.load_receipt_reports
  (tenant_id,id,load_id,receipt_id,reference,version,is_current,issued_at,
   inbound_invoice_number,inbound_invoice_series,inbound_invoice_access_key,
   document_weight_kg,arrival_weight_kg,considered_weight_kg,accepted_weight_kg,
   scale_ticket_number,moisture_pct,impurity_pct,damaged_pct,created_by,created_at)
SELECT l.tenant_id,md5(l.id::text || ':' || r.id::text || ':ROMANEIO')::uuid,l.id,r.id,
       'RM-' || l.destination_code || '-' || to_char(r.received_at AT TIME ZONE t.timezone,'YYYY') || '-'
         || upper(right(replace(l.id::text,'-',''),8)),
       1,true,r.received_at + interval '15 minutes',r.inbound_invoice_number,r.inbound_invoice_series,
       r.inbound_invoice_access_key,r.document_weight_kg,r.net_weight_kg,r.considered_weight_kg,
       r.accepted_weight_kg,r.scale_ticket_number,r.moisture_pct,r.impurity_pct,r.damaged_pct,
       l.created_by,r.received_at + interval '15 minutes'
  FROM app.loads l
  JOIN app.tenants t ON t.id=l.tenant_id AND t.is_demo=true
  JOIN app.load_receipts r
    ON (r.tenant_id,r.load_id)=(l.tenant_id,l.id) AND r.is_current=true
 WHERE r.quality_decision='ACCEPTED'
   AND r.inbound_invoice_number IS NOT NULL
   AND r.inbound_invoice_series IS NOT NULL
   AND r.document_weight_kg IS NOT NULL
   AND r.considered_weight_kg IS NOT NULL
   AND r.accepted_weight_kg IS NOT NULL;

ALTER TABLE app.load_yard_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.load_yard_events FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.load_yard_events
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

ALTER TABLE app.load_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.load_occurrences FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.load_occurrences
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

ALTER TABLE app.load_receipt_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.load_receipt_reports FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON app.load_receipt_reports
  USING (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid)
  WITH CHECK (tenant_id = nullif((SELECT current_setting('app.tenant_id', true)), '')::uuid);

CREATE OR REPLACE FUNCTION app.delete_demo_operations_extensions(p_tenant_id uuid, p_actor_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer := 0;
  affected integer;
BEGIN
  IF p_tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id', true), '')::uuid THEN
    RAISE EXCEPTION 'DEMO_RESET_TENANT_CONTEXT_MISMATCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM app.tenants t WHERE t.id=p_tenant_id AND t.is_demo=true) THEN
    RAISE EXCEPTION 'TENANT_IS_NOT_MARKED_AS_DEMO';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app.memberships m
     WHERE m.tenant_id=p_tenant_id AND m.user_id=p_actor_id AND m.active=true
       AND 'OPERATIONS_EDIT'=ANY(m.capabilities)
  ) THEN
    RAISE EXCEPTION 'DEMO_ACTOR_CAPABILITIES_INCOMPLETE';
  END IF;

  DELETE FROM app.load_receipt_reports WHERE tenant_id=p_tenant_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  deleted_count := deleted_count + affected;
  DELETE FROM app.load_occurrences WHERE tenant_id=p_tenant_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  deleted_count := deleted_count + affected;
  DELETE FROM app.load_yard_events WHERE tenant_id=p_tenant_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  deleted_count := deleted_count + affected;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION app.delete_demo_operations_extensions(uuid,uuid) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tier_trade_runtime') THEN
    GRANT SELECT,INSERT ON app.load_yard_events TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.load_occurrences TO tier_trade_runtime;
    GRANT SELECT,INSERT,UPDATE ON app.load_receipt_reports TO tier_trade_runtime;
    GRANT EXECUTE ON FUNCTION app.delete_demo_operations_extensions(uuid,uuid) TO tier_trade_runtime;
  END IF;
END $$;

COMMENT ON TABLE app.load_yard_events IS 'Linha do tempo imutavel da passagem da carga pelo patio.';
COMMENT ON TABLE app.load_occurrences IS 'Ocorrencias operacionais da carga com abertura e resolucao auditadas.';
COMMENT ON TABLE app.load_receipt_reports IS 'Versoes imutaveis do romaneio operacional emitido a partir do recebimento aceito.';

COMMIT;
