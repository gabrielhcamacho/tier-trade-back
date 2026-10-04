BEGIN;

-- Expand only the two commodities in the documented MVP. Existing records are
-- kept intact; no fiscal or quality rule is inferred from this change.
ALTER TABLE app.margin_policies DROP CONSTRAINT margin_policies_commodity_check;
ALTER TABLE app.margin_policies ADD CONSTRAINT margin_policies_commodity_check
  CHECK (commodity IN ('MILHO', 'SOJA'));
ALTER TABLE app.offers DROP CONSTRAINT offers_commodity_check;
ALTER TABLE app.offers ADD CONSTRAINT offers_commodity_check
  CHECK (commodity IN ('MILHO', 'SOJA'));
ALTER TABLE app.sales_contracts DROP CONSTRAINT sales_contracts_commodity_check;
ALTER TABLE app.sales_contracts ADD CONSTRAINT sales_contracts_commodity_check
  CHECK (commodity IN ('MILHO', 'SOJA'));
ALTER TABLE app.risk_policies DROP CONSTRAINT risk_policies_commodity_check;
ALTER TABLE app.risk_policies ADD CONSTRAINT risk_policies_commodity_check
  CHECK (commodity IN ('MILHO', 'SOJA'));

-- Legacy counterparties cannot be safely classified as cooperative from CNPJ.
-- They remain explicitly unclassified until a user confirms the profile.
ALTER TABLE app.counterparties ADD COLUMN party_type text NOT NULL DEFAULT 'UNCLASSIFIED';
ALTER TABLE app.counterparties ADD CONSTRAINT counterparties_party_type_check
  CHECK (party_type IN ('PERSON', 'COMPANY', 'COOPERATIVE', 'UNCLASSIFIED'));
ALTER TABLE app.counterparties ADD CONSTRAINT counterparties_tax_id_shape_check
  CHECK ((party_type = 'PERSON' AND length(tax_id) = 11)
      OR (party_type IN ('COMPANY', 'COOPERATIVE') AND length(tax_id) = 14)
      OR party_type = 'UNCLASSIFIED');

COMMIT;
