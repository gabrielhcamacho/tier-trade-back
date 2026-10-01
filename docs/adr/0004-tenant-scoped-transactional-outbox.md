# ADR 0004 — Outbox transacional processada por tenant

- Status: aceito
- Data: 2026-10-01

## Contexto

As mudanças comerciais e seus eventos já são persistidos na mesma transação. Falta retirar os eventos da outbox com segurança, sem conceder ao worker acesso transversal aos tenants e sem exigir agora a escolha do transporte externo definitivo.

## Decisão

Cada execução do worker recebe um único `TENANT_ID` confiável, abre todas as transações pelo `DatabasePlatformPort` e preserva a RLS forçada. O leasing usa `FOR UPDATE SKIP LOCKED`, identificador do worker, expiração de dois minutos e lote limitado a 100 eventos.

A entrega é pelo menos uma vez. Projeções são deduplicadas pelo identificador imutável do evento e a projeção, o reconhecimento e a marcação de `published_at` acontecem na mesma transação. Falhas liberam o lease, guardam erro truncado e reagendam com backoff exponencial limitado a cinco minutos.

Nesta fase, “publicado” significa entregue aos consumidores internos persistentes. Quando um transporte externo for aprovado, ele terá seu próprio registro de entrega por destino; não reutilizará silenciosamente `published_at`.

O worker expõe saúde e métricas em uma porta própria. Métricas seguem o formato OpenMetrics/Prometheus e logs são JSON estruturado, mantendo a coleta independente do fornecedor. Métricas podem usar `tenant_id`, mas não usam evento, worker, usuário ou contraparte como rótulo. Logs não incluem payloads nem mensagens brutas potencialmente sensíveis.

## Consequências

- uma falha ou reinício pode repetir trabalho, mas não duplica a projeção;
- nenhuma consulta do worker exige `BYPASSRLS`;
- o orquestrador deve iniciar uma execução por tenant ativo, conforme o futuro Control Plane;
- eventos desconhecidos entram na linha do tempo e são reconhecidos; consumidores externos terão contratos versionados próprios;
- idade, backlog, tentativas, recuperação, falhas e duração são observáveis por tenant;
- alertas e runbook operacionais são versionados junto do código, enquanto o destino definitivo de coleta permanece uma decisão de implantação.
