# Escopo de Negócio do Tier Trade

Documentação de negócio do produto. Os arquivos `.md` nesta pasta são as versões vigentes. A subpasta `historico/` guarda as versões anteriores em `.docx`, substituídas em 8 de outubro de 2026.

## Ordem de leitura recomendada

1. **Revisao Critica - Lacunas de Regras de Negocio.md** — diagnóstico do que faltava na documentação anterior e por quê. Leia primeiro para entender as mudanças.
2. **Catalogo de Regras e Calculos do Piloto 1_1.md** — o rulebook. Toda regra tem código (UN, PR, CX, AD, SL, QL, CU, LQ, CM, TR, CS, CC, MG), fórmula, parâmetros a homologar e cenários. É o documento contra o qual o código será homologado com a JD.
3. **Escopo do MVP e Plano de Fases 1_3.md** — ondas de homologação e virada (A, B, C, D), gates vinculados ao Catálogo, decisões D02 a D15.
4. **Visao Completa Produto 1_3.md** — tese, mercado, módulos, IA, escopo do MVP e modelo comercial, alinhados ao Plano 1.3.
5. **Escopo de Negocio Completo 1_2.md** — fronteira integral do produto, independente do MVP.

## Documentos temáticos

Alimentaram o Catálogo 1.1 e permanecem como leitura aprofundada por tema:

- **Contratos - Moedas Unidades e Fixacao.md** — unidade, moeda, câmbio, fixação de preço e de câmbio, adiantamentos.
- **Qualidade e Descontos de Classificacao.md** — peso físico e comercial, métodos de desconto, aceite, contraprova.
- **Cessoes Transferencias e Operacoes Triangulares.md** — cessão de crédito e de posição, reaplicação, washout, venda à ordem, back to back.

## Documentos de arquitetura (vigentes, em .docx)

- **Arquitetura Futura Principios Dominio 1_2.docx** — pendência registrada: separar o conteúdo do Mountier Agro do Tier Trade na próxima revisão.
- **Arquitetura Multitenancy Dados e Implantacao_1_1.docx** — vigente, sem pendências.

## Versões vigentes

| Documento | Versão vigente | Substitui |
|---|---|---|
| Visão Completa do Produto | 1.3 (.md) | 1.2 (historico) |
| Escopo de Negócio Completo | 1.2 (.md) | 1.1 (historico) |
| Escopo do MVP e Plano de Fases | 1.3 (.md) | 1.2 (historico) |
| Catálogo de Regras e Cálculos | 1.1 (.md) | 1.0 (historico) |
| Arquitetura Futura e Princípios de Domínio | 1.2 (.docx) | — |
| Arquitetura de Multitenancy | 1.1 (.docx) | — |

## Convenção dos documentos

- **Referência**: valor de prática de mercado ou norma; orienta, não entra em produção.
- **Parâmetro**: valor que a trading piloto precisa preencher e aprovar, com responsável nominal.
- **Decisão (D02 a D15)**: códigos compartilhados com `docs/decisions-pending.md` do repositório.

## Relação com o código

O Catálogo cita regras que o código já implementa. Onde código e Catálogo divergirem, a divergência deve ser decidida e registrada, nunca resolvida em silêncio. Exemplo: a regra MG-01 registra que o código rateia o custo da compra proporcionalmente ao peso expedido e que isso precisa de validação do contador.
