# Decisões pendentes do Tier Trade

Atualizado em 09/10/2026 após validação do sistema com diretor de trading.

O registro principal, com responsáveis por função e momento limite, está no [plano mestre da plataforma](../../tier-trade-platform/docs/plano-mestre.md#6-decisões-pendentes-com-momento-limite). Esta página mostra apenas os bloqueios próximos ao backend.

## Antes de ampliar modalidades contratuais

- **D02 — Preço a fixar e fixações parciais:** base, prêmio, câmbio e cenários homologados. Responsáveis sugeridos: direção comercial e produto.

O primeiro piloto foi confirmado para a JD, com soja e milho e preço fixo. A espera pelo contrato de compra da JD não impede os testes técnicos dessa modalidade. Preço a fixar e fixações parciais ficam para a evolução posterior e continuam bloqueados especificamente pela falta de base, prêmio, câmbio e cenários homologados.

## Antes das próximas slices especializadas

- **D03 — Qualidade:** `Exemplos.xlsx` já definiu os fatos operacionais (pesos, tolerância registrada, umidade, impurezas, avariados, quebrados, queimados e ardidos). Ainda faltam homologar por commodity os limites, tolerâncias, contraprova e bases de desconto; esses valores permanecem configuráveis e não são inferidos das linhas históricas.
- **D04 — Frete:** responsável, rateio, documentos e gatilho da despesa, antes das slices 4 e 7.
- **D05 — Fiscal MT:** estabelecimentos, regimes, operação, UPF, FETHAB, IAGRO, SENAR, fundos, bases, vigência e arredondamento, antes das slices 5 e 8.
- **D06 — Tesouraria:** o motor de alçadas, lotes, contas, lançamentos e conciliação exata já está implementado. Faltam somente banco/formato real, aprovadores nominais e decidir se haverá importação de OFX/CNAB no piloto; não reconstruir a conciliação.
- **D07 — Contábil:** plano, eventos, apropriações, integração ou execução nativa e fechamento, antes da slice 9.
- **D08 — Risco:** fonte, praça, instrumentos, frequência, base/câmbio e executor, antes da slice 10.
- **D09 — Migração:** fontes, responsáveis, volumes, mapeamentos, corte e tolerâncias, antes da slice 11.

`Exemplos.xlsx` fornece cenários e perguntas; taxas e tratamentos nela vistos não estão homologados para uso oficial.

## Decisões derivadas da validação com diretor de trading

A pauta preenchida, os participantes, materiais e critérios de saída estão em [Workshop de decisões V01–V05](validation-workshop-v01-v05.md). Em 09/10/2026, as cinco decisões passaram para **em preparação**; nenhuma regra operacional ou fiscal foi homologada apenas pela criação da pauta.

- **V01 — Vocabulário financeiro e gerencial:** aprovar os nomes, fórmulas e estados de receita expedida, custo apropriado, margem projetada, margem realizada, a pagar, a receber, recebido e caixa. Até a aprovação, a margem realizada permanece gerencial e não pode ser apresentada como margem líquida contábil. Responsáveis sugeridos: direção, financeiro, contabilidade e produto.
- **V02 — Conciliação por carga:** definir qual expedição/nota de saída corresponde a cada recebimento/nota de entrada quando houver consolidação, fracionamento, mistura de lotes ou múltiplos destinos; aprovar o tratamento de diferença positiva e negativa de peso e valor. Responsáveis sugeridos: operações, fiscal e financeiro.
- **V03 — Qualidade e desconto contratual:** aprovar por commodity os indicadores, tolerâncias, faixas, fórmula, arredondamento, contraprova, alçada e documento que autoriza o ajuste. A relação `1 p.p. excedente = 1% de desconto` é apenas um cenário candidato; não é regra global. Responsáveis sugeridos: qualidade, comercial, fiscal e jurídico.
- **V04 — Requisitos por sacado e terminal:** listar para cada cliente/terminal os documentos e eventos que liberam reconhecimento da entrega e pagamento, prazo, responsável, portal, evidência de submissão e consequência sobre recebível, antecipação ou limite. Responsáveis sugeridos: logística, contas a receber e crédito.
- **V05 — Portais externos prioritários:** fornecer a lista inicial de portais, volumes, credenciais disponíveis, termos de uso e contatos técnicos. A primeira entrega será workflow manual auditável; integração só entra no backlog após verificar API ou outro meio autorizado e calcular benefício. Responsáveis sugeridos: logística, TI e produto.

Essas decisões complementam D03, D05, D06 e D09. Elas não autorizam cadastrar como padrão uma tolerância fixa entre balanças, uma tabela de desconto universal ou uma alíquota fiscal observada em exemplo isolado.

## Antes de abrir produção para operação não assistida

- **D10 — Continuidade:** resolvida para o piloto. O projeto Supabase atual é produção e o produto decidiu não incluir backup automático/PITR agora; backup manual será feito apenas quando solicitado. RPO/RTO e restauração automatizada voltam antes de elevar o compromisso de disponibilidade.
- **D11 — Operação:** frontend Vercel, API DigitalOcean, redirects e health checks estão ativos. Faltam domínio final, SMTP transacional, administradores definitivos, MFA e runbook antes do acesso não assistido.

Convite via API administrativa e ambiente compartilhado do piloto permanecem soluções atuais. Painel comercial do SaaS, preços, implantação e onboarding self-service são posteriores ao primeiro piloto assistido e estão em D12 no plano mestre.

## Decisões já tomadas

- A JD é a trading do primeiro piloto; os quatro cenários serão validados pelos diretores.
- O primeiro piloto cobre soja e milho com preço fixo. Preço a fixar e fixações parciais serão implementados depois.
- Supabase Auth é o primeiro adaptador de identidade; tenant vem de membership verificada, não do navegador.
- A política de margem é configurável e versionada por tenant.
- O projeto Supabase atual do Tier Trade é o banco de produção e também hospeda o bucket privado de documentos; ambientes futuros não podem compartilhar dados com ele.
- API e worker do MVP são implantados no DigitalOcean; frontend no Vercel. O worker combinado é a configuração inicial de menor porte, sujeita a validação de capacidade e isolamento.
- Pagamentos fiscais, estornos, lotes sujeitos a alçada e conciliação bancária exata são persistidos; contabilização continua pendente de D07.
- Comissão versionada, apropriação e margem realizada gerencial já são persistidas; não são substitutos de fechamento contábil e DRE.
