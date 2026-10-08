# ADR 0019 — Read models incrementais para dashboards

## Status

Aceita em 2026-10-08.

## Contexto

Os dashboards da Central e dos módulos Comercial, Contratos, Operações, Estoque, Risco, Financeiro e Fiscal precisam continuar responsivos quando crescerem simultaneamente o número de tenants, usuários e registros históricos.

O endpoint atual da Central compõe workspaces completos durante a requisição, abre transações independentes em vários módulos e agrega coleções em memória. O custo da leitura cresce com os dados do tenant, a resposta transporta registros que não são necessários para o primeiro quadro da tela e acessos concorrentes repetem o mesmo trabalho. Esse formato permanece útil como contrato de transição, mas não deve ser replicado nos novos dashboards.

O backend já possui outbox transacional, processamento idempotente com `FOR UPDATE SKIP LOCKED`, isolamento por `tenant_id` e read models de atividade e contratos. Esses mecanismos serão a base da solução.

## Decisão

Adotar CQRS leve, com tabelas transacionais como fonte oficial e read models incrementais próprios para dashboards.

### Fluxo de escrita e projeção

1. A operação de domínio grava a alteração e o evento no outbox na mesma transação.
2. O projetor processa o evento de forma idempotente e atualiza somente a contribuição do agregado afetado.
3. O projetor invalida os escopos de dashboard afetados em uma fila deduplicada. Exemplos: `commercial:ALL`, `commercial:MILHO`, `central:ALL`.
4. Um processador de refresh captura escopos com `FOR UPDATE SKIP LOCKED`, consolida eventos próximos e recompõe o snapshot a partir dos read models do módulo, nunca a partir de chamadas HTTP entre módulos.
5. O snapshot é publicado por `UPSERT` com versão monotônica, watermark do outbox e horário de geração.
6. Se novos eventos chegarem durante a reconstrução, a versão da invalidação muda e o escopo permanece pendente para uma nova passagem. Nenhuma invalidação é perdida.

### Camadas de dados

- **Contribuições atuais tipadas por módulo:** uma linha por agregado relevante, por exemplo contrato, carga, lote, título ou documento fiscal. Atualizações e reversões substituem a contribuição anterior; não dependem de somar duas vezes o mesmo evento.
- **Buckets históricos:** agregados diários por `tenant_id`, módulo e dimensões suportadas. Alimentam tendências e comparações sem varrer livros completos. Períodos longos podem ser servidos por buckets mensais derivados dos diários.
- **Itens de atenção:** projeção pequena e ordenável de exceções acionáveis, com gravidade, impacto, responsável, prazo, origem e rota de drill-down.
- **Snapshots de resposta:** JSON versionado apenas para combinações canônicas de filtro. A primeira versão suporta `ALL` e commodity. Unidade, safra e outros filtros só entram quando forem dimensões confiáveis nos fatos de origem.

Não será criada uma tabela EAV genérica de métricas. As contribuições e buckets que participam de cálculos terão colunas tipadas; JSON fica restrito ao payload final versionado e a metadados não consultados.

### Contrato de leitura

Cada endpoint `GET /v1/dashboards/:module` fará uma consulta de autorização e uma leitura indexada do snapshot. Drill-down e listas completas permanecem em endpoints próprios e paginados.

Toda resposta inclui:

- `contractVersion` e `snapshotVersion`;
- `generatedAt` e `sourceWatermark`;
- `freshness` (`FRESH`, `STALE`, `REBUILDING` ou `UNAVAILABLE`);
- filtros aplicados e dimensões não suportadas;
- indicadores, séries limitadas, itens de atenção limitados e links de drill-down;
- qualidade e indisponibilidade explícitas por fonte.

O endpoint usa `ETag` derivado de tenant, módulo, escopo e versão. Respostas autenticadas usam cache privado curto e `stale-while-revalidate`; não haverá cache compartilhado entre tenants. Um snapshot anterior pode ser servido como `STALE` durante rebuild, mas nunca será apresentado como atual.

### Custos e limites

- Leitura do dashboard: alvo de O(1) em relação ao histórico do tenant, normalmente uma linha de snapshot mais autorização.
- Processamento de evento: O(1) para atualizar a contribuição afetada e invalidar poucos escopos conhecidos.
- Rebuild: limitado aos read models e buckets de um tenant, módulo e escopo; eventos próximos são deduplicados.
- Coleções no snapshot são limitadas. Listas completas usam paginação por cursor.
- Não são executadas consultas por usuário: o snapshot é compartilhado dentro do mesmo escopo autorizado do tenant. Capacidades controlam ações e campos sensíveis sem duplicar cálculo.

