#!/usr/bin/env bash
# Runs the full validation suite for all three projects and the persistence check.
set -u
cd "$(dirname "$0")/.."   # repo root
echo "=============================================="
echo " Arrowstack Internship - validation suite"
echo " $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "=============================================="
node project-1-b2b-order-management/test/run.js; P1=$?
echo
node project-2-employee-service-requests/test/run.js; P2=$?
echo
node project-3-subscription-analytics/test/run.js; P3=$?
echo
node test/persistence.js; P4=$?
echo
echo "----------------------------------------------"
echo "Exit codes: P1=$P1 P2=$P2 P3=$P3 persistence=$P4"
if [ $P1 -eq 0 ] && [ $P2 -eq 0 ] && [ $P3 -eq 0 ] && [ $P4 -eq 0 ]; then echo "RESULT: ALL GREEN"; else echo "RESULT: FAILURES PRESENT"; fi
