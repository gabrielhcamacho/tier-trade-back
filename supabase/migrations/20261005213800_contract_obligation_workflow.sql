ALTER TABLE app.contract_obligations
  DROP CONSTRAINT contract_obligations_code_check,
  DROP CONSTRAINT contract_obligations_status_check;

ALTER TABLE app.contract_obligations
  ADD COLUMN title text,
  ADD COLUMN description text,
  ADD COLUMN due_date date,
  ADD COLUMN responsible_name text,
  ADD COLUMN created_by uuid,
  ADD COLUMN completed_by uuid,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

UPDATE app.contract_obligations obligation
   SET title = CASE obligation.code
     WHEN 'SIGNED_CONTRACT' THEN 'Contrato assinado'
     WHEN 'DELIVERY_SCHEDULE' THEN 'Agenda de entrega'
     ELSE obligation.code
   END,
       created_by = contract.created_by
 FROM app.contracts contract
 WHERE (contract.tenant_id, contract.id) = (obligation.tenant_id, obligation.contract_id);

ALTER TABLE app.contract_obligations
  ADD CONSTRAINT contract_obligations_code_check
    CHECK (code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  ADD CONSTRAINT contract_obligations_status_check
    CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED')),
  ADD CONSTRAINT contract_obligations_title_check
    CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  ADD CONSTRAINT contract_obligations_description_check
    CHECK (description IS NULL OR char_length(btrim(description)) BETWEEN 3 AND 1000),
  ADD CONSTRAINT contract_obligations_responsible_name_check
    CHECK (responsible_name IS NULL OR char_length(btrim(responsible_name)) BETWEEN 2 AND 120),
  ADD CONSTRAINT contract_obligations_completed_state_check
    CHECK (
      (status = 'COMPLETED' AND completed_at IS NOT NULL)
      OR
      (status <> 'COMPLETED' AND completed_at IS NULL AND completed_by IS NULL)
    ),
  ADD CONSTRAINT contract_obligations_created_by_fkey
    FOREIGN KEY (tenant_id, created_by) REFERENCES app.memberships(tenant_id, user_id),
  ADD CONSTRAINT contract_obligations_completed_by_fkey
    FOREIGN KEY (tenant_id, completed_by) REFERENCES app.memberships(tenant_id, user_id);

CREATE INDEX contract_obligations_created_by_idx
  ON app.contract_obligations (tenant_id, created_by);

CREATE INDEX contract_obligations_completed_by_idx
  ON app.contract_obligations (tenant_id, completed_by)
  WHERE completed_by IS NOT NULL;

CREATE INDEX contract_obligations_due_date_idx
  ON app.contract_obligations (tenant_id, due_date, status)
  WHERE due_date IS NOT NULL AND status IN ('PENDING','IN_PROGRESS');
