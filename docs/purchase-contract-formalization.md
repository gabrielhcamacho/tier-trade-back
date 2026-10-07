# Formalização do contrato de compra

## Escopo implementado

O contrato ativo continua nascendo de uma oferta aprovada. Preço, volume, commodity e janela de entrega pertencem à oferta e ao cenário de preço versionado; a formalização não os sobrescreve. O registro `app.purchase_contract_terms` guarda número externo, safra, data de assinatura, retirada, condição de entrega, responsável pelo frete, responsabilidade da pesagem e textos das condições de qualidade, documentos e pagamento.

`PUT /v1/contracts/:contractId/purchase-terms` exige `COMMERCIAL_EDIT`, tenant ativo e `expectedVersion`. A gravação incrementa a versão e produz evento de auditoria/outbox com antes e depois. `GET /v1/contracts/:contractId/summary` devolve `purchase_terms` ou `null`. O arquivo assinado permanece no módulo de documentos do contrato; o registro de termos não substitui o documento nem atesta validade jurídica.

## Limites deliberados

- O contrato real de compra da JD serviu para identificar campos, não para popular a demonstração. Não copiar dados pessoais, bancários nem o PDF assinado para o repositório.
- Os textos de qualidade, documentos e pagamento são rastreáveis, mas não criam descontos, retenções, vencimentos ou bloqueios automáticos. A tabela de descontos mencionada no PDF não está preenchida; a JD precisa fornecer e homologar a tabela e resolver a regra de divergência de classificação antes de automatizar valores.
- A escolha do responsável pelo frete é informativa nesta etapa. O cálculo de margem continua usando o custo de frete da oferta aprovada.
- Contratos já existentes retornam `purchase_terms: null` até serem cadastrados. A API mantém a compatibilidade de leitura, mas a migração precisa preceder o deploy da API.

## Verificação e implantação

Aplicar `20261007205930_purchase_contract_terms.sql` no ambiente de destino antes de publicar a API, depois publicar o front. Validar com usuário autorizado o cadastro de um contrato sem dados reais de demonstração, edição concorrente (409), leitura isolada por tenant e anexo do documento assinado. Não aplicar dados da JD sem autorização específica.
