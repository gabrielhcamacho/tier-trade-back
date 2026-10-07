begin;

create index documents_contract_version_idx
  on app.documents (tenant_id, aggregate_id, contract_version_number)
  where aggregate_type = 'CONTRACT';

create index documents_sales_contract_version_idx
  on app.documents (tenant_id, aggregate_id, sales_contract_version_number)
  where aggregate_type = 'SALES_CONTRACT';

commit;
