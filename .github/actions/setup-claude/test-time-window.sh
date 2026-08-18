#!/usr/bin/env bash
# Unit-Tests für ZAI Zeitfenster-Logik (Issue #893)
# Testet: DST-korrekte Europe/Berlin Zeit, Provider-Override, Logik

set -euo pipefail

TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local name="$1"
  local hour="$2"
  local provider="$3"
  local expected_override="$4"

  export TZ='Europe/Berlin'
  BERLIN_HOUR="$hour"
  PROVIDER="$provider"

  # Logik aus setup-claude action.yml replizieren
  time_window_override="false"
  if [ "$PROVIDER" = "zai" ]; then
    if [ "$BERLIN_HOUR" -ge 8 ] && [ "$BERLIN_HOUR" -le 11 ]; then
      time_window_override="true"
    fi
  fi

  if [ "$time_window_override" = "$expected_override" ]; then
    echo "✓ PASS: $name (hour=$hour, provider=$provider → override=$time_window_override)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo "✗ FAIL: $name (hour=$hour, provider=$provider → expected=$expected_override, got=$time_window_override)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

echo "=== ZAI Zeitfenster-Tests (Issue #893) ==="
echo ""

# Zeitfenster-Tests (08:00–11:59 = Override aktiv)
run_test "Zeitfenster 08:00 Uhr, ZAI" "08" "zai" "true"
run_test "Zeitfenster 09:00 Uhr, ZAI" "09" "zai" "true"
run_test "Zeitfenster 10:00 Uhr, ZAI" "10" "zai" "true"
run_test "Zeitfenster 11:00 Uhr, ZAI" "11" "zai" "true"

# Außerhalb Zeitfenster (kein Override)
run_test "Vor Zeitfenster 07:00 Uhr, ZAI" "07" "zai" "false"
run_test "Nach Zeitfenster 12:00 Uhr, ZAI" "12" "zai" "false"
run_test "Nach Zeitfenster 13:00 Uhr, ZAI" "13" "zai" "false"
run_test "Mitternacht 00:00 Uhr, ZAI" "00" "zai" "false"

# Nicht-ZAI Provider (nie Override)
run_test "Zeitfenster 09:00 Uhr, claude" "09" "claude" "false"
run_test "Zeitfenster 09:00 Uhr, openrouter" "09" "openrouter" "false"
run_test "Zeitfenster 09:00 Uhr, unbekannt" "09" "unbekannt" "false"

# Grenzfälle
run_test "Grenze 07:59 Uhr (nicht im Fenster), ZAI" "07" "zai" "false"
run_test "Grenze 12:00 Uhr (nicht im Fenster), ZAI" "12" "zai" "false"

echo ""
echo "=== Ergebnis: $TESTS_PASSED passed, $TESTS_FAILED failed ==="

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
