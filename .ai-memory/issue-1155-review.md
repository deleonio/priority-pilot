# Issue/PR 1155 — Review (Kreuzverhör Runde 1), Stand 2026-09-01

**ERGEBNIS: VERDICT needs-fixup (🟡, 1 fixables Finding F1).** Kein `<!-- ai-review -->`-Marker vorhanden → Modus Kreuzverprüfung des Gesamtdiffs. **Kein Closing-Issue** (closingIssuesReferences = 0) → PR-Beschreibung (Guide-Sync-Report) war massgebende informelle Spezifikation; als „Review ohne Issue" in Sammelkommentar Zeile 2 vermerkt.

## Erledigt
- Full Diff gelesen: nur `docs/user-guide.md`, +5/−2, 1 Commit (`085ef331`, Branch `chore/user-guide-sync`, Autor = Workflow-Bot).
- Beide Sync-Funde des PR-Bodies gegen Code verifiziert: 4 Reiter bestätigt (`frontend/src/components/SettingsPage.tsx:32-37`, Standort = Index 3, Kommentar :29-31 nennt Reihenfolge explizit); Adresse kaskadierbar bestätigt (`frontend/src/components/TaskForm.tsx:77-81`, inkl. latitude/longitude; `rhythm`/`startDate`/`active` kaskadieren nie, :70 — Guide-Aussagen dazu unverändert korrekt).
- Konsistenz geprüft: kein „drei Bereiche"-Rest in `docs/` (grep), genau 1 H1 im Guide (`grep -c "^# "` = 1), „vier Bereiche" genau 1× (user-guide.md:409).
- Fund F1 gehoben: Guide-Abschnittsreihenfolge (Allgemein → Standort → Säulen → KI-Provider, `docs/user-guide.md:420`) ≠ UI-Reiter-Reihenfolge (Standort letzter Reiter). Als fixable, geringe Schwere, klassifiziert.
- Titel-Gate: „docs(guide): Ist-Stand-Sync 2026-09-01" verletzte Conventional Commits (deutscher, großgeschriebener Subject) → umbenannt zu „docs(guide): sync user guide to current app state (2026-09-01)" via `gh pr edit`.
- Review mit Inline-Kommentar gepostet (event COMMENT, Review-ID 5073802672, Anker `docs/user-guide.md:420`).
- Sammelkommentar neu erstellt (Marker `<!-- ai-review -->`, Comment-ID 5488548650): Review-Status needs-fixup + „Review ohne Issue"-Hinweis Zeile 2, leere Behoben-Tabelle, Offenes Finding F1, Footer „Review-Typ: Kreuzverhör".

## Relevante Stellen
- `docs/user-guide.md:409-438` — geänderte Einstellungen-Sektion: „vier Bereiche" + neuer Unterabschnitt „### Standort" (:420) vor „### Säulen" (:432) und „### KI-Provider" (:438).
- `docs/user-guide.md:354-358` — Kaskadenfelder-Liste, „Adresse" ergänzt.
- `frontend/src/components/SettingsPage.tsx:29-37` — `SETTINGS_TABS`, verbindliche Reiter-Reihenfolge (Beleg für F1).
- `frontend/src/components/TaskForm.tsx:72-85` — `hasSeriesCascadeChange` (Beleg für Fund 2 des PR-Bodies).

## Annahmen
- Working Tree (Detached HEAD inkl. Merge 3745376d von `085ef331`) entspricht dem PR-Head — verifiziert: user-guide.md zeigt den Post-Change-Stand („vier Bereiche" :409, „### Standort" :420), Zeilennummern des Inline-Komments gültig.
- F1 als needs-fixup (statt reviewed): PR-Ziel ist Ist-Stand-Fidelity, Abschnitts-Reihenfolge ist davon umfasst; Fix trivial (Abschnitt verschieben oder Reihenfolge in Einleitung nennen).
- Kein MEMORY.md-Eintrag: kein neuer Fehlertyp, Kriterium (strikt) nicht erfüllt.

## Verworfen
- Fund zu „Adresse (inkl. Koordinaten)"-Formulierung (lat/lon kaskadieren auch ohne Adress-String-Änderung, `TaskForm.tsx:80-81`) — zu pedantisch, konzeptionell von „Adresse" umfasst; nicht erhoben.
- Weitere Prüfung der laut PR-Body „geprüft und bestätigt"-Abschnitte (Punkte-Formel, Push etc.) — FOCUS: nur der Diff; die 2 Hunks sind verifiziert.

## Offen
- Fixup-Runde: F1 umsetzen (Abschnitt „Standort" hinter „KI-Provider" verschieben ODER Reiter-Reihenfolge in Zeile 409 nennen), dann Fixup-Verifikation (Modus FIXUP VERIFICATION gegen Sammelkommentar 5488548650).
- Wegwerf-Artefakte NICHT committen: `.ai-memory/issue-1155-review-payload.json`, `.ai-memory/issue-1155-review-comment.md`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Fixup-Agent setzt F1 um; Folge-Review (Fixup-Nachweis) tickt F1 ab und prüft nur den Fixup-Diff.

## Fallstricke
- Sammelkommentar-ID 5488548650 — bei Folge-Runden per Marker suchen und PATCHen, nicht neu anlegen; Finding-Nummer F1 stabil lassen.
- Zeilennummern im Guide verschieben sich durch den F1-Fix — beim Folge-Review Anker neu bestimmen.
- Kein Closing-Issue vorhanden: keine AK-Verifikation möglich, PR-Beschreibung bleibt massgebende Spezifikation auch in Folge-Runden.
