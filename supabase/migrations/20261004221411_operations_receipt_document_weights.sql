BEGIN;

ALTER TABLE app.load_receipts
  ADD COLUMN inbound_invoice_number text,
  ADD COLUMN inbound_invoice_series text,
  ADD COLUMN inbound_invoice_access_key text,
  ADD COLUMN document_weight_kg numeric(20,3),
  ADD COLUMN considered_weight_kg numeric(20,3),
  ADD COLUMN accepted_weight_kg numeric(20,3),
  ADD COLUMN weight_decision_reason text;

UPDATE app.load_receipts
   SET document_weight_kg=net_weight_kg,
       considered_weight_kg=net_weight_kg,
       accepted_weight_kg=CASE WHEN quality_decision='ACCEPTED' THEN net_weight_kg ELSE NULL END
 WHERE tenant_id IS NOT NULL;

ALTER TABLE app.load_receipts
  ADD CONSTRAINT load_receipts_inbound_invoice_number_valid
    CHECK (inbound_invoice_number IS NULL OR length(trim(inbound_invoice_number)) BETWEEN 1 AND 40),
  ADD CONSTRAINT load_receipts_inbound_invoice_series_valid
    CHECK (inbound_invoice_series IS NULL OR length(trim(inbound_invoice_series)) BETWEEN 1 AND 20),
  ADD CONSTRAINT load_receipts_inbound_invoice_access_key_valid
    CHECK (inbound_invoice_access_key IS NULL OR inbound_invoice_access_key ~ '^[0-9]{44}$'),
  ADD CONSTRAINT load_receipts_document_weight_positive
    CHECK (document_weight_kg IS NULL OR document_weight_kg > 0),
  ADD CONSTRAINT load_receipts_considered_weight_positive
    CHECK (considered_weight_kg IS NULL OR considered_weight_kg > 0),
  ADD CONSTRAINT load_receipts_accepted_weight_decision
    CHECK (
      (quality_decision='REVIEW_REQUIRED' AND accepted_weight_kg IS NULL)
      OR (quality_decision='ACCEPTED' AND accepted_weight_kg IS NOT NULL AND accepted_weight_kg > 0)
    ),
  ADD CONSTRAINT load_receipts_weight_decision_reason_valid
    CHECK (weight_decision_reason IS NULL OR length(trim(weight_decision_reason)) BETWEEN 10 AND 500),
  ADD CONSTRAINT load_receipts_weight_difference_explained
    CHECK (
      (document_weight_kg IS NULL OR considered_weight_kg IS NULL)
      OR (
        document_weight_kg = considered_weight_kg
        AND net_weight_kg = considered_weight_kg
        AND (accepted_weight_kg IS NULL OR accepted_weight_kg = considered_weight_kg)
      )
      OR weight_decision_reason IS NOT NULL
    );

COMMENT ON COLUMN app.load_receipts.inbound_invoice_number IS
  'Identificação operacional da NF de entrada; a escrituração e validação fiscal pertencem ao módulo Fiscal.';
COMMENT ON COLUMN app.load_receipts.document_weight_kg IS 'Peso líquido declarado na NF de entrada.';
COMMENT ON COLUMN app.load_receipts.net_weight_kg IS 'Peso de chegada calculado pela pesagem bruta menos a tara.';
COMMENT ON COLUMN app.load_receipts.considered_weight_kg IS
  'Peso escolhido explicitamente pelo operador para a conciliação, sem tolerância automática.';
COMMENT ON COLUMN app.load_receipts.accepted_weight_kg IS
  'Peso efetivamente aceito para estoque quando a decisão humana é ACCEPTED.';

COMMIT;
