#!/bin/sh
set -eu

case "${TIER_TRADE_PROCESS:-api}" in
  api)
    node dist/config/check-environment.js
    exec node dist/main.js
    ;;
  worker)
    TIER_TRADE_PROCESS=worker node dist/config/check-environment.js
    exec node dist/outbox/worker.js
    ;;
  combined)
    TIER_TRADE_PROCESS=api node dist/config/check-environment.js
    TIER_TRADE_PROCESS=worker node dist/config/check-environment.js

    node dist/main.js &
    api_pid=$!
    node dist/outbox/worker.js &
    worker_pid=$!

    shutdown() {
      trap - INT TERM
      kill -TERM "$api_pid" "$worker_pid" 2>/dev/null || true
      wait "$api_pid" 2>/dev/null || true
      wait "$worker_pid" 2>/dev/null || true
      exit 0
    }
    trap shutdown INT TERM

    while kill -0 "$api_pid" 2>/dev/null && kill -0 "$worker_pid" 2>/dev/null; do
      sleep 1
    done

    echo "API or worker exited unexpectedly; stopping the combined service." >&2
    kill -TERM "$api_pid" "$worker_pid" 2>/dev/null || true
    wait "$api_pid" 2>/dev/null || true
    wait "$worker_pid" 2>/dev/null || true
    exit 1
    ;;
  *)
    echo "TIER_TRADE_PROCESS must be api, worker or combined" >&2
    exit 1
    ;;
esac
