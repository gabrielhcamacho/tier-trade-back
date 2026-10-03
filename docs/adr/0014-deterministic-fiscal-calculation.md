# ADR 0014 — cálculo fiscal determinístico e imutável

## Contexto

O Catálogo de Regras e Cálculos do Piloto exige determinismo, vigência, memória, origem e reprocessamento controlado. A parametrização fiscal real ainda depende de homologação profissional e não pode ser embutida no código.

## Decisão

O motor seleciona exatamente uma configuração `ACTIVE` por tenant, estabelecimento, operação, commodity, UF de destino e data do fato. A ausência de correspondência falha explicitamente; duas correspondências são tratadas como ambiguidade.

Cada componente declara tratamento, base, alíquota e retenção. Nesta versão, a única fórmula implementada é a base explicitamente configurada como `DOCUMENT_TOTAL`, multiplicada pela alíquota da versão. Modo e escala de arredondamento pertencem à configuração e são obrigatórios para ativação. A aritmética usa `Decimal`; nenhum cálculo financeiro usa `number` binário.

Cada execução recebe `requestKey`, persiste entrada e resultado como snapshots, mantém o identificador e a versão da configuração e não é atualizável. Repetir a mesma chave com a mesma entrada devolve o resultado original; conteúdo diferente é rejeitado.

## Consequências

- alterações futuras criam nova versão e não reescrevem cálculos anteriores;
- bases ou fórmulas adicionais exigirão ampliação explícita e testes de homologação;
- o cálculo permanece sem efeitos até aceite explícito; obrigações e efeitos financeiros são tratados pelo ADR 0015;
- alíquotas e tratamentos permanecem dados homologados pelo tenant, não constantes do sistema.
