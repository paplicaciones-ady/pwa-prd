#!/usr/bin/env bash
# =========================================================
# dev-rebuild.sh — Reconstruye el backend de desarrollo
#
# El volumen anónimo de node_modules ya NO existe en docker-compose.yml
# (el contenedor usa el node_modules del host vía bind mount), así que un
# rebuild normal no puede dejar dependencias stale.
#
# Uso:
#   ./dev-rebuild.sh            # rebuild imagen + up + healthcheck
#   ./dev-rebuild.sh down        # para todo y borra volúmenes (pierde la BD)
# =========================================================
set -euo pipefail
cd "$(dirname "$0")"

case "${1:-}" in
  down)
    echo ">>> docker compose down -v"
    docker compose down -v
    echo ">>> Vuelves a tener la BD vacía. Ejecuta migrations tras el up:"
    echo "    cd backend && DB_HOST=127.0.0.1 DB_PORT=5433 REDIS_HOST=127.0.0.1 npm run migration:run"
    exit 0
    ;;
  -h|--help)
    echo "Usage: $0 [down]"
    echo "  (sin args)  docker compose up -d --build backend + healthcheck"
    echo "  down        docker compose down -v (para todo + borra volúmenes)"
    exit 0
    ;;
esac

echo ">>> Rebuild imagen (sin volumen stale de por medio)..."
docker compose up -d --build backend

echo ""
echo ">>> Esperando health check..."
for i in $(seq 1 30); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/health/ready 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "    Backend healthy (via Kong :8000) en $((i*2))s"
    exit 0
  fi
done
echo "    WARN: backend no respondió en 60s — revisa docker logs pwa-backend"
exit 1