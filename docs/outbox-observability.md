# Observabilidade do dispatcher da outbox

## Objetivo

Detectar rapidamente paralisação, acúmulo, falhas repetidas e aumento de latência no dispatcher, preservando o isolamento por tenant. A instrumentação usa logs JSON e o formato OpenMetrics/Prometheus, sem vincular a aplicação a um fornecedor. Datadog, Grafana Cloud, Prometheus ou um Collector OpenTelemetry podem coletar os mesmos sinais.

## Endpoints do worker

O processo `pnpm worker:outbox` expõe, por padrão, a porta `9464`:

- `GET /health/live`: confirma que o processo HTTP está vivo;
- `GET /health/ready`: retorna `200` depois do primeiro lote e enquanto o loop não estiver obsoleto; retorna `503` durante a inicialização, encerramento ou paralisação;
- `GET /metrics`: métricas no formato de exposição Prometheus.

Configuração:

| Variável | Padrão | Uso |
| --- | ---: | --- |
| `OUTBOX_OBSERVABILITY_PORT` | `9464` | porta exclusiva de saúde e métricas do worker |
| `OUTBOX_HEALTH_STALE_AFTER_MS` | `30000` | tempo máximo sem conclusão de lote antes de ficar indisponível |
| `OUTBOX_POLL_INTERVAL_MS` | `1000` | espera quando não há eventos prontos |
| `OUTBOX_BATCH_SIZE` | `25` | eventos reivindicados por lote, limitado a 100 |

## Sinais

- `tier_trade_outbox_events_total`: reivindicados, publicados, falhos, recuperados e retentativas agendadas;
- `tier_trade_outbox_batches_total`: lotes concluídos, parcialmente falhos ou interrompidos por erro;
- `tier_trade_outbox_batch_duration_seconds`: histograma de duração;
- `tier_trade_outbox_pending_events`: backlog ainda não publicado;
- `tier_trade_outbox_delayed_events`: eventos aguardando o backoff;
- `tier_trade_outbox_oldest_pending_age_seconds`: idade do evento pendente mais antigo;
- `tier_trade_outbox_last_batch_timestamp_seconds`: instante do último lote concluído;
- `tier_trade_outbox_worker_ready`: estado atual do loop.

O rótulo `tenant_id` é obrigatório para investigação e isolamento. Não adicionar `event_id`, `worker_id`, usuário ou contraparte como rótulos, pois gerariam cardinalidade não controlada. Identificadores de evento e worker ficam somente nos logs.

## Logs estruturados

Eventos emitidos:

- `outbox.event.published`;
- `outbox.event.recovered`;
- `outbox.event.retry_scheduled`;
- `outbox.batch.completed`;
- `outbox.batch.error`;
- `outbox.worker.stopped`.

Os logs contêm tenant, tipo e identificador técnico do evento, tentativa, duração e um código de erro sanitizado. Payload da regra de negócio, documentos, valores, nomes e mensagens brutas de banco não são registrados.

## Alertas iniciais

As regras de referência estão em `ops/prometheus/outbox-alerts.yml` e devem ser traduzidas para o monitor escolhido:

1. worker indisponível por 2 minutos;
2. nenhuma conclusão de lote por 2 minutos;
3. evento mais antigo acima de 5 minutos durante 10 minutos;
4. falhas continuadas por 10 minutos;
5. erro de lote por 2 minutos;
6. backlog acima de 100 eventos durante 10 minutos.

Os limites são iniciais. Ajustar somente com dados do ambiente compartilhado, mantendo uma janela que não dispare durante um backoff normal de até 5 minutos.

## Runbook

1. Identificar os tenants afetados pelas métricas e confirmar `/health/ready`.
2. Correlacionar `outbox.batch.error` e `outbox.event.retry_scheduled` pelo `tenant_id`, `event_id` e `error_code`.
3. Conferir backlog, idade e número de tentativas no banco; não alterar `published_at` manualmente.
4. Corrigir a causa da projeção ou a disponibilidade do banco. O evento será retomado automaticamente após `available_at`.
5. Confirmar `outbox.event.recovered`, redução do backlog e atualização da projeção idempotente.
6. Se houver lease preso, aguardar a recuperação automática de 2 minutos. Reiniciar o worker apenas quando o processo estiver realmente parado.

Escalonar antes de qualquer correção manual que altere payload, tenant, evento financeiro/fiscal ou estado contratual. A outbox e a projeção devem continuar rastreáveis ao evento original.
