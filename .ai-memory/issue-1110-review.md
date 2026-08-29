# Issue 1110 — Review (Phase 5), Stand 2026-08-29T09:05Z

**ERGEBNIS: VERDICT needs-fixup, Ampel 🔴.** MODE = Kreuzverhör (Erstrunde — kein `<!-- ai-review -->`-Kommentar vorhanden, 0 Issue-/Review-Kommentare). Review mit 2 Inline-Finden gepostet (review id 5057393196, event COMMENT), Sammelkommentar erstellt (issuecomment-5461322787), PR-Titel per Title-Gate umbenannt.

## Erledigt
- MODE-Bestimmung: `gh api repos/{owner}/{repo}/issues/1114/comments` = 0, `pulls/1114/comments` = 0, reviews = 0 → Marker fehlt → Kreuzverhör.
- Full-Diff gelesen (`gh pr diff 1114`, 736 Zeilen, 10 Dateien: 3 Phasen-Notizen, docs/spec/issue-1110.md, NearbyCard.tsx/.test.tsx, TaskForm.tsx, tasksChanged.ts, e2e issue-1110-nearby-radius.spec.ts, tasks-nearby.test.ts). Closing issue #1110 (length=1) → AKs aus KI-ANALYSE-Block (AK1–AK7).
- CI geprüft: **`e2e (2)` ROT** (run 33242931315, job 99075254448) — AK1 (`spec.ts:76`) und AK2 (`:83`) scheitern mit `unexpected value "In der Nähe (6 km)"`; verify + e2e (1)/(3)/(4) grün.
- Root Cause per Code-Recherche: `frontend/e2e/issue-1098-geo-settings.spec.ts:130-152` (AK7) setzt per `ArrowRight` die Anzeige-Entfernung des gemeinsamen E2E-Users auf 6 km und resettet NICHT → Shard-Reihenfolgen-Abhängigkeit; lokal (nur Datei 1110) zufällig grün. Kein anderes Spec/Seed setzt displayDistanceKm.
- Serien-Fund verifiziert: `TaskForm.tsx:886,972-996` (Adressfeld auch im Serien-Modus), `server/src/express/routes/series.ts:448` + `server/src/logics/series.test.ts:611` (Instanzen erben latitude/longitude) → `if (!isSeriesMode)` um `notifyTasksChanged()` (TaskForm.tsx:675) lässt die Nearby-Card nach Serien-Save stehend.
- Review gepostet: F1 (e2e spec.ts:76, CI-rot/Test-Isolation), F2 (TaskForm.tsx:675, Serien-Save). Nicht-blockierende Hinweise im Review-Body (Delete/Complete feuern kein Event: DeleteTaskDialog.tsx:26, CompletedTasksTable.tsx:85, App.tsx:387; Echo-Guard nur e2e- abgesichert; Math.round unkritisch wegen geoConfig.ts:72,80).
- Sammelkommentar erstellt (Marker `<!-- ai-review -->`, Struktur Review-Status/Behobene Anmerkungen/Entscheidungs-Findings/Offene Findings/Footer, Review-Typ: Kreuzverhör, Updated 2026-08-29, line 2 nennt PR #1114 + Issue #1110).
- Title-Gate: Alter Titel „Nearby-Card: Anzeige-Entfernung im Titel + echte Distanzen (#1110)" verletzte Conventional Commits → `feat(frontend): nearby radius title and real distances (#1110)` (61 Zeichen) gesetzt und verifiziert.
- Wegwerf-Artefakte: `.ai-memory/issue-1110-review-{summary,f1,f2,collected}.md` + `/tmp/{pr1114.diff,pr1114-body.md,review-payload.json}`.

## Relevante Stellen
- `frontend/e2e/issue-1110-nearby-radius.spec.ts:56-63` — `setDisplayDistance`-Helper existiert bereits; der Fix für F1 ist damit 2 Zeilen (PUT 5 vor `goto('/')`).
- `frontend/e2e/issue-1098-geo-settings.spec.ts:130-152` — verursacht den 6-km-Zustand; Langfrist-Option: dort Reset im afterEach.
- `frontend/src/components/TaskForm.tsx:675-677` — F2-Fixort (Bedingung streichen).
- `frontend/src/lib/tasksChanged.ts` — new Event-Mechanik; für spätere Delete/Complete-Anbindung wiederverwendbar.
- `frontend/src/components/NearbyCard.test.tsx:53` — Test-Pflege der Impl (Locator-Helper statt `getByText`); begründet im PR-Body → als zulässig akzeptiert (Assertions wortgleich).

## Annahmen
- Der 6-km-Wert in CI stammt aus 1098-AK7 (keine andere Fundstelle setzt displayDistanceKm; Seed/Default ist 5, migrate.ts:450).
- `notifyTasksChanged()` ist idempotent und für Serien-Saves ungefährlich (Card refetcht nur eigene Liste).
- Test-Pflege (NearbyCard.test.tsx) erfüllt die SKILL-Bedingung „reported back with justification" → kein Separation-of-Duties-Verstoß.

## Verworfen
- needs-human — beide Findings sind fixbar, kein Produkt-/Architektur-Entscheid.
- `Math.round(displayDistanceKm)` als Finding — Server erzwingt Ganzzahl 1–50 (`geoConfig.ts:72,80`).
- Dupliziertes Haversine-Orakel (e2e + server test) als Finding — bewusst unabhängig von der Route (Verriegelung), Workspaces getrennt.
- Delete/Complete-Refresh als blockendes Finding — Verhalten wie vor dem PR, kein AK; als Hinweis dokumentiert.

## Offen
- Fixup-Runde ausstehend: F1 (CI-rot) + F2 (Serien-Save). Nach Fixup: Fixup-Verifikation (Marker-Kommentar updaten, Review-Typ: Fixup-Nachweis).

## Nächster Schritt
- Nach `ai:needs-changes`/Fixup-Push: Delta-Review nur der Fixup-Commits, F1/F2 abhaken, Sammelkommentar updaten (findings in „Behobene Anmerkungen" verschieben, Zahlen stabil lassen).

## Fallstricke
- `gh pr edit --title … --json title` ist keine gültige Kombination (unknown flag: --json) — erst edit ohne --json, dann separat verifizieren.
- e2e-Shards teilen einen persistenten User/DB: Specs, die Geo-Config o. ä. umstellen, brauchen einen Reset, sonst Reihenfolgen-Failures in anderen Specs (exakt dieser Fall, AK1/AK2 „grün lokal, rot in CI").
- `toHaveAttribute` retryt über den Basistitel hinweg und maskiert die Race gegen den Config-Fetch — der Test prüft dann den zufälligen DB-Stand statt des eigenen Setups.
- Reviews mit Inline-Kommentaren: Payload per python3 als JSON-Datei + `gh api … --input` (`comments[][path]`-Syntax vermeiden); Antwort-Objekt enthält `comments` nicht → Landed-Check über `pulls/<nr>/comments` (length).
