# Decisões pendentes do Tier Trade

O registro principal, com responsáveis por função e momento limite, está no [plano mestre da plataforma](../../tier-trade-platform/docs/plano-mestre.md#6-decisões-pendentes-com-momento-limite). Esta página mostra apenas os bloqueios próximos ao backend.

## Antes de ampliar modalidades contratuais

- **D02 — Preço a fixar e fixações parciais:** base, prêmio, câmbio e cenários homologados. Responsáveis sugeridos: direção comercial e produto.

O primeiro piloto foi confirmado para a JD, com soja e milho e preço fixo. A espera pelo contrato de compra da JD não impede os testes técnicos dessa modalidade. Preço a fixar e fixações parciais ficam para a evolução posterior e continuam bloqueados especificamente pela falta de base, prêmio, câmbio e cenários homologados.

## Antes das próximas slices especializadas

- **D03 — Qualidade:** `Exemplos.xlsx` já definiu os fatos operacionais (pesos, tolerância registrada, umidade, impurezas, avariados, quebrados, queimados e ardidos). Ainda faltam homologar por commodity os limites, tolerâncias, contraprova e bases de desconto; esses valores permanecem configuráveis e não são inferidos das linhas históricas.
- **D04 — Frete:** responsável, rateio, documentos e gatilho da despesa, antes das slices 4 e 7.
- **D05 — Fiscal MT:** estabelecimentos, regimes, operação, UPF, FETHAB, IAGRO, SENAR, fundos, bases, vigência e arredondamento, antes das slices 5 e 8.
- **D06 — Tesouraria:** banco, extrato, aprovadores e conciliação, antes da slice 7.
- **D07 — Contábil:** plano, eventos, apropriações, integração ou execução nativa e fechamento, antes da slice 9.
- **D08 — Risco:** fonte, praça, instrumentos, frequência, base/câmbio e executor, antes da slice 10.
- **D09 — Migração:** fontes, responsáveis, volumes, mapeamentos, corte e tolerâncias, antes da slice 11.

`Exemplos.xlsx` fornece cenários e perguntas; taxas e tratamentos nela vistos não estão homologados para uso oficial.

## Antes de declarar produção pronta

- **D10 — Continuidade:** o projeto Supabase atual foi confirmado como produção. Ainda faltam definir/validar backup/PITR, RPO, RTO, retenção e executar um ensaio de restauração.
- **D11 — Operação:** domínios, SMTP, redirects, aceite da região, IPs de saída, administradores e MFA.

Convite via API administrativa e ambiente compartilhado do piloto permanecem soluções atuais. Painel comercial do SaaS, preços, implantação e onboarding self-service são posteriores ao primeiro piloto assistido e estão em D12 no plano mestre.

## Decisões já tomadas

- A JD é a trading do primeiro piloto; os quatro cenários serão validados pelos diretores.
- O primeiro piloto cobre soja e milho com preço fixo. Preço a fixar e fixações parciais serão implementados depois.
- Supabase Auth é o primeiro adaptador de identidade; tenant vem de membership verificada, não do navegador.
- A política de margem é configurável e versionada por tenant.
- O projeto Supabase atual do Tier Trade é o banco de produção e também hospeda o bucket privado de documentos; ambientes futuros não podem compartilhar dados com ele.
- API e worker do MVP são implantados no DigitalOcean; frontend no Vercel. O worker combinado é a configuração inicial de menor porte, sujeita a validação de capacidade e isolamento.
- Pagamentos fiscais, estornos, lotes sujeitos a alçada e conciliação bancária exata são persistidos; contabilização continua pendente de D07.
