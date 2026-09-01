# Issue/PR 1155 — Review (Fixup-Nachweis Runde 2), Stand 2026-09-01T03:55:32Z

**ERGEBNIS: VERDICT reviewed (🟢).** Modus FIXUP VERIFICATION (`<!-- ai-review -->`-Marker vorhanden, Sammelkommentar-ID 5488548650, updatedAt 2026-09-01T03:39:57Z). Runde 1 (Kreuzverhör, needs-fixup, 1 fixables Finding F1) ist oben im Verlauf dokumentiert; diese Runde hat nur den Fixup-Diff geprüft.

## Erledigt
- Fixup-Delta bestimmt: Commits nach updatedAt = `bd0abb88` (F1-Fix), `a2f652b6` + `30be7a76` (ADR-0007-Phase-Notizen) → `git diff 085ef331..HEAD` gelesen.
- F1 abgehakt: `### Standort` byte-identisch (reiner Move, kein Inhaltsdrift) von vor `### Säulen` hinter `### KI-Provider` verschoben — Guide-Heading-Reihenfolge jetzt Allgemein → Säulen → KI-Provider → Standort (`docs/user-guide.md:412,421,427,445`), exakt identisch zu `SETTINGS_TABS` (`frontend/src/components/SettingsPage.tsx:32-37`, Kommentar :29-31 nennt die Reihenfolge explizit).
- Keine neuen Probleme im Fixup-Diff: verschobener Block unverändert, interner Vorwärts-Verweis „siehe Benachrichtigungen" bleibt korrekt (:459 folgt), Rest des Diffs nur `.ai-memory/`-Notizen.
- Titel-Gate: „docs(guide): sync user guide to current app state (2026-09-01)" — Conventional Commits konform (docs(guide), englisches Lowercase-Subject, ≤72). Keine Umbenennung nötig.
- Sammelkommentar 5488548650 per PATCH aktualisiert (Review-Status reviewed, F1 in Behoben-Tabelle mit neuen Zeilennummern, keine offenen Findings, Footer „Review-Typ: Fixup-Nachweis", Updated 2026-09-01).
- Keine Inline-Kommentare (nichts zu fixen), keine Labels angetastet.

## Relevante Stellen
- `docs/user-guide.md:445-458` — neuer Ort des Unterabschnitts „### Standort" (nach KI-Provider :427, vor `## Benachrichtigungen` :459).
- `frontend/src/components/SettingsPage.tsx:32-37` — `SETTINGS_TABS`, Beleg für die Reihenfolgen-Parität.
- Sammelkommentar-ID 5488548650 — weitere Runden PATCHen, nicht neu anlegen.

## Annahmen
- CI der Fixup-Commits lief bei Verdict noch (e2e/verify pending); Docs-only-Änderung + `prettier --check docs/user-guide.md` grün (Fixup-Notiz), Merge-Gate degradiert deterministisch nach `ai:needs-changes`, falls doch rot. Kein Abwarten erforderlich.
- Keine erneute Ganz-PR-Prüfung (Diff-Scoping nach SKILL step 5); Runde-1-Verifikation der beiden Sync-Funde bleibt gültig, da `docs/user-guide.md` außer dem Move nicht geändert wurde.

## Verworfen
- MEMORY.md-Eintrag — kein neuer Fehler/nicht gelöste Erfahrung; striktes Kriterium nicht erfüllt.
- Warten auf grüne e2e-Checks — siehe Annahmen.

## Offen
- Wegwerf-Artefakt NICHT committen: `.ai-memory/issue-1155-review-comment.md` (Payload des Sammelkommentars). Diese Datei hier ist die Phasen-Notiz.
- Merge liegt beim Menschen/der Pipeline (kein Approve durch KI).

## Nächster Schritt
- Keiner — Review abgeschlossen (🟢 reviewed); Pipeline übernimmt Merge-Gate.

## Fallstricke
- Kein Closing-Issue vorhanden: keine AK-Verifikation möglich, PR-Beschreibung bleibt massgebende Spezifikation („Review ohne Issue", in Sammelkommentar Zeile 2 vermerkt).
- Finding-Nummer F1 bleibt stabil; sollte ein Folge-Fixup doch nötig werden, als F2 weiterzählen.
