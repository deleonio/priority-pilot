#!/usr/bin/env bash
# Atomare Label-Transition für die PR-Pipeline-Labels (ai:*).
#
# WARUM: Bislang schrieben Review/Fixup/Gate/Conflict-Scan/Autolabeler ihre Labels
# in EINZELNEN gh-pr-edit-Aufrufen (bis zu 4× remove + 1× add). Daraus entstehen
# zwei belegte Fehlerklassen:
#   1. Zwischenzustände: Kurzzeitig kleben 0 oder 2 Trigger-Labels am PR. Ein in
#      der Phasen-Queue wartender Lauf sieht im Precheck genau diesen Zustand und
#      startet falsch — bis hin zu Review parallel zum Fixup (PR #890, 18.08.2026).
#   2. Invarianten-Drift: Jeder Writer muss selbst daran denken, ai:needs-review
#      zu entfernen, wenn er ai:needs-fixup setzt. claude-pr-conflict-scan.yml
#      tat das nicht → beide Trigger gleichzeitig am PR.
# Dieses Skript ersetzt den GESAMTEN Pipeline-Label-Bestand in EINEM API-Call
# (PUT /issues/N/labels): Der Zielzustand ist immer wohlgeformt (höchstens ein
# ai:needs-*-Trigger), und „setzt ai:needs-fixup ⇒ ai:needs-review weg" gilt per
# Konstruktion. Nicht-Pipeline-Labels (bug, enhancement, release:* …) bleiben
# unangetastet. Zwei konkurrierende Transitions können sich nicht mehr zu einem
# Doppel-Trigger mischen — letzter Write gewinnt als ganzer Zustand.
#
# PRE-STATE-GUARD (--expect/--forbid): Der Aufrufer beschreibt den Label-Zustand,
# den er VORHERSICHTET (z. B. "--expect none" nach Start-Konsum des eigenen
# Triggers). Hat zwischenzeitlich ein anderer Akteur geschrieben, wird DIESE
# Transition verworfen (applied=false, Exit 0) — ein alter Lauf überschreibt
# dann keine neuere Entscheidung mehr (Stale-Write-Race im Minuten-Fenster
# zwischen Precheck und Label-Write).
#
# Bash (kein .ts): reine gh-/jq-Wrapper-Logik, analog check-phase-label.sh —
# lokal gegen echte PRs ausführbar und damit belegbar:
#   bash .github/scripts/label-transition.sh --repo o/r --pr 42 \
#         --set ai:needs-fixup --forbid ai:needs-fixup --dry-run
#
# Managed-Bestand (das, was dieses Skript ersetzt): die vier PR-Pipeline-Labels.
# ai:documented bleibt bewusst draußen — das setzt nur Phase 7 am gemergten PR;
# ein Lauf auf einem offenen PR darf es nie entfernen.
#
# Usage:
#   bash label-transition.sh --repo <owner/repo> --pr <N> \
#         (--set <label[,label…]> | --set-none) \
#         [--expect <label[,label…]|none|any>]   # default: any (kein Guard)
#         [--forbid <label[,label…]>]            # verwirft, wenn eins davon bereits klebt
#         [--dry-run]
#
# Ausgabe (stdout, key=value):
#   applied=true|false
#   state=ok|read-failed|put-failed
#   reason=<Klartext, nur wenn nicht angewendet>   # einzeilig, CR/LF gestrippt
#   labels=<Ziel-Bestand, Komma-liste>             # der Zustand nach angewandter Transition
#
# Exit-Codes: 0 = normal (auch Guard-Abbruch: applied=false); 1 = PUT nach 3
# Versuchen endgültig fehlgeschlagen (Aufrufer eskaliert, z. B. needs-human);
# 2 = Konfigurationsfehler (unbekannte Ziel-Labels, fehlende Argumente) — bewusst
# hart wie der unbekannte Phasen-Name in check-phase-label.sh: ein Tippfehler im
# Workflow soll auffallen, nicht still ein Gate aushebeln.

set -uo pipefail

REPO=""
PR=""
SET=""
SET_NONE="false"
EXPECT="any"
FORBID=""
DRY_RUN="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --pr) PR="$2"; shift 2 ;;
    --set) SET="$2"; shift 2 ;;
    --set-none) SET_NONE="true"; shift ;;
    --expect) EXPECT="$2"; shift 2 ;;
    --forbid) FORBID="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    *) echo "label-transition: unbekannte Option '$1'" >&2; exit 2 ;;
  esac
