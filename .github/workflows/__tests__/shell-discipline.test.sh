#!/bin/bash
# Rote Tests für Issue 595: Shell-Disciplin-Querschnitt
# Diese Tests müssen rot werden, wenn die Akzeptanzkriterien nicht erfüllt sind.
# Ausführung: bash .github/workflows/__tests__/shell-discipline.test.sh

set -euo pipefail

WORKFLOWS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

# AK 1.1 — jq-Null-Sicherheit: ?-Suffix oder | select(. != null)
test_jq_null_safety() {
  local violations=0
  local file

  echo "AK 1.1 — jq-Null-Sicherheit prüfen..."

  for file in "$WORKFLOWS_DIR"/*.yml; do
    # Feldzugriffe ohne ?-Suffix auf potentiel null-Feldern finden
    # .labels[], .closingIssuesReferences[], .commits[], .comments[], .workflow_runs[]
    # sind gute Kandidaten für null-Werte
    while IFS=: read -r lineno content; do
      if echo "$content" | grep -qE '\.(labels|closingIssuesReferences|commits|comments|workflow_runs|files|dependencies)\[\]' && echo "$content" | grep -q 'jq' && ! echo "$content" | grep -q '\?' && ! echo "$content" | grep -q 'select(. != null)' && ! echo "$content" | grep -q '#'; then
        echo "  ❌ $file:$lineno: jq-Feldzugriff ohne Null-Sicherung (?-Suffix oder select(. != null))"
        violations=$((violations + 1))
      fi
    done < <(grep -n 'jq' "$file" || true)
  done

  if [ "$violations" -gt 0 ]; then
    echo "  FAIL: $violations Verletzung(en) der jq-Null-Sicherheit gefunden"
    return 1
  else
    echo "  PASS: Alle jq-Feldzugriffe sind null-gesichert"
    return 0
  fi
}

# AK 1.2 — jq-Injection-Block: Keine $VAR-Interpolation in jq-Strings
test_jq_injection_block() {
  local violations=0
  local file
  local lineno
  local content

  echo "AK 1.2 — jq-Injection-Block prüfen..."

  for file in "$WORKFLOWS_DIR"/*.yml; do
    # Echte Injection-Vektoren: jq-Zeilen, die $REPO/$PR/etc. INNERHALB eines select() verwenden
    # ABER: --arg macht es sicher! Ausschließen: --arg in der Zeile
    while IFS=: read -r lineno content; do
      # Prüfen: select() mit $REPO/$PR/etc., aber OHNE --arg
      if echo "$content" | grep -q 'jq' && echo "$content" | grep -q 'select(' && echo "$content" | grep -qE '\$(REPO|PR|ISSUE|A|B|label|HEAD_BRANCH)' && ! echo "$content" | grep -q '\-\-arg'; then
        echo "  ❌ $file:$lineno: jq-Injection-Vektor (\$VAR innerhalb von select(), ohne --arg)"
        violations=$((violations + 1))
      fi
    done < <(grep -n 'jq' "$file" || true)
  done

  if [ "$violations" -gt 0 ]; then
    echo "  FAIL: $violations Injection-Vektor(en) gefunden"
    return 1
  else
    echo "  PASS: Keine jq-Injection-Vektoren"
    return 0
  fi
}

# AK 1.3 — BSD-kompatible grep/sed: Kein grep -P
test_bsd_compatibility() {
  local violations=0
  local file

  echo "AK 1.3 — BSD-Kompatibilität prüfen..."

  for file in "$WORKFLOWS_DIR"/*.yml; do
    if grep -nE 'grep\s+(-P|-oP)' "$file" | grep -v '#' > /dev/null; then
      echo "  ❌ $file: BSD-inkompatibles grep (-P/-oP) gefunden"
      violations=$((violations + 1))
    fi
  done

  if [ "$violations" -gt 0 ]; then
    echo "  FAIL: $violations BSD-inkompatible(r) grep-Aufruf(e)"
    return 1
  else
    echo "  PASS: Alle grep/sed sind BSD-kompatibel"
    return 0
  fi
}

# AK 1.4 — || true für legalen No-Match bei grep -vE
test_grep_vE_guard() {
  local violations=0
  local file
  local line

  echo "AK 1.4 — grep -vE mit || true prüfen..."

  for file in "$WORKFLOWS_DIR"/*.yml; do
    while IFS= read -r line; do
      local lineno
      lineno=$(echo "$line" | cut -d: -f1)
      local content
      content=$(echo "$line" | cut -d: -f2-)

      # grep -vE gefunden, prüfe auf || true oder || exit 0 am Zeilenende
      if echo "$content" | grep -qE 'grep\s+-vE'; then
        if ! echo "$content" | grep -qE '\|\|\s*(true|exit\s+0)'; then
          echo "  ❌ $file:$lineno: grep -vE ohne || true/|| exit 0"
          violations=$((violations + 1))
        fi
      fi
    done < <(grep -n 'grep -vE' "$file" || true)
  done

  if [ "$violations" -gt 0 ]; then
    echo "  FAIL: $violations grep -vE ohne No-Match-Schutz"
    return 1
  else
    echo "  PASS: Alle grep -vE sind gegen No-Match gesichert"
    return 0
  fi
}

# Hauptprogramm
main() {
  echo "=== Shell-Disciplin-Querschnitt Tests für Issue 595 ==="
  echo

  test_jq_null_safety || FAILURES=$((FAILURES + 1))
  test_jq_injection_block || FAILURES=$((FAILURES + 1))
  test_bsd_compatibility || FAILURES=$((FAILURES + 1))
  test_grep_vE_guard || FAILURES=$((FAILURES + 1))

  echo
  if [ "$FAILURES" -gt 0 ]; then
    echo "=== RESULT: $FAILURES Test(s) FAILED ==="
    exit 1
  else
    echo "=== RESULT: ALL TESTS PASSED ==="
    exit 0
  fi
}

main "$@"
