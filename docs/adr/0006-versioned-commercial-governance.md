# ADR 0006 — Governança comercial versionada

- Status: aceito
- Data: 2026-10-01

## Decisão

Cada tenant administra sua própria política de margem. Apenas memberships com `MARGIN_POLICY_MANAGE` publicam uma nova versão; versões anteriores permanecem imutáveis e cenários existentes preservam a versão efetivamente usada.

Uma oferta pode ser recalculada somente em `DRAFT`. Cada edição encerra o cenário corrente e cria outro, com versão crescente, sem sobrescrever cálculos anteriores. O criador edita o próprio rascunho; terceiros precisam de `COMMERCIAL_EDIT`.

Ofertas podem ser canceladas antes de virarem contrato. Rascunhos podem ser cancelados pelo criador; os demais estados exigem `COMMERCIAL_CANCEL`. O motivo é obrigatório, aprovações pendentes são encerradas e ofertas convertidas não podem ser canceladas.

## Consequências

- não existem limites financeiros globais embutidos no produto;
- toda mudança de política, recálculo e cancelamento produz auditoria e evento na outbox;
- contratos ativos permanecem imutáveis por esse fluxo;
- mudanças futuras em contratos exigirão processos próprios de aditivo ou distrato.
