# Decisões pendentes

## Bloqueiam ambiente compartilhado

1. Projeto Supabase e ambientes definitivos, incluindo domínio, SMTP e URLs de redirecionamento.
2. Topologia dos ambientes gerenciados e política de residência/backup.

## Não bloqueiam o desenvolvimento local da primeira fatia

- transporte externo definitivo da outbox e tecnologia de fila; o dispatcher interno em PostgreSQL já está definido;
- ferramenta de observabilidade e retenção dos sinais;
- integração com Mountier Agro;
- regras fiscais, contábeis, liquidação, qualidade realizada e execução física;
- nome comercial definitivo do produto.

## Resolvidas

- Supabase Auth é o primeiro adaptador OIDC;
- cada tenant configura e versiona a própria política de margem;
- a primeira slice está tecnicamente homologada para edição e cancelamento controlados.
- o Control Plane mínimo resolve um único tenant ativo por usuário e coordena convite, membership e capabilities;
- no MVP, o convite parte da API administrativa; a origem será substituída pelo painel interno comercial sem mudar o contrato de acesso.
