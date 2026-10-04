# ADR 0017 — Commodities do MVP e perfil explícito da contraparte

Data: 04/10/2026
Estado: aceito para a base estrutural da Fase 1; não homologa regras comerciais ou fiscais do piloto.

## Contexto

O Escopo do MVP e Plano de Fases 1.2 inclui soja e milho e exige cadastros de contrapartes adequados à contratação. O código inicial aceitava apenas milho e guardava nome e documento sem distinguir pessoa física, pessoa jurídica ou cooperativa. A planilha `Exemplos.xlsx` reforçou esses perfis, mas não define regras oficiais de preço, imposto ou margem.

## Decisão

- `MILHO` e `SOJA` são os únicos códigos admitidos para oferta de compra, contrato de venda e políticas de margem/risco desta etapa. Cada commodity mantém política de margem versionada independente. A fórmula existente de margem projetada por saca permanece inalterada; nenhuma taxa da planilha foi incorporada.
- Uma nova contraparte informa explicitamente `PERSON`, `COMPANY` ou `COOPERATIVE`. O comprimento do CPF/CNPJ precisa corresponder ao tipo, mas o tipo não é inferido do documento. Registros anteriores permanecem `UNCLASSIFIED` até confirmação por usuário com `COMMERCIAL_EDIT`.
- Novas ofertas e contratos de venda não podem usar contraparte não classificada. A classificação posterior é auditada e publicada na outbox. A listagem de contrapartes expõe apenas comprimento e quatro últimos dígitos do documento, não o documento completo.
- A migration é aditiva: não reescreve contratos existentes, não aplica alíquotas fiscais e não ativa nenhuma política de soja automaticamente.

## Consequências e limites

O usuário precisa configurar a política da soja antes de criar a primeira oferta de soja e classificar contrapartes legadas antes de novas operações com elas. A classificação não comprova documentação, compliance ou regularidade cadastral. A aprovação comercial, os modelos contratuais, preço a fixar, comissões e obrigações dependem das decisões D01/D02 e das demais entregas da Fase 1; esta ADR não declara a fase concluída.

## Verificação

Migration testada no PostgreSQL 17 do perfil Colima `tier-trade` e suíte HTTP cobrindo perfil incompatível, contraparte legada bloqueada, classificação auditada, política independente da soja, oferta de soja aprovada e contrato de venda de soja. O schema RLS e as chaves compostas existentes permanecem aplicáveis.
