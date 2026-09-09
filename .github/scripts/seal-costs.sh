#!/usr/bin/env bash
# Siegel-Lauf für die Kosten-Datensätze eines Tickets. Aufrufer: der Documenter-Workflow
# (.github/workflows/06-document.yml) — einmal im Documenter-Job nach der
# Kostenerfassung (eigener Eintrag mit versiegelt), einmal als eigenständiger Catch-up-Job
# für nachgezogene Siegel, wenn der erste Versuch fehlschlug.
#
# Ablauf: alle nicht-abgelaufenen claude-costs-*-issue-<n>-* Artefakte laden → mit der
# Bestandsdatei .costs/<n>.json im Checkout mergen (cost-seal.ts, idempotent) → bei
# Änderung über die Contents-API auf main committen.
#
# WARUM CONTENTS-API STATT GIT PUSH (gelernt aus dem ersten Live-Lauf, PR #987): main
# bewegt sich zwischen Checkout und Seal (Release-Läufe feuern Sekunden nach dem Merge),
# ein direkter Push ist also regelmässig non-fast-forward. Die Contents-API committet
# server-seitig atomar auf dem JEWEILIGEN main-Tip — kein Fetch/Rebase/Push-Rennen, kein
# App-Token in einer URL (Fehlermeldungen können nichts leaken) und die Commits tragen
# automatisch die Bot-Identität der App-Installation.
#
# NIE FATAL: Jeder Fehlschlag verwirnt sichtbar und lässt den Aufrufer grün — die
# Artefakte leben 90 Tage, der Catch-up-Job holt nach.
#
# Benötigte Umgebung: GH_TOKEN (App-Token mit Contents:Write UND Actions:Read — der
# Artefakt-Abruf läuft über dasselbe Token), node und unzip im PATH.
# Aufruf: seal-costs.sh --repo <owner/repo> --issue <n>

set -uo pipefail

repo='' issue=''
while [ $# -gt 0 ]; do
	case "$1" in
		--repo) repo="$2"; shift 2 ;;
		--issue) issue="$2"; shift 2 ;;
		*) echo "seal-costs: unbekanntes Argument: $1" >&2; exit 2 ;;
	esac
done
if [ -z "$repo" ] || [ -z "$issue" ]; then
	echo "seal-costs: --repo und --issue erforderlich" >&2
	exit 2
fi
# Die Nummer fliesst in API-Pfade und Dateinamen — nur Ziffern zulassen.
if ! printf '%s' "$issue" | grep -Eq '^[0-9]+$'; then
	echo "::error title=Versiegeln::Ticket-Nummer '${issue}' ist keine reine Zahl."
	exit 2
fi

# ─── Artefakte laden ──────────────────────────────────────────────────────────
# Gemeinsamer Helfer mit track-costs.yml. Schlägt der Listen-Abruf fehl (z. B. Installation
# ohne „Actions: lesen" → 403, Exit 3), darf das NICHT als „Liste leer = nichts gemessen =
# bereits vollständig" durchgehen — der Seal würde lautlos nichts committen. Der Helfer
# verwarnt sichtbar; hier bleibt der Lauf grün (NIE FATAL), der Catch-up-Job holt nach.
script_dir="$(cd "$(dirname "$0")" && pwd)"
if ! FETCH="$("${script_dir}/fetch-cost-artifacts.sh" --repo "$repo" --issue "$issue" --dest /tmp/costs)"; then
	printf '%s\n' "$FETCH"
	echo "::warning title=Versiegeln::Artefakte nicht abrufbar — kein Seal in diesem Lauf, Catch-up möglich."
	exit 0
fi
printf '%s\n' "$FETCH"
count="$(printf '%s' "$FETCH" | sed -n 's/^count=\([0-9]*\).*/\1/p' | tail -1)"
echo "::notice title=Kosten-Artefakte::${count:-0} Artefakt(e) für #${issue} geladen."

# ─── Mergen (idempotent) ──────────────────────────────────────────────────────
OUT="$(node "${script_dir}/cost-seal.ts" --issue "$issue" --dir /tmp/costs 2>&1 || true)"
printf '%s\n' "$OUT"
# Drei Ausgänge VOR dem Commit — alle bewusst grün (NIE FATAL), aber mit dem PASSENDEN
# Signal statt pauschal „bereits vollständig":
#   1. secretFindings>0 — Secret-Verdacht im gemergten Datensatz: nicht committen.
#   2. changed=false — Bestand vollständig: legitimes „nichts zu tun".
#   3. keine changed=-Marke — Skript gecrasht: Crash nicht als „fertig" missdeuten.
if printf '%s' "$OUT" | grep -q 'secretFindings=[1-9]'; then
	echo "::warning title=Versiegeln::Secret-Verdacht im gemergten Datensatz — .costs/${issue}.json NICHT committet (Treffer s. secret-match-Zeilen)."
	exit 0
fi
if printf '%s' "$OUT" | grep -q 'changed=false'; then
	echo "::notice title=Versiegeln::.costs/${issue}.json bereits vollständig — kein Commit."
	exit 0
fi
if ! printf '%s' "$OUT" | grep -q 'changed=true'; then
	echo "::warning title=Versiegeln::Seal-Skript ohne changed=-Ergebnis (Crash?) — kein Commit: $(printf '%s' "$OUT" | tail -n 3 | tr '\n' ' ')"
	exit 0
fi

# ─── Über die Contents-API auf main committen ─────────────────────────────────
# Update braucht die aktuelle Blob-SHA der Datei; ein Konflikt (409, parallel
# committeter Seal) wird EINMAL nach dem Neu-Abruf wiederholt.
upload_seal() {
	local sha
	sha="$(gh api "repos/${repo}/contents/.costs/${issue}.json?ref=main" --jq .sha 2>/dev/null || true)"
	if [ -n "$sha" ]; then
		gh api -X PUT "repos/${repo}/contents/.costs/${issue}.json" \
			-f message="chore(costs): Ticket #${issue} versiegelt [skip ci]" \
			-f content="$(base64 < ".costs/${issue}.json" | tr -d '\n')" \
			-f sha="$sha" -f branch=main
	else
		gh api -X PUT "repos/${repo}/contents/.costs/${issue}.json" \
			-f message="chore(costs): Ticket #${issue} versiegelt [skip ci]" \
			-f content="$(base64 < ".costs/${issue}.json" | tr -d '\n')" \
			-f branch=main
	fi
}
if upload_seal 2>/tmp/seal-upload.err; then
	echo "::notice title=✅ Versiegelt::.costs/${issue}.json auf main committet."
else
	if upload_seal 2>>/tmp/seal-upload.err; then
		echo "::notice title=✅ Versiegelt::.costs/${issue}.json auf main committet (nach Konflikt-Wiederholung)."
	else
		echo "::warning title=Versiegeln fehlgeschlagen::Contents-API lehnte ab: $(tail -n 3 /tmp/seal-upload.err | tr '\n' ' ') — Datensatz bleibt in den Artefakten (90 Tage), Catch-up holt nach."
	fi
fi
exit 0