### Multi-tenancy e workers

O worker não deve exigir um processo dedicado por tenant. Uma frota comum enumera tenants ativos em lotes, distribui-os por shard estável e usa as transações tenant-scoped existentes. Vários workers podem operar simultaneamente porque os claims usam `SKIP LOCKED` e leases com expiração.

Toda tabela de projeção mantém `tenant_id` como primeira coluna de chave e de índices. RLS continua habilitada e forçada. Funções `SECURITY DEFINER` não serão usadas para contornar o isolamento. Processos internos usam o mesmo contexto explícito de tenant da API.

### Índices

Índices serão definidos a partir das consultas reais e validados com `EXPLAIN (ANALYZE, BUFFERS)` em volume representativo. O conjunto inicial inclui:

- chave primária de snapshot em `(tenant_id, module, scope_key)`;
- fila pronta parcial em `(available_at, requested_at)` para itens não bloqueados/concluídos;
- contribuições em `(tenant_id, dimensões, status)` conforme cada módulo;
- buckets em `(tenant_id, bucket_date, dimensões)`;
- itens de atenção em `(tenant_id, module, resolved_at, severity, due_at)` com índice parcial para abertos.

Índices redundantes não serão adicionados preventivamente. Datas append-heavy de grande volume podem usar BRIN somente após medição.

### Materialized views, Cron e Redis

- **Materialized views globais:** não serão o mecanismo principal. `REFRESH MATERIALIZED VIEW` recompõe conjuntos maiores que o recorte alterado e dificulta isolamento e frescor por tenant.
- **Supabase Cron:** será usado apenas como rede de segurança para reconciliação, compactação de buckets e detecção de projeções atrasadas. O caminho normal é orientado a eventos.
- **Redis:** não é requisito inicial. Pode ser adicionado depois para resultados extremamente quentes ou coordenação distribuída, mantendo Postgres como fonte recuperável do snapshot.
- **Read replicas:** podem absorver drill-down analítico no futuro. Snapshots recém-projetados continuam sendo lidos do primário quando for necessária leitura após escrita.

## Observabilidade e SLOs

Registrar por módulo e tenant, evitando labels de alta cardinalidade fora do conjunto controlado:

- latência p50/p95/p99 e taxa de cache condicional `304`;
- idade do snapshot e atraso entre outbox e projeção;
- tamanho e idade da fila de refresh;
- quantidade de rebuilds, coalescência e falhas;
- linhas, tempo e buffers lidos nas consultas de rebuild;
- payload e tempo de serialização;
- uso do pool e espera por conexão.

Metas iniciais:

- p95 do endpoint de snapshot abaixo de 200 ms no backend;
- snapshot comum com no máximo 15 segundos de idade;
- backlog crítico de projeção alertado acima de 60 segundos;
- payload comprimido abaixo de 200 KiB por dashboard;
- nenhuma consulta de dashboard sem `tenant_id` explícito.

## Recuperação e consistência

Read models são descartáveis e reconstruíveis. Cada projetor registra o último evento aplicado e aceita replay idempotente. Será fornecido comando de rebuild por tenant/módulo e auditoria que compara amostras do snapshot com as tabelas oficiais.

A consistência é eventual e explícita. Ações de domínio continuam lendo e gravando os livros oficiais; dashboards nunca autorizam uma operação com base apenas no snapshot.

## Sequência de implementação

1. Criar infraestrutura comum de snapshot, invalidação, lease, versão e métricas.
2. Tornar o worker multi-tenant e justo antes de aumentar o número de projeções.
3. Migrar a Central para `contractVersion: 2`, removendo `sources` e separando drill-down.
4. Entregar Contratos, Operações, Estoque, Financeiro, Fiscal, Comercial e Risco sobre a mesma infraestrutura.
5. Adicionar buckets históricos e comparações somente onde houver dimensão e histórico confiáveis.
6. Executar testes de carga e ajustar índices com planos reais antes de habilitar todos os tenants.

## Consequências

- o custo de abrir um dashboard deixa de crescer com todas as tabelas operacionais do tenant;
- picos de usuários não repetem agregações idênticas no banco;
- escritas ganham um pequeno custo de outbox e projeção assíncrona;
- a interface precisa mostrar frescor e eventual defasagem;
- os projetores e suas métricas se tornam parte crítica da operação;
- novos módulos devem publicar eventos e contribuições antes de expor uma visão geral.
