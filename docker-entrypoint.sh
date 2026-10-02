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
  *)
    echo "TIER_TRADE_PROCESS must be api or worker" >&2
    exit 1
    ;;
esac
