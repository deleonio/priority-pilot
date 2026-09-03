#!/usr/bin/env bash
# Unit-Tests für ZAI Zeitfenster-Logik (Issue #893)
# Testet: Peak-Fenster Mo–Fr 14:00–18:00 Asia/Singapore, Provider-Override, Logik.
# Singapore-Zeit ist UTC+8 ohne DST — dadurch deckt der Test Sommer- UND Winterfall
# des Berliner Fensters (08:00–12:00 MESZ / 07:00–11:00 MEZ) implizit ab.

set -euo pipefail

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local name="$1"
  local sgt_hour="$2"
  local sgt_dow="$3" # 1=Mo … 7=So
  local provider="$4"
  local expected_override="$5"

  SGT_HOUR="$sgt_hour"
  SGT_DOW="$sgt_dow"
  PROVIDER="$provider"

  # Logik aus setup-agent action.yml replizieren
  time_window_override="false"
  if [ "$PROVIDER" = "zai" ]; then
    if [ "$SGT_DOW" -le 5 ] && [ "$SGT_HOUR" -ge 14 ] && [ "$SGT_HOUR" -le 17 ]; then
      time_window_override="true"
    fi
  fi

  if [ "$time_window_override" = "$expected_override" ]; then
    echo "✓ PASS: $name (SGT hour=$sgt_hour, dow=$sgt_dow, provider=$provider → override=$time_window_override)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "✗ FAIL: $name (SGT hour=$sgt_hour, dow=$sgt_dow, provider=$provider → expected=$expected_override, got=$time_window_override)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

echo "=== ZAI Zeitfenster-Tests (Issue #893: Mo–Fr 14:00–18:00 Asia/Singapore) ==="
echo ""

# Peak-Fenster unter der Woche (14:00–17:59 SGT = Override aktiv)
run_test "Dienstag 14:00 Uhr SGT, ZAI" "14" "2" "zai" "true"
run_test "Mittwoch 15:00 Uhr SGT, ZAI" "15" "3" "zai" "true"
run_test "Donnerstag 16:00 Uhr SGT, ZAI" "16" "4" "zai" "true"
run_test "Freitag 17:00 Uhr SGT, ZAI" "17" "5" "zai" "true"

# Außerhalb Peak (unter der Woche)
run_test "Montag 13:00 Uhr SGT, ZAI" "13" "1" "zai" "false"
run_test "Montag 18:00 Uhr SGT, ZAI" "18" "1" "zai" "false"
run_test "Mittwoch 05:00 Uhr SGT, ZAI" "05" "3" "zai" "false"
run_test "Mitternacht SGT, ZAI" "00" "2" "zai" "false"

# Wochenende: ganztägig Off-Peak — KEIN Override, auch mittags
run_test "Samstag 14:00 Uhr SGT, ZAI" "14" "6" "zai" "false"
run_test "Samstag 17:00 Uhr SGT, ZAI" "17" "6" "zai" "false"
run_test "Sonntag 15:00 Uhr SGT, ZAI" "15" "7" "zai" "false"
run_test "Sonntag 10:00 Uhr SGT, ZAI" "10" "7" "zai" "false"

# Nicht-ZAI Provider (nie Override)
run_test "Dienstag 14:00 Uhr SGT, claude" "14" "2" "claude" "false"
run_test "Dienstag 14:00 Uhr SGT, openrouter" "14" "2" "openrouter" "false"
run_test "Dienstag 14:00 Uhr SGT, unbekannt" "14" "2" "unbekannt" "false"

# Grenzfälle
run_test "Grenze 13:59 Uhr SGT (nicht im Fenster), ZAI" "13" "2" "zai" "false"
run_test "Grenze 18:00 Uhr SGT (nicht im Fenster), ZAI" "18" "5" "zai" "false"
run_test "Grenze Freitag 23:00 Uhr SGT, ZAI" "23" "5" "zai" "false"
run_test "Grenze Samstag 00:00 Uhr SGT, ZAI" "00" "6" "zai" "false"

echo ""
echo "=== Ergebnis: $TESTS_PASSED passed, $TESTS_FAILED failed ==="

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
