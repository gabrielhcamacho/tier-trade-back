# Decisões pendentes

## Bloqueiam ambiente compartilhado

1. Domínios definitivos do web e da API, SMTP transacional e URLs públicas de redirecionamento.
2. Plano Supabase, RPO/RTO, retenção e PITR para produção.
3. Aceite formal de `sa-east-1` para residência dos dados de produção.
4. Provedor de hosting e IPs de saída para restringir a rede do banco.

## Não bloqueiam o desenvolvimento local da primeira fatia

- transporte externo definitivo da outbox e tecnologia de fila; o dispatcher interno em PostgreSQL já está definido;
- ferramenta de observabilidade e retenção dos sinais;
- integração com Mountier Agro;
- homologação do pacote fiscal do piloto no catálogo já implementado: estabelecimentos, regimes, CFOPs, incidências, responsável técnico e emissão nativa ou integrada;
- regras contábeis, plano de contas e descontos de qualidade;
- pacote inicial de risco de mercado: fonte, praça, instrumentos, periodicidade, curva, base, câmbio e responsabilidade de execução;
- nome comercial definitivo do produto.

## Resolvidas

- Supabase Auth é o primeiro adaptador OIDC;
- cada tenant configura e versiona a própria política de margem;
- a primeira slice está tecnicamente homologada para edição e cancelamento controlados.
- o Control Plane mínimo resolve um único tenant ativo por usuário e coordena convite, membership e capabilities;
- no MVP, o convite parte da API administrativa; a origem será substituída pelo painel interno comercial sem mudar o contrato de acesso.
- o projeto `Tier trade geral` em `sa-east-1` é o ambiente compartilhado do piloto;
- SSL do banco está obrigatório e as sete migrations locais estão alinhadas ao remoto;
- piloto e produção usarão projetos Supabase separados.
- expedições de venda geram previsão financeira; títulos e baixas são registros separados, auditados e reversíveis.
- posição física, contratual e financeira usa registros oficiais; limites de posição são configuráveis e versionados por tenant.
- documentos fiscais podem ser recebidos, corrigidos, validados e rejeitados; o cálculo tributário só ocorre com configuração ativa e homologada.
- estabelecimentos e configurações fiscais podem ser cadastrados, editados, ativados e versionados; versões ativas são imutáveis e registram base e arredondamento explícitos.
- o motor fiscal seleciona uma versão por contexto e vigência, usa Decimal, é idempotente e persiste memória imutável; gerar obrigações e efeitos financeiros permanece para a próxima fatia.
