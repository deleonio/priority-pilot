## Erledigt
- PR 1036 analysiert via `gh pr view` + Body-Zusammenfassung gelesen
- `/tmp/doc.json` geschrieben und validiert (jq .)

## Relevante Stellen
- PR-Body: ausführliche Beschreibung der drei Komponenten (1. GLM-Preisierung, 2. Backfill-Skript, 3. Agenten-Doku)
- `.github/scripts/cost-backfill-zai.ts` (neue Datei, 115 Zeilen): Kern des Backfill
- `.github/scripts/cost-from-transcript.ts`: GLM-Preisierungs-Logik

## Annahmen
- PR 1036 ist gemergt (gegeben)
- Titel ist konform per Conventional Commits → title field in JSON bleibt leer
- Klassifikation: improved (nicht new, da bestehende Kosten-Übersicht erweitert, nicht neue Funktion)
- Keine expliziten Issues (Closes/Fixes) im Body → issues array leer

## Verworfen
-

## Offen
-

## Nächster Schritt
Fertig. JSON schreiben (done), Memory aktualisieren (dieser Eintrag), ggf. Dauergedächtnis ergaenzen.

## Fallstricke
- PR hat mehrere Labels/Typen (feat + docs) aber eine einzige Classification — improved war die beste Wahl
- GLM-Preisierung ist techn. Verbesserung, nicht breaking change
