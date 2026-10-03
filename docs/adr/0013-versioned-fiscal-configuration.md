# ADR 0013 — Configuração fiscal versionada antes do motor tributário

## Contexto

O registro da NF-e já preserva a cadeia expedição → contrato → evento financeiro → título, mas o piloto ainda não homologou estabelecimentos, regimes, CFOPs, incidências, retenções, responsável técnico nem estratégia de emissão. Esses dados não podem ser inferidos pelo sistema.

## Decisão

- Estabelecimentos fiscais pertencem ao tenant e guardam CNPJ, UF, inscrição estadual e regime tributário.
- Configurações são imutáveis depois da ativação e agrupadas por uma chave estável com versões crescentes.
- Cada versão explicita estabelecimento, operação, commodity, destino, CFOP, vigência, estratégia de emissão, responsável e tratamentos de ICMS, PIS, COFINS e FUNRURAL.
- Rascunhos podem permanecer incompletos. A ativação exige todos os campos e ao menos um tratamento configurado.
- Uma nova versão clona a anterior como rascunho; ativá-la encerra somente a versão ativa da mesma chave.
- Sobreposição ativa para a mesma operação, estabelecimento, commodity, destino e vigência é bloqueada.
- A presença de configuração ativa muda o estado para BLOCKED_ENGINE; ela não autoriza cálculo tributário até que o motor, bases, arredondamentos e memória de cálculo sejam implementados e homologados.
- Mutações exigem FISCAL_EDIT, usam transação com contexto de tenant, RLS forçada, auditoria e outbox.

## Consequências

O usuário consegue preparar e validar o pacote fiscal sem alterar código nem perder histórico. Nenhuma alíquota de demonstração é ativada pelo seed e nenhum tributo é produzido silenciosamente.
