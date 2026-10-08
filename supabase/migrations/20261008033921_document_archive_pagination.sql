-- Keep the tenant archive ordered without scanning or sorting every document.
CREATE INDEX documents_tenant_created ON app.documents
  (tenant_id, created_at DESC, id DESC);
