# ADR 0003 — Decimais e semântica temporal explícita

Status: aceito em 2026-10-01.

Valores monetários, quantidades e taxas atravessam APIs e eventos como strings decimais, usam `Decimal` no domínio e `numeric` no PostgreSQL. Datas de entrega são `LocalDate` (`YYYY-MM-DD`); instantes de auditoria são UTC; o tenant mantém um fuso IANA.

Fundamentação: “Catálogo de Regras e Cálculos do Piloto” 1.0 e “Arquitetura de Multitenancy, Dados e Implantação” 1.1.
