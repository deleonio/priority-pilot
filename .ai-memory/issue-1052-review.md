# Review PR #1052 — docs(user-guide)-Sync, Runde 2: Fixup-Nachweis (reviewed)

## Erledigt
- MODE bestimmt: `<!-- ai-review -->`-Marker vorhanden (Kommentar 5434142764,
  updatedAt 2026-08-27T03:52:08Z) → Fixup-Nachweis, kein neues Kreuzverhör.
- Fixup-Diff seit updatedAt: genau 1 Commit **45463a16**, nur `docs/user-guide.md` 6+/5−.
- Finding 1 (guide.md:377) als behoben verifiziert: neuer Text „fließen ins
  **Dashboard-Gesamtguthaben** ein, verteilt nach deiner Säulen-Gewichtung — in der
  Erledigt-Tabelle zeigen sie 0 Punkte je Spalte" — stimmt mit Code überein
  (Dashboard.tsx:112-127: Done-ohne-Pillar → `estimatedEffort * pillar.weight/totalWeight`;
  pillar.ts:218-226: `share ?? 0` → 0 Punkte/Spalte in Erledigt-Tabelle).
- Finding 2 (guide.md:430) als behoben verifiziert: „als **je eine gebündelte Nachricht** …
  — sowie **separat** deine drei wichtigsten offenen Aufgaben" = zwei separate Push
  (dailyTopTasks/dueTaskReminders, Runde 1 verifiziert, Code unverändert).
- Adversarial-Check des Fixup-Diffs: keine neuen Probleme (Docs-only, Formulierungen
  deckungsgleich mit den Review-Vorschlägen aus Runde 1).
- Titel-Gate: „docs: sync user guide with the actual app state (2026-08-27)" — CC-konform,
  KEIN erneutes Umbenennen.
- Sammelkommentar 5434142764 per PATCH aktualisiert: Status reviewed, beide Findings in
  „Behobene Anmerkungen"-Tabelle, Footer „Review-Typ: Fixup-Nachweis".
- Verdict `reviewed` nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- docs/user-guide.md:377-379 (Finding-1-Fix), :430-433 (Finding-2-Fix).
- frontend/src/components/Dashboard.tsx:112-127 (Gesamtguthaben-Verteilung säulenloser
  Done-Tasks), frontend/src/lib/pillar.ts:218-226 (getTaskPillarPoints, share ?? 0).

## Annahmen
- CI für 45463a16 war beim Verfassen pending, nicht rot (e2e ×4 + review); docs-only →
  kein Blocker, pr-gate-merge prüft final.
- Runde-1-Verifikation der 8 Fund-Stellen bleibt gültig (Fixup touched nur Doku).

## Verworfen
- Erneutes Kreuzverhör des Gesamtdiffs (MODE Fixup-Nachweis verbietet es).
- Finding zum Edge-Case `totalWeight === 0` (dann kein Dashboard-Eintrag säulenloser
  Tasks): pre-existing Code-Edge, für Nutzer-Doku irrelevant.

## Offen
- e2e ×4 + review-Check für 45463a16 liefen noch pending — falls danach rot, greift
  pr-gate-merge (ai:needs-changes), nicht dieser Review.

## Nächster Schritt
- keiner (Review abgeschlossen, verdict reviewed; Pipeline übernimmt Merge-Gate).

## Fallstricke
- Kommentar-Body per Datei unter `.ai-memory/` + `-F body=@datei` (Bash-Parser-Klammern,
  Learning 2026-08-26); Datei danach gelöscht.
- Finding-Nummern stabil: 1 = guide.md:377, 2 = guide.md:430 — in Tabelle beibehalten.
