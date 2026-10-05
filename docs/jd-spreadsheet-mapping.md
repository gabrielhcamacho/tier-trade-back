# Mapeamento de `Exemplos.xlsx` para o Tier Trade

## O que a planilha já permite modelar

| Controle da JD | Destino no sistema | Situação |
| --- | --- | --- |
| Commodity, PF/PJ/cooperativa, origem e datas | Comercial, contraparte, contrato e carga | Coberto |
| NF do produtor/JD, placa, peso de NF, chegada e peso considerado | Recebimento, fiscal e romaneio | Coberto e versionado |
| Umidade, impureza, avariados, quebrados, queimados e ardidos | Qualidade do recebimento | Coberto como fatos medidos |
| Tolerância, peso descontado/limpo e diferença | Recebimento e componentes de custo | Estrutura disponível; regra aguarda homologação |
| FETHAB, IAGRO, SENAR e fundos | Configuração e cálculo fiscal versionado | Motor disponível; alíquotas da JD aguardam homologação |
| Frete, armazenagem, desconto e outras despesas | Componentes de custo da compra | Coberto por lançamentos explícitos |
| Comissão | Política de comissão e apropriação | Coberto por política versionada |
| Valor a pagar/receber e recebido em conta | Títulos, pagamentos, recebimentos e conciliação | Coberto |
| Resultado | Margem realizada por commodity | Coberto a partir dos eventos persistidos |

## Regra de uso

Os percentuais observados variam por linha e parte dos resultados foi digitada manualmente. Por isso a planilha é evidência de processo e de campos, não catálogo oficial de alíquotas. Limites de qualidade, descontos, fundos, frete, comissão e arredondamento exigem versão, vigência, autor e aceite da JD antes de automação definitiva.

## Pendências externas remanescentes

1. Contrato em que a JD figura como compradora.
2. Tabelas homologadas de qualidade por soja/milho e regras de contraprova.
3. Matriz fiscal/MT com vigências, bases e arredondamentos.
4. Política de frete e matriz nominal de tesouraria/alçadas.
