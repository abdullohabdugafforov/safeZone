#!/usr/bin/env bash
# One command for local development: Postgres + Redis, backend API and Metro.
#
#   pnpm dev:all            # Metro for Expo Go (scan the QR with the phone camera)
#   pnpm dev:all client     # Metro for the installed development build
#
# Ctrl+C stops the backend and Metro (Postgres/Redis keep running in Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:-go}"
API_PORT=3000
METRO_PORT="${METRO_PORT:-8082}"
LOG_DIR="$ROOT/.dev-logs"
mkdir -p "$LOG_DIR"

say() { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

port_busy() { lsof -iTCP:"$1" -sTCP:LISTEN -P >/dev/null 2>&1; }

# --- Docker --------------------------------------------------------------------
say "Docker"
if ! docker info >/dev/null 2>&1; then
  [[ "$(uname)" == "Darwin" ]] && open -a Docker || fail "Start Docker and retry."
  printf 'Waiting for Docker'
  for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; printf '.'; sleep 2; done
  echo
  docker info >/dev/null 2>&1 || fail "Docker did not start."
fi
(cd "$ROOT" && docker compose up -d --wait)

# --- Backend config ------------------------------------------------------------
ENV_FILE="$ROOT/apps/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  say "Creating apps/backend/.env with fresh secrets"
  cp "$ROOT/apps/backend/.env.example" "$ENV_FILE"
  sed -i '' "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -base64 48 | tr -d '\n')|" "$ENV_FILE"
  sed -i '' "s|^HASH_PEPPER=.*|HASH_PEPPER=$(openssl rand -base64 48 | tr -d '\n')|" "$ENV_FILE"
fi

# --- Build + migrate -----------------------------------------------------------
say "Building shared package and applying migrations"
(cd "$ROOT" && pnpm install --frozen-lockfile >/dev/null)
(cd "$ROOT" && pnpm --filter @safekid/shared build >/dev/null)
(cd "$ROOT/apps/backend" && pnpm exec prisma generate >/dev/null && pnpm exec prisma migrate deploy)

# --- Ports ---------------------------------------------------------------------
for port in "$API_PORT" "$METRO_PORT"; do
  if port_busy "$port"; then
    fail "Port $port is in use (lsof -iTCP:$port -sTCP:LISTEN). Stop that process or set METRO_PORT."
  fi
done

# --- Backend -------------------------------------------------------------------
say "Starting backend on :$API_PORT (log: .dev-logs/backend.log)"
(cd "$ROOT/apps/backend" && exec pnpm dev) >"$LOG_DIR/backend.log" 2>&1 &
API_PID=$!
cleanup() {
  kill "$API_PID" 2>/dev/null || true
  pkill -P "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Show OTP codes (console SMS provider) and errors from the backend in this terminal.
tail -n 0 -F "$LOG_DIR/backend.log" 2>/dev/null |
  grep --line-buffered -E "ConsoleSms|ERROR|listening" |
  sed -u 's/\x1b\[[0-9;]*m//g; s/^/[api] /' &
TAIL_PID=$!
trap 'cleanup; kill $TAIL_PID 2>/dev/null || true' EXIT INT TERM

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo localhost)"
for _ in $(seq 1 60); do curl -fs "http://localhost:$API_PORT/v1/health" >/dev/null 2>&1 && break; sleep 1; done
curl -fs "http://localhost:$API_PORT/v1/health" >/dev/null || fail "Backend did not start, see .dev-logs/backend.log"
say "Backend ready: http://$IP:$API_PORT  (phone must be on the same Wi-Fi)"

# --- Metro ---------------------------------------------------------------------
cd "$ROOT/apps/mobile"
if [[ "$MODE" == "client" ]]; then
  say "Metro for the development build on :$METRO_PORT"
  npx expo start --dev-client --port "$METRO_PORT"
else
  say "Metro for Expo Go on :$METRO_PORT — scan the QR below with the phone camera"
  npx expo start --go --port "$METRO_PORT"
fi
