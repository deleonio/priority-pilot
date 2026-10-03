#!/usr/bin/env bash
# Installiert die pi-Pakete aus .pi/settings.json in die GLOBALE pi-Ebene (~/.pi/agent)
# und weist das Ergebnis mit `pi list` nach.
#
# EINE Quelle für zwei Aufrufer (#2092): den Install-Step der setup-pi-Action (nur bei
# Cache-Miss) und den Vorwärm-Lauf cron.pi-package-cache.yml, der den Paket-Cache
# schreibt — Issue-/PR-Trigger dürfen keine Cache-Writes, deshalb wärmt ein eigener
# schedule/dispatch-Lauf vor und jeder Phasenlauf restauriert nur (Restore ist überall
# erlaubt). Ohne dieses Skript als gemeinsame Quelle drifteten die beiden Install-
# Weisen auseinander — genau der Fehler, den die Pilotphase messbar machen will.
#
# NIE FATAL ist hier falsch: Ein still fehlender MCP-Adapter oder ein fehlendes
# Subagent-Paket ändert das Laufverhalten unbemerkt (s. Kommentarblock unten).
set -uo pipefail

SETTINGS=".pi/settings.json"
if [ ! -f "$SETTINGS" ]; then
  echo "::error title=pi-Pakete fehlen::$SETTINGS nicht gefunden — ohne die Paketliste läuft pi ohne Subagents und MCP und ist mit einem Claude-Code-Lauf nicht vergleichbar."
  exit 1
fi

# QUELLE IST DAS EINGECHECKTE PROJEKTFILE, nicht eine CI-eigene Liste: .pi/settings.json
# gilt ohnehin für jede pi-Session in diesem Repo (auch lokal). Eine zweite Liste nur
# für CI würde genau das erzeugen, was die Pilotphase widerlegen soll — einen Lauf, der
# anders arbeitet als der lokale.
#
# WARUM ÜBERHAUPT INSTALLIEREN, wenn pi Projektpakete beim Start selbst nachzieht:
# Die Projekteinträge tragen `autoload: false` und sind damit laut pi-Doku ein DELTA
# über dem jeweiligen GLOBALEN Eintrag (Ressourcen-Filter, nicht eigenständige
# Installation). `pi install` schreibt in die globalen Settings (~/.pi/agent/settings.json)
# und stellt diese Ebene im Runner erst her.

# Objektform (mit Ressourcen-Filtern) ebenso zulassen wie den blossen Quell-String —
# die pi-Doku erlaubt beide in `packages`, und das Projektfile nutzt die Objektform.
mapfile -t SOURCES < <(jq -r '.packages[]? | if type == "object" then .source else . end' "$SETTINGS")
if [ "${#SOURCES[@]}" -eq 0 ]; then
  echo "::error title=pi-Pakete leer::$SETTINGS enthält keine packages."
  exit 1
fi

# HART FEHLSCHLAGEN statt weiterlaufen: Ein still fehlender MCP-Adapter oder ein
# fehlendes Subagent-Paket ändert das Verhalten des Laufes, ohne dass es im Ergebnis
# sofort sichtbar wäre — und macht damit genau den Vergleich kaputt, für den die
# Pilotphase existiert.
UNPINNED=""
for SRC in "${SOURCES[@]}"; do
  echo "→ pi install $SRC"
  if ! pi install "$SRC"; then
    echo "::error title=pi-Paket nicht installierbar::'$SRC' — Lauf abgebrochen."
    exit 1
  fi
  # Versionslose npm-Quelle = die CI zieht bei jedem Lauf die aktuelle Version, und
  # zwei Läufe basierten dann auf verschiedenen Erweiterungsständen — als
  # Kostenvergleich wertlos. Alle Einträge sind deshalb gepinnt und werden von einem
  # Renovate-CustomManager gepflegt (renovate.json5). Die Prüfung bleibt als
  # Sicherheitsleine: Ein von Hand nachgetragener Eintrag ohne Version soll auffallen,
  # bevor er die Messbasis verschiebt.
  case "$SRC" in
    npm:*@*) ;;
    npm:*) UNPINNED="${UNPINNED:+$UNPINNED, }$SRC" ;;
  esac
done
if [ -n "$UNPINNED" ]; then
  echo "::warning title=📌 Ungepinnte pi-Pakete::${UNPINNED} — die CI zieht jeweils die aktuelle Version, Läufe werden unvergleichbar. In .pi/settings.json auf eine Version festlegen (npm:paket@x.y.z); Renovate hält sie danach aktuell."
fi

# NACHWEIS im Runner-Log (Akzeptanzkriterium des Tickets): `pi list` zeigt die
# installierten Pakete mit Version und Pfad. Bewusst „installiert", nicht „geladen" —
# ein headless-Lauf gibt keinen Startkopf aus (--verbose ist im -p-Modus stumm,
# nachgemessen mit 0.84.4), also ist das die belastbarste Aussage, die im Log steht.
echo "::group::pi list"
pi list || echo "::warning title=pi list::Auflistung fehlgeschlagen — Installation lief dennoch durch."
echo "::endgroup::"
