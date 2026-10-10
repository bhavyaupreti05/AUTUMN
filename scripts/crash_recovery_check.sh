#!/usr/bin/env bash
set -euo pipefail

# Linux-only operational check. Do not run this against development data.
if [[ "$(uname -s)" != "Linux" ]]; then
  echo "ERROR: crash_recovery_check.sh is Linux-only" >&2
  exit 1
fi

SERVICE_NAME="${SERVICE_NAME:-chatbot}"
BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
DB_PATH="${1:-}"
LOGIN_USERNAME="${LOGIN_USERNAME:-}"
LOGIN_PASSWORD="${LOGIN_PASSWORD:-}"
COOKIE_JAR="$(mktemp)"
LONG_REQUEST_BODY="$(mktemp)"
trap 'rm -f "$COOKIE_JAR" "$LONG_REQUEST_BODY"' EXIT

if [[ -z "$DB_PATH" || -z "$LOGIN_USERNAME" || -z "$LOGIN_PASSWORD" ]]; then
  echo "ERROR: usage: LOGIN_USERNAME=... LOGIN_PASSWORD=... $0 /absolute/path/to/chatbot.db" >&2
  exit 1
fi

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

systemctl is-active --quiet "$SERVICE_NAME" || fail "service is not active before test"
curl --fail --silent --show-error --max-time 10 "$BASE_URL/api/health" > /dev/null || fail "baseline health check failed"

echo "Baseline service status: $(systemctl is-active "$SERVICE_NAME")"
echo "Baseline health: OK"

curl --fail --silent --show-error --max-time 10 \
  -c "$COOKIE_JAR" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "username=$LOGIN_USERNAME" \
  --data-urlencode "password=$LOGIN_PASSWORD" \
  "$BASE_URL/auth/login" > /dev/null || fail "login failed"

printf '{"message":"crash recovery long request"}' > "$LONG_REQUEST_BODY"
curl --silent --show-error --max-time 600 \
  -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  --data-binary @"$LONG_REQUEST_BODY" \
  "$BASE_URL/api/chat" > /dev/null 2>&1 &
REQUEST_PID=$!

sleep 2
MAIN_PID="$(systemctl show -p MainPID --value "$SERVICE_NAME")"
[[ "$MAIN_PID" =~ ^[1-9][0-9]*$ ]] || fail "could not determine service MainPID"
sudo kill -9 "$MAIN_PID" || fail "failed to kill service MainPID"

for _ in $(seq 1 30); do
  if systemctl is-active --quiet "$SERVICE_NAME" && curl --fail --silent --show-error --max-time 5 "$BASE_URL/api/health" > /dev/null; then
    break
  fi
  sleep 1
done
systemctl is-active --quiet "$SERVICE_NAME" || fail "service did not restart"
curl --fail --silent --show-error --max-time 10 "$BASE_URL/api/health" > /dev/null || fail "health did not recover"

curl --fail --silent --show-error --max-time 30 \
  -b "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  --data '{"message":"post-crash recovery request"}' \
  "$BASE_URL/api/chat" > /dev/null || fail "post-crash chat request failed"

RESTARTS="$(systemctl show -p NRestarts --value "$SERVICE_NAME")"
echo "NRestarts: $RESTARTS"

python3 - "$DB_PATH" <<'PY'
import sqlite3
import sys

path = sys.argv[1]
connection = sqlite3.connect(path)
try:
    result = connection.execute("PRAGMA integrity_check").fetchone()[0]
finally:
    connection.close()
if result != "ok":
    print(f"ERROR: PRAGMA integrity_check returned {result}", file=sys.stderr)
    raise SystemExit(1)
print("SQLite integrity_check: ok")
PY

kill "$REQUEST_PID" 2>/dev/null || true
echo "Crash recovery check passed"
