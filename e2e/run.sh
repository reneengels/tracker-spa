#!/bin/sh
# Ticket 15: bring up the isolated E2E stack, run the Playwright suite,
# always tear down afterward (even on failure), and exit with the suite's
# actual exit code.
#
# Deliberately staged rather than one `docker compose up`: `--wait` (used
# to block until long-running services are genuinely healthy before
# proceeding) treats a one-shot service's exit — even a successful one,
# like `migrate`/`seed` completing — as a failure, since it never reaches
# a "running" state. So long-running services get `--wait`; one-shot
# services run via `docker compose run` (no `--rm` on the ones a later
# service depends on via `condition: service_completed_successfully` —
# that check needs the exited container to still exist to inspect).
set -u
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f ../tracker-api/docker-compose.yml -f e2e/docker-compose.e2e.yml -p tracker-e2e"

cleanup() {
    $COMPOSE down -v
}
trap cleanup EXIT

$COMPOSE up -d --build --wait --remove-orphans db pgbouncer
status=$?
if [ "$status" -ne 0 ]; then
    echo "db/pgbouncer failed to come up (exit $status)"
    exit "$status"
fi

$COMPOSE run migrate
status=$?
if [ "$status" -ne 0 ]; then
    echo "migrate failed (exit $status)"
    exit "$status"
fi

$COMPOSE up -d --wait api mcp
status=$?
if [ "$status" -ne 0 ]; then
    echo "api/mcp failed to come up (exit $status)"
    exit "$status"
fi

$COMPOSE run seed
status=$?
if [ "$status" -ne 0 ]; then
    echo "seed failed (exit $status)"
    exit "$status"
fi

$COMPOSE run --rm playwright
exit $?
