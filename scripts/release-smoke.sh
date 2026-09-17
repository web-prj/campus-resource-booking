#!/usr/bin/env bash
set -euo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:18321}"
API_URL="${API_URL:-http://localhost:18320/api}"
DEMO_PASSWORD="${DEMO_PASSWORD:-}"
COOKIE_FILE="$(mktemp)"
trap 'rm -f "$COOKIE_FILE"' EXIT

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
check_status() {
  local expected="$1"; shift
  local actual
  actual="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$@")"
  [[ "$actual" == "$expected" ]] || fail "expected HTTP $expected, received $actual: $*"
}

printf 'Checking service health...\n'
check_status 200 "$API_URL/health"
check_status 200 "$FRONTEND_URL/"
check_status 401 "$API_URL/auth/me"
check_status 401 "$API_URL/admin/users"
check_status 401 "$API_URL/staff/bookings/pending"
check_status 401 "$API_URL/bookings/mine"

if [[ -z "$DEMO_PASSWORD" ]]; then
  printf 'Public/protected endpoint smoke passed. Set DEMO_PASSWORD to test every role.\n'
  exit 0
fi

login() {
  local email="$1"
  local body
  body="$(node -e 'process.stdout.write(JSON.stringify({email:process.argv[1],password:process.argv[2]}))' "$email" "$DEMO_PASSWORD")"
  curl --fail --silent --show-error \
    --cookie-jar "$COOKIE_FILE" \
    --header 'Content-Type: application/json' \
    --data "$body" \
    "$API_URL/auth/login" >/dev/null
}

printf 'Checking student role...\n'
login demo.student@usth.edu.vn
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/auth/me"
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/resources?page=1&pageSize=1"
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/bookings/mine"
check_status 403 --cookie "$COOKIE_FILE" "$API_URL/admin/users"
check_status 403 --cookie "$COOKIE_FILE" "$API_URL/staff/bookings/pending"

printf 'Checking staff role...\n'
login demo.staff@usth.edu.vn
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/staff/bookings/pending"
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/staff/bookings/operations"
check_status 403 --cookie "$COOKIE_FILE" "$API_URL/admin/users"

printf 'Checking administrator role...\n'
login demo.admin@usth.edu.vn
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/admin/users?page=1&pageSize=1"
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/admin/resources"
check_status 200 --cookie "$COOKIE_FILE" "$API_URL/admin/analytics?from=2099-01-01&to=2099-01-30"
check_status 403 --cookie "$COOKIE_FILE" "$API_URL/staff/bookings/pending"

printf 'Release smoke passed for public, student, staff, and administrator routes.\n'