done
[ -n "$REPO" ] || { echo "label-transition: --repo required" >&2; exit 2; }
[ -n "$PR" ] || { echo "label-transition: --pr required" >&2; exit 2; }
if [ "$SET_NONE" = "true" ] && [ -n "$SET" ]; then
  echo "label-transition: --set und --set-none sind exklusiv" >&2; exit 2
fi
if [ "$SET_NONE" != "true" ] && [ -z "$SET" ]; then
  echo "label-transition: --set <labels> oder --set-none required" >&2; exit 2
fi

# Der Bestand, den Transitions verwalten. Reihenfolge = kanonische Anlege-Reihenfolge.
MANAGED=(ai:needs-review ai:needs-fixup ai:reviewed ai:needs-human)
# Anlege-Definitionen (nur relevant auf frischen Repos; bestehende Labels bleiben
# unangetastet — gleiche Farben wie bisher in den Workflows gepflegt).
create_label() {
  case "$1" in
    ai:needs-review) gh label create "$1" --repo "$REPO" --color 1D76DB --description "PR wartet auf den Kreuzverhoer-Review" 2>/dev/null || true ;;
    ai:needs-fixup)  gh label create "$1" --repo "$REPO" --color D93F0B --description "CI/Reviewer rot oder Findings offen -> Fixup" 2>/dev/null || true ;;
    ai:reviewed)     gh label create "$1" --repo "$REPO" --color 0E8A16 2>/dev/null || true ;;
    ai:needs-human)  gh label create "$1" --repo "$REPO" --color 5319e7 --description "Nicht-automatisierbare Entscheidung — wartet auf Mensch (Fixup greift bewusst nicht)" 2>/dev/null || true ;;
  esac
}

in_list() { # $1=Nadel, $2..=Heuhaufen. local ist Pflicht: ohne würde der Schleifen-
  # Variablen-Name des Aufrufers (while-read-Schleifen nutzen ebenfalls l) vom
  # Heuhaufen-Durchlauf überschrieben — trockengelegt per Dry-Run-Beleg (falsche
  # Label-Namen in Fehlermeldung und Validierung).
  local needle="$1"; shift
  local item
  for item in ${@+"$@"}; do [ "$item" = "$needle" ] && return 0; done
  return 1
}

split_list() { # $1="a,b,c" → stdout: eine Zeile pro Element (leer-safe)
  [ -n "$1" ] || return 0
  printf '%s' "$1" | tr ',' '\n'
}

norm() { # args: Labels → sortierter, einzeiliger Komma-String (Vergleichs-Normalform)
  printf '%s\n' ${@+"$@"} | sort | paste -sd, -
}

# Ziel-Labels validieren: Transitierbar sind NUR Pipeline-Labels — alles andere
# würde dauerhaft kleben, weil jede spätere Transition den Bestand komplett ersetzt.
TARGET=()
if [ "$SET_NONE" = "true" ]; then
  :
else
  while IFS= read -r l; do
    [ -n "$l" ] || continue
    if ! in_list "$l" ${MANAGED[@]+"${MANAGED[@]}"}; then
      echo "label-transition: Ziel-Label '$l' ist kein Pipeline-Label (${MANAGED[*]})" >&2
      exit 2
    fi
    in_list "$l" ${TARGET[@]+"${TARGET[@]}"} || TARGET+=("$l")
  done <<EOF
$(split_list "$SET")
EOF
fi
FORBID_LIST=()
while IFS= read -r l; do
  [ -n "$l" ] || continue
  if ! in_list "$l" ${MANAGED[@]+"${MANAGED[@]}"}; then
    echo "label-transition: --forbid-Label '$l' ist kein Pipeline-Label" >&2; exit 2
  fi
  FORBID_LIST+=("$l")
done <<EOF
$(split_list "$FORBID")
EOF
EXPECT_LIST=()
if [ "$EXPECT" != "any" ] && [ "$EXPECT" != "none" ]; then
  while IFS= read -r l; do
    [ -n "$l" ] || continue
    if ! in_list "$l" ${MANAGED[@]+"${MANAGED[@]}"}; then
      echo "label-transition: --expect-Label '$l' ist kein Pipeline-Label" >&2; exit 2
    fi
    EXPECT_LIST+=("$l")
  done <<EOF
$(split_list "$EXPECT")
EOF
fi

