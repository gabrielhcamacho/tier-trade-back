# Vertical slice financeira — recebíveis de venda

## Resultado funcional

Uma expedição confirmada gera previsão de entrada. O usuário financeiro pode emitir o título com documento e vencimento, registrar recebimentos parciais ou totais e estornar uma baixa com justificativa. A tela lê e altera os mesmos registros do backend do tenant.

## Regras implementadas

- previsão criada atomicamente com a expedição;
- vínculo íntegro entre contrato de venda, expedição, contraparte, previsão, título e baixa;
- valor bruto = quantidade expedida em kg × preço contratual por kg;
- memória guarda entradas, fórmula, versão, moeda e tratamento de arredondamento;
- frações de centavo bloqueiam emissão até existir política homologada;
- vencimento previsto só é criado quando o contrato possui prazo configurado;
- título tem numeração única por tenant e uma única origem financeira;
- referência bancária é única por tenant;
- baixa não pode exceder o saldo e atualiza o estado para aberto, parcial ou liquidado;
- estorno preserva o registro original, o motivo, o ator e recompõe o saldo;
- leitura exige membership; mutações exigem `FINANCE_EDIT`;
- RLS forçada e chaves compostas impedem referência cruzada entre tenants.

## Evolução fiscal integrada

O saldo do título pode receber um ajuste `FISCAL_RETENTION` originado por obrigação fiscal aceita, sem alterar seu valor original. Quando o tenant é responsável pelo recolhimento, a obrigação cria outro evento e outro título de saída cujo favorecido é a autoridade fiscal.

## Fora desta fatia

Baixa de contas a pagar, autorização bancária, extrato e conciliação automática, emissão de guia, juros, multa, comissão e lançamentos contábeis. Esses itens dependem dos pacotes homologados do piloto e entram nas próximas slices sem alterar o livro criado aqui.
