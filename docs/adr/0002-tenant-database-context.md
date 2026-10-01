# ADR 0002 — Contexto de tenant por transação

Status: aceito em 2026-10-01.

Toda operação de dados ocorre em transação e define `app.tenant_id` com `set_config(..., true)`. As tabelas do Data Plane carregam `tenant_id`, usam chaves e referências compostas e têm RLS com `FORCE ROW LEVEL SECURITY`. O papel da aplicação não poderá possuir tabelas nem ter `BYPASSRLS`. O schema `app` não é exposto pela Data API.

Fundamentação: “Arquitetura de Multitenancy, Dados e Implantação” 1.1.
