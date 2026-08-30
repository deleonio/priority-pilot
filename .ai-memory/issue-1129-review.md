# PR 1129 — Review (Kreuzverhör Runde 1), Stand 2026-08-30

**ERGEBNIS: VERDICT needs-fixup (🟡).** Docs-only-PR (+46/−11, nur `docs/user-guide.md`), KEIN Closing-Issue → „Review ohne Issue", PR-Beschreibung massgebend. Review id 5059862730 (event COMMENT) mit 2 Inline-Findings; Sammelkommentar id 5466533137 (Marker `<!-- ai-review -->` angelegt — Folge-Runde = FIXUP VERIFICATION, Diff-Scope ab updatedAt). Titel-Gate: „docs(guide): Ist-Stand-Sync 2026-08-30" (deutsch/uppercase) → umbenannt zu `docs: sync user guide with implemented state (2026-08-30)`. Keine Labels gesetzt.

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Marker (pulls+issues-API leer) → Kreuzverhör; closingIssuesReferences = 0.
- Alle 11 PR-Body-Befunde via 2 Haiku-Recherche-Subagents gegen Code verifiziert — alle Belege korrekt (App.tsx:488-499 aiEnabled-Berater; NearbyCard.tsx:9,10,25,95 max 10/aufsteigend/1 Nachkommastelle/Titel mit displayDistanceKm, Hinweise :101-108; GeoBadge-Nutzung TaskTree:93/SeriesTab:149/CompletedTasksTable:128; TaskForm.tsx:972,984-994 Adresse-Feld; tasks.ts:312 + score.ts:11,36 Punkteformel; SettingsPage.tsx:347 „Standort ermitteln", Regler :371-425 mit Kreuz-Schranken :397; KI-Schalter :452-483 inkl. `_disabled={!aiEnabled}` :477; UpdatePrompt.tsx:66 „Jetzt neu laden"; geo-background-job.ts:92 `<=`, :128/:133 Push-Texte, Dedup :100-108, DEFAULT_ALARM_DISTANCE_KM=1 :28; series.ts:420-452 Rhythmus/Start/active nicht kaskadiert).
- 2 eigene Gegenproben (GeoBadge.tsx:81-83 Render-Bedingung selbst gelesen; TaskForm.tsx:983-988 Freitext-verwirft-Koordinaten) → 2 Findings (s. Fallstricke).
- Vertragstest `server/src/logics/user-guide.test.ts` (AK 2.1–2.9, Regex auf Abschnitte) — Überschriften im Diff unangetastet → grün, `verify`-Job pass.
- Sammelkommentar + Review + Titel-Rename wie oben.

## Relevante Stellen
- `docs/user-guide.md:420` — Finding 1: „ab dieser Entfernung … Push-Hinweis" invertiert (Code: näher ALS).
- `docs/user-guide.md:123` — Finding 2: „Adresse mit Koordinaten" zu eng (Badge: Adresse ODER Koordinaten).
- `server/src/logics/geo-background-job.ts:92` + `frontend/src/components/GeoBadge.tsx:81-83` — Belegstellen der Findings.
- `server/src/logics/user-guide.test.ts` — Vertragstest, bei Guide-Edits Überschriften nie antasten.

## Annahmen
- e2e-Shard 3/4-Fail (`e2e/issue-969.spec.ts:86`, Settings-Padding) ist Flake/pre-existing: docs-only-Diff ohne Kausalpfad, main-Läufe aktuell grün — nicht rerunnnt (needs-fixup triggert ohnehin neuen CI-Lauf).
- Guide-Sync-PRs dieser Art brauchen kein Closing-Issue (nightly „Guide-Sync"-Workflow erzeugt sie ohne Issue).

## Verworfen
- CI-Rerun des Flake-Shards — bringt nichts, Fixup-Push erzeugt neuen Lauf.
- MEMORY.md-Eintrag — kein neues Fehlermuster, Kriterium nicht erfüllt.
- Footer-Position-Behauptung (PR-„Offene Unklarheiten") angreifen — steht im unveränderten Text, nicht im Diff.

## Offen
- Fixup-Runde: 2 Formulierungen in `docs/user-guide.md` (Zeilen ~123, ~420) korrigieren.
- Wegwerf-Artefakte NICHT committen: `.ai-memory/issue-1129-review-payload.json`, `.ai-memory/issue-1129-collected.md` (diese Datei hier ist die Phasen-Notiz).

## Nächster Schritt
- Fixup-Agent: beide Findings als Ein-Zeilen-Umformulierungen einbauen, Sammelkommentar id 5466533137 in Runde 2 per PATCH aktualisieren (Behobene-Anmerkungen-Tabelle füllen).

## Fallstricke
- Runde 2 = FIXUP VERIFICATION: nur Diff seit Sammelkommentar-updatedAt prüfen, Finding-Nummern 1/2 NICHT neu nummerieren.
- Review-POST-Response zeigt `.comments | length` = 0, obwohl Inline-Kommentare anlegen — Wahrheit steht in `pulls/1129/reviews/<id>/comments` (waren 2).
- Deutsch/uppercase-PR-Titel verletzt das CC-Gate (English, lowercase) — nach Fixup-Push erneut prüfen; Titel ist jetzt schon konform.
