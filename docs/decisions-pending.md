# Decisões pendentes do Tier Trade

O registro principal, com responsáveis por função e momento limite, está no [plano mestre da plataforma](../../tier-trade-platform/docs/plano-mestre.md#6-decisões-pendentes-com-momento-limite). Esta página mostra apenas os bloqueios próximos ao backend.

## Antes da próxima modelagem contratual

- **D01 — Recorte do piloto:** trading de referência e de contraste, unidade, commodities, operações e modalidades reais. Responsáveis sugeridos: produto e parceiros piloto.
- **D02 — Modalidades:** preço a fixar, fixação parcial, base/prêmio/câmbio e quatro cenários de aceite. Responsáveis sugeridos: direção comercial e produto.

Essas decisões são necessárias antes da migration que amplie contrato e contraparte. O Escopo do MVP 1.2 inclui soja e milho e preço fixo ou a fixar. Uma redução formal de recorte exige registrar a decisão e atualizar os testes de aceite.

## Antes das próximas slices especializadas

- **D03 — Qualidade:** tabelas, limites, tolerâncias, contraprova e base de desconto de soja/milho, antes da slice 3.
- **D04 — Frete:** responsável, rateio, documentos e gatilho da despesa, antes das slices 4 e 7.
- **D05 — Fiscal MT:** estabelecimentos, regimes, operação, UPF, FETHAB, IAGRO, SENAR, fundos, bases, vigência e arredondamento, antes das slices 5 e 8.
- **D06 — Tesouraria:** banco, extrato, aprovadores e conciliação, antes da slice 7.
- **D07 — Contábil:** plano, eventos, apropriações, integração ou execução nativa e fechamento, antes da slice 9.
- **D08 — Risco:** fonte, praça, instrumentos, frequência, base/câmbio e executor, antes da slice 10.
- **D09 — Migração:** fontes, responsáveis, volumes, mapeamentos, corte e tolerâncias, antes da slice 11.

`Exemplos.xlsx` fornece cenários e perguntas; taxas e tratamentos nela vistos não estão homologados para uso oficial.

## Antes de declarar produção pronta

- **D10 — Continuidade:** projeto Supabase separado, backup/PITR, RPO, RTO, retenção e restauração ensaiada.
- **D11 — Operação:** domínios, SMTP, redirects, aceite da região, IPs de saída, administradores e MFA.

Convite via API administrativa e ambiente compartilhado do piloto permanecem soluções atuais. Painel comercial do SaaS, preços, implantação e onboarding self-service são posteriores ao primeiro piloto assistido e estão em D12 no plano mestre.

## Decisões já tomadas

- Supabase Auth é o primeiro adaptador de identidade; tenant vem de membership verificada, não do navegador.
- A política de margem é configurável e versionada por tenant.
- O ambiente compartilhado do piloto usa Supabase em `sa-east-1`; produção terá projeto independente.
- API e worker do MVP são implantados no DigitalOcean; frontend no Vercel. O worker combinado é a configuração inicial de menor porte, sujeita a validação de capacidade e isolamento.
- Pagamentos fiscais e estornos são persistidos; conciliação bancária e contabilização continuam pendentes.
