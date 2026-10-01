# Primeira vertical slice — compra de milho a preço fixo

## Resultado de negócio

Registrar oferta direta, calcular margem projetada com custos explícitos, aplicar política versionada, encaminhar exceção para aprovação e ativar contrato com obrigações iniciais. Cada transição grava auditoria e outbox na mesma transação.

## Dentro

- milho, unidade `SC_60KG`, BRL implícito nesta fase;
- contraparte previamente cadastrada;
- janela de entrega, quantidade, preço de compra, referência de venda e custos;
- margem projetada por saca;
- aprovação automática, aprovação humana ou bloqueio pelo piso;
- contrato ativo e obrigações `SIGNED_CONTRACT` e `DELIVERY_SCHEDULE`.

## Fora

Cargas, estoque, qualidade realizada, documentos fiscais, impostos definitivos, contas a pagar/receber, liquidação, integração com Mountier Agro e execução de decisões por IA.

## Rastreabilidade

- prioridade e fase: “Escopo do MVP e Plano de Fases” 1.2;
- entidades e fronteiras: “Escopo de Negócio Completo” 1.1 e “Arquitetura Futura e Princípios de Domínio” 1.2;
- cálculo, precisão e evidência: “Catálogo de Regras e Cálculos do Piloto” 1.0;
- tenant, banco, outbox, segurança e implantação: “Arquitetura de Multitenancy, Dados e Implantação” 1.1;
- fluxo e hierarquia: protótipo Tier Trade;
- tokens e componentes: `mountier-trading-ds-v2`, com Geist substituindo Elms Sans.
