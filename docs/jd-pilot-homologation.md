# Homologação do piloto JD — soja e milho

## Objetivo

Validar ponta a ponta o primeiro piloto da JD para compras e vendas de soja e milho, com preço fixo nesta entrega. Preço a fixar e fixações parciais permanecem registrados no plano posterior e não são condição de aceite deste primeiro piloto.

## Cobertura técnica automatizada

- oferta de milho e soja com cálculo determinístico e política de margem versionada;
- aprovação comercial e ativação do contrato de compra;
- agendamento, pátio, pesagens, qualidade, ocorrência e romaneio versionado;
- entrada de estoque pelo recebimento aceito;
- NF-e de compra conferida contra peso e preço, título a pagar e estorno sem apagar histórico;
- composição configurável da compra: desconto de qualidade, frete, armazenagem, retenção e outros componentes;
- configuração fiscal separada para venda/expedição e compra/recebimento;
- contrato de venda, reserva de estoque, expedição, NF-e de saída, título a receber, recebimento e estorno;
- margem realizada por commodity usando receita expedida, custo de aquisição e componentes persistidos;
- política financeira versionada, lote de pagamento, alçada e segregação de função;
- importação de extrato e conciliação exata de crédito/recebimento ou débito/pagamento;
- isolamento por tenant, RLS, auditoria e eventos de saída.

## Cenários mínimos para aceite humano

| Cenário | Commodity | Operação | Resultado esperado |
| --- | --- | --- | --- |
| JD-01 | Milho | Compra com recebimento aceito | Peso, qualidade, NF-e, custos e título rastreáveis |
| JD-02 | Soja | Compra com ocorrência/ajuste | Decisão e ajuste preservam motivo, autor e versão |
| JD-03 | Milho | Venda e expedição | Estoque, NF-e, contas a receber e margem realizados |
| JD-04 | Soja | Venda e liquidação parcial | Saldo, estorno e conciliação permanecem consistentes |

## Pendências externas para homologação final

1. Receber o contrato em que a JD figura como compradora e mapear campos e obrigações sem inferência.
2. Receber as tabelas homologadas de qualidade, tolerâncias e descontos da JD.
3. Receber a matriz fiscal aplicável à JD/MT, com CFOPs, tratamentos, alíquotas, fundos e responsabilidades.
4. Receber bancos, formatos de extrato e matriz nominal de aprovadores/alçadas.
5. Executar os quatro cenários acima com os diretores da JD e registrar aceite, ressalvas e evidências.

Até essas informações chegarem, o sistema permite configurar e testar valores explícitos, mas não inclui alíquotas, descontos, tolerâncias ou alçadas fictícias.