out() { # $1=applied, $2=state, $3=reason
  echo "applied=$1"
  echo "state=$2"
  # reason einzeilig halten (Label-Namen aus der API, zweite Leine gegen
  # Output-Key-Injektion — gleiche Technik wie check-phase-label.sh).
  if [ -n "${3:-}" ]; then
    printf 'reason=%s\n' "$(printf '%s' "$3" | tr -d '\n\r')"
  fi
}

# IST-Zustand in EINEM API-Aufruf. Lesefehler = KEIN hartes Fail (Exit 0,
# state=read-failed): Der Aufrufer entscheidet fail-open (Konsum-Step: Phase
# läuft, Label bleibt unkonsumiert) bzw. fail-closed (Final-Write: Eskalation).
DATA="$(gh pr view "$PR" --repo "$REPO" --json labels 2>/dev/null)"
if [ -z "$DATA" ]; then
  out false read-failed "gh pr view fehlgeschlagen — IST-Zustand unbekannt, nichts geschrieben"
  exit 0
fi

CURRENT_ALL=()
while IFS= read -r l; do
  [ -n "$l" ] && CURRENT_ALL+=("$l")
done < <(printf '%s' "$DATA" | jq -r '.labels[].name? // empty')

CURRENT_MANAGED=()
PRESERVED=()
for l in ${CURRENT_ALL[@]+"${CURRENT_ALL[@]}"}; do
  if in_list "$l" ${MANAGED[@]+"${MANAGED[@]}"}; then
    CURRENT_MANAGED+=("$l")
  else
    PRESERVED+=("$l")
  fi
done

# Guard 1 — --forbid: gezielte Ausnahme von --expect für „nicht stören, wenn der
# Loop schon läuft/steht" (Oszillationsschutz des Gates).
for l in ${FORBID_LIST[@]+"${FORBID_LIST[@]}"}; do
  if in_list "$l" ${CURRENT_MANAGED[@]+"${CURRENT_MANAGED[@]}"}; then
    out false ok "Label '$l' bereits vorhanden — Transition verworfen"
    exit 0
  fi
done

# Guard 2 — --expect: exakter Soll-Ist-Vergleich des Managed-Bestands.
if [ "$EXPECT" != "any" ]; then
  want="$(norm ${EXPECT_LIST[@]+"${EXPECT_LIST[@]}"})"
  is="$(norm ${CURRENT_MANAGED[@]+"${CURRENT_MANAGED[@]}"})"
  if [ "$want" != "$is" ]; then
    out false ok "Pre-State geändert: erwartet '${want:-leer}', Ist '${is:-leer}' — neuere Entscheidung regiert, kein Write"
    exit 0
  fi
fi

NEW=("${PRESERVED[@]+"${PRESERVED[@]}"}" ${TARGET[@]+"${TARGET[@]}"})
LABELS_OUT="$(norm ${NEW[@]+"${NEW[@]}"})"

if [ "$DRY_RUN" = "true" ]; then
  out true ok ""
  echo "labels=${LABELS_OUT}"
  echo "dryrun=true"
  exit 0
fi

# Ziel-Labels ggf. anlegen (nur die aus --set; PUT mit unbekanntem Namen würde
# sonst ein Standardfarben-Label erzeugen bzw. je nach API-Version 422 liefern).
for l in ${TARGET[@]+"${TARGET[@]}"}; do create_label "$l"; done

# EIN atomarer Write: PUT ersetzt den kompletten Label-Bestand durch NEW —
# Zwischenzustände mit 0/2 Triggern existieren nicht, Nicht-Pipeline-Labels
# bleiben erhalten (GitHub feuert pro Differenz ein labeled-/unlabeled-Event,
# die Folge-Workflows funktionieren unverändert).
# Mit Retry (Issue #613): Backoff 1s, 2s, 4s (max. 3).
TARGET_JSON="$(printf '%s\n' ${NEW[@]+"${NEW[@]}"} | jq -R . | jq -s .)"
for attempt in 1 2 3; do
  if printf '{"labels":%s}' "$TARGET_JSON" \
     | gh api --method PUT "repos/$REPO/issues/$PR/labels" --input - >/dev/null 2>&1; then
    out true ok ""
    echo "labels=${LABELS_OUT}"
    exit 0
  fi
  [ "$attempt" -lt 3 ] && sleep "$((2 ** (attempt - 1)))"
done
out false put-failed "PUT /issues/$PR/labels nach 3 Versuchen fehlgeschlagen"
exit 1
