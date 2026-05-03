#!/usr/bin/env bash
# End-to-end smoke test against a running server on 127.0.0.1:8765.
# Exercises auth, project + member RBAC, tasks, status updates, dashboard.
set -euo pipefail

BASE="http://127.0.0.1:8765/api"
JQ() { python -c "import json,sys; d=json.load(sys.stdin); k=sys.argv[1].split('.'); v=d
for p in k:
 v=v[int(p)] if p.isdigit() else v[p]
print(v if isinstance(v,(str,int,float)) else json.dumps(v))" "$1"; }

say() { printf "\n=== %s ===\n" "$*"; }

say "health"
curl -sf "$BASE/health"; echo

say "signup admin (alice)"
ALICE=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","full_name":"Alice","password":"password123"}')
echo "$ALICE"
ALICE_TOKEN=$(echo "$ALICE" | JQ access_token)
ALICE_ID=$(echo "$ALICE"   | JQ user.id)

say "signup member (bob)"
BOB=$(curl -sf -X POST "$BASE/auth/signup" -H "Content-Type: application/json" \
  -d '{"email":"bob@example.com","full_name":"Bob","password":"password123"}')
BOB_TOKEN=$(echo "$BOB" | JQ access_token)
BOB_ID=$(echo "$BOB"   | JQ user.id)

say "alice creates project"
PROJ=$(curl -sf -X POST "$BASE/projects" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"name":"Launch Plan","description":"Q3 launch"}')
echo "$PROJ"
PID=$(echo "$PROJ" | JQ id)

say "bob lists projects (should be empty)"
curl -sf "$BASE/projects" -H "Authorization: Bearer $BOB_TOKEN"; echo

say "bob tries to view alice's project (should 403)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects/$PID" -H "Authorization: Bearer $BOB_TOKEN")
echo "status=$code"; [ "$code" = "403" ]

say "alice adds bob as member"
curl -sf -X POST "$BASE/projects/$PID/members" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"email":"bob@example.com","role":"MEMBER"}'; echo

say "bob tries to create a task (should 403, members can't create tasks)"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/projects/$PID/tasks" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BOB_TOKEN" \
  -d '{"title":"sneaky"}')
echo "status=$code"; [ "$code" = "403" ]

say "alice creates task assigned to bob"
TASK=$(curl -sf -X POST "$BASE/projects/$PID/tasks" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ALICE_TOKEN" \
  -d "{\"title\":\"Write copy\",\"description\":\"Landing page\",\"priority\":\"HIGH\",\"assignee_id\":$BOB_ID,\"due_date\":\"2020-01-01T00:00:00Z\"}")
echo "$TASK"
TID=$(echo "$TASK" | JQ id)

say "bob lists project tasks (should see his task)"
curl -sf "$BASE/projects/$PID/tasks" -H "Authorization: Bearer $BOB_TOKEN"; echo

say "bob updates task status to IN_PROGRESS"
curl -sf -X PATCH "$BASE/tasks/$TID/status" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BOB_TOKEN" -d '{"status":"IN_PROGRESS"}'; echo

say "bob tries to edit task title (should 403)"
code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/tasks/$TID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BOB_TOKEN" \
  -d '{"title":"hijacked"}')
echo "status=$code"; [ "$code" = "403" ]

say "bob's dashboard (overdue should be 1)"
curl -sf "$BASE/dashboard" -H "Authorization: Bearer $BOB_TOKEN"; echo

say "alice's project stats"
curl -sf "$BASE/projects/$PID/stats" -H "Authorization: Bearer $ALICE_TOKEN"; echo

say "alice tries to demote herself (only admin → 400)"
code=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH "$BASE/projects/$PID/members/$ALICE_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $ALICE_TOKEN" \
  -d '{"role":"MEMBER"}')
echo "status=$code"; [ "$code" = "400" ]

say "alice deletes project"
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/projects/$PID" \
  -H "Authorization: Bearer $ALICE_TOKEN")
echo "status=$code"; [ "$code" = "204" ]

echo
echo "ALL CHECKS PASSED"
