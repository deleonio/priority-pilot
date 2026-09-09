#!/usr/bin/env bash
# Lädt alle nicht-abgelaufenen Kosten-Artefakte EINES Tickets (claude-costs-<phase>-issue-<n>-<run>)
# in je einen eigenen Ordner unter --dest. Gemeinsamer Helfer für track-costs.yml (Bericht)
# und seal-costs.sh (Siegel) — vorher trugen beide eine Kopie derselben Schleife, und jede
# Kopie hatte nur die Hälfte der Fehlerbehandlung: track-costs verwarnte je nicht ladbarem
# Artefakt, schluckte aber einen Fehlschlag des Listen-Abrufs (`|| true`) als „keine
# Artefakte"; seal-costs prüfte den Listen-Abruf, übersprang ladbare Fehler aber still.
#
# WARUM DER LISTEN-ABRUF NICHT ALS „LEER" DURCHGEHEN DARF: Ein 403 (App-Token ohne
# Actions:Read), ein Rate-Limit oder ein 5xx liefern dieselbe leere Liste wie ein nie
# gemessenes Ticket. Der Aufrufer hätte „nichts gemessen = fertig" gemeldet — und der Seal
# hätte lautlos nichts committet. Deshalb: Listen-Fehler → Exit 3 mit Warnung, der Aufrufer
# entscheidet (Bericht: rot; Siegel: grün mit Catch-up).
#
# Der Filter verlangt `-issue-<n>-` mit beiden Bindestrichen: ein blosses `contains("912")`
# träfe auch Ticket 9120 und 1912 und mischte fremde Läufe unter. `--paginate` holt ALLE
# Seiten; ohne das fehlten bei einem aktiven Repo genau die älteren Phasen.
#
# Ausgabe (stdout, letzte Zeile): `count=<geladen> failed=<nicht ladbar>`.
# Exit: 0 = Liste abgerufen (auch wenn leer); 2 = Argumentfehler; 3 = Listen-Abruf fehlgeschlagen.
# Benötigte Umgebung: GH_TOKEN (mit Actions:Read), unzip im PATH.

set -uo pipefail

repo='' issue='' dest='/tmp/costs'
while [ $# -gt 0 ]; do
	case "$1" in
		--repo) repo="$2"; shift 2 ;;
		--issue) issue="$2"; shift 2 ;;
		--dest) dest="$2"; shift 2 ;;
		*) echo "fetch-cost-artifacts: unbekanntes Argument: $1" >&2; exit 2 ;;
	esac
done
if [ -z "$repo" ] || [ -z "$issue" ]; then
	echo "fetch-cost-artifacts: --repo und --issue erforderlich" >&2
	exit 2
fi
# Die Nummer fliesst in API-Pfade und Dateinamen — nur Ziffern zulassen.
if ! printf '%s' "$issue" | grep -Eq '^[0-9]+$'; then
	echo "::error title=Kosten-Artefakte::Ticket-Nummer '${issue}' ist keine reine Zahl."
	exit 2
fi

mkdir -p "$dest"
if ! LIST="$(gh api --paginate "repos/${repo}/actions/artifacts?per_page=100" \
	--jq ".artifacts[] | select(.expired == false) \
	      | select(.name | startswith(\"claude-costs-\") and contains(\"-issue-${issue}-\")) \
	      | [.id, .name] | @tsv")"; then
	echo "::warning title=Kosten-Artefakte::Artefakt-Liste für #${issue} nicht abrufbar (Token braucht Actions:Read, Rate-Limit?) — nicht mit „keine Artefakte“ verwechseln."
	echo "count=0 failed=0"
	exit 3
fi

count=0
failed=0
while IFS="$(printf '\t')" read -r id name; do
	[ -n "$id" ] || continue
	# Jedes Artefakt in einen EIGENEN Ordner: alle enthalten eine Datei desselben Namens
	# (`<issue>.json`). Flach entpackt überschrieben sie einander und übrig bliebe genau eine Phase.
	artefakt="${dest}/${name}"
	mkdir -p "$artefakt"
	if gh api "repos/${repo}/actions/artifacts/${id}/zip" > "/tmp/${id}.zip" 2>/dev/null \
		&& unzip -o -q "/tmp/${id}.zip" -d "$artefakt" 2>/dev/null; then
		count=$((count + 1))
	else
		failed=$((failed + 1))
		echo "::warning title=Artefakt nicht ladbar::${name} (id ${id}) übersprungen — die Summen sind untererfasst."
	fi
	rm -f "/tmp/${id}.zip"
done <<< "$LIST"

echo "count=${count} failed=${failed}"
exit 0
