# Tenant demonstrativo

O tenant demonstrativo usa as mesmas tabelas, APIs, RLS e regras de domínio dos demais tenants. A diferença é a marcação explícita `app.tenants.is_demo`, que permite restaurar um conjunto canônico de dados fictícios.

## Segurança

- O reset exige `is_demo = true`; qualquer outro tenant é rejeitado.
- O ator precisa ser membro ativo com `COMMERCIAL_EDIT`, `OPERATIONS_EDIT`, `FINANCE_EDIT`, `FISCAL_EDIT` e `RISK_MANAGE`.
- O comando exige a confirmação literal `RESET_DEMO_TENANT`.
- Memberships, convites e histórico de auditoria são preservados.
- Eventos pendentes anteriores são encerrados antes da troca dos dados para não reconstruírem projeções antigas.
- Todos os registros do conjunto canônico usam nomes explicitamente identificados como fictícios.

## Restaurar o cenário

Carregue `DATABASE_URL` no ambiente sem imprimir o valor e execute:

```bash
pnpm demo:reset -- \
  --tenant-id <tenant-uuid> \
  --actor-id <demo-user-uuid> \
  --confirm RESET_DEMO_TENANT
```

O reset substitui somente contraparte, política de margem, ofertas, cenários, aprovações, contratos de compra e venda, obrigações, cargas, recebimentos, lotes, alocações, expedições, movimentos de estoque, previsões financeiras, títulos, baixas, documento fiscal, estabelecimento, configurações e memórias de cálculo fiscal, além da política de risco do tenant demonstrativo. A versão atual do conjunto é `9`. O rascunho fiscal não contém alíquotas inventadas e pode ser completado pelo usuário.

Não use `supabase db reset --linked` para restaurar a demonstração: esse comando apagaria o banco remoto inteiro.
