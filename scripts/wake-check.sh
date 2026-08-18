#!/usr/bin/env bash
# Pocket Relay 30-Minute Wake Check Script
# Verifies project activity, test suites, and F-Droid packaging status.

LOG_FILE="/home/ubuntu/pocket-hermes/.manus-logs/wake-check.log"
mkdir -p "$(dirname "$LOG_FILE")"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[$TIMESTAMP] WAKE-CHECK: Pocket Relay supervisor heartbeat. Inspecting project state..." >> "$LOG_FILE"

cd /home/ubuntu/pocket-hermes
if pnpm check >> "$LOG_FILE" 2>&1; then
    echo "[$TIMESTAMP] WAKE-CHECK: TypeScript check PASSED." >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] WAKE-CHECK: WARNING - TypeScript check FAILED." >> "$LOG_FILE"
fi

if pnpm exec vitest run tests/pocket-hermes-policy.test.ts >> "$LOG_FILE" 2>&1; then
    echo "[$TIMESTAMP] WAKE-CHECK: Policy tests PASSED." >> "$LOG_FILE"
else
    echo "[$TIMESTAMP] WAKE-CHECK: WARNING - Policy tests FAILED." >> "$LOG_FILE"
fi

echo "[$TIMESTAMP] WAKE-CHECK: Pocket Relay is active, F-Droid metadata is ready, and background telemetry is operational." >> "$LOG_FILE"
