# Issue 1139 — Review (Kreuzverhör, PR #1139), Stand 2026-08-31

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Kein `<!-- ai-review -->`-Marker vorhanden → Kreuzverhör (Erstrunde). Kein Closing-Issue (`closingIssuesReferences` = 0) → „Review ohne Issue — PR-Beschreibung ist massgebend" (in Sammelkommentar Zeile 2 vermerkt). Sammelkommentar einmalig erstellt (`gh pr comment 1139 --body-file .ai-memory/issue-1139-review-comment.md`), Titel per Gate umbenannt zu „docs(guide): sync user guide with actual app behavior (2026-08-31)" (alter deutscher Subject-Verstoß). Keine Labels angetastet.

## Erledigt
- Mode bestimmt (Marker-Suche via `gh api issues/1139/comments` → leer), PR-Body als Spec gelesen, Diff komplett gelesen (nur `docs/user-guide.md`, 2 Hunks).
- Fund 1 verifiziert: `frontend/src/components/Dashboard.tsx:244` (`{(geoEnabled || geoDenied) && <NearbyCard />}`) + `NearbyCard.tsx:104-107` (Ablehn-Hinweis „Der Browser hat die Standortfreigabe verweigert …"). Neue Guide-Formulierung deckungsgleich.
- Fund 2 verifiziert: `frontend/src/components/DeleteSeriesDialog.tsx:40,46` (confirmLabel „Ja (Serie + alle Aufgaben)", secondary „Nein (nur Serie, Aufgaben bleiben eigenständig)") + `server/src/express/routes/series.ts:493-505` (Kaskade löscht nur `status != Done`, Done-Instanzen `seriesId → null` in beiden Fällen). Neue Guide-Formulierung deckungsgleich.
- CI geprüft: verify pass, e2e 1–4 pass, precheck pass (nur „review" pending = dieser Lauf).

## Relevante Stellen
- `docs/user-guide.md` ~Zeile 77-86 — Dashboard-Bullet „In der Nähe" (Fund 1).
- `docs/user-guide.md` ~Zeile 340-350 — Serien-Bullet „Verwalten" (Fund 2).
- `frontend/src/components/Dashboard.tsx:86-92,244` — Render-Bedingung + Begründungskommentare (#1098 AK4, #1066 AK4).
- `frontend/src/components/NearbyCard.tsx:104-112` — Hinweis-Zweige denied/unsupported/deaktiviert (letzterer aus Dashboard unerreichbar, Guide-Vereinfachung ok).
- `server/src/express/routes/series.ts:491-505` — DELETE /series/:id Kaskaden-/Abkoppel-Logik (#555).

## Annahmen
- Doku-only-Diff braucht keine Tests (SKILL step 3: reines Styling/Doku-Ausnahme); CI grün bestätigt.
- Guide-Vereinfachung „erscheint nur bei aktivierter Erfassung" verschweigt den unsupported/unavailable-Randfall (Karte bleibt bei `!supported || unavailable` ebenfalls mit Hinweis stehen) — für ein Nutzer-Handbuch akzeptable Vereinfachung, kein Finding.

## Verworfen
- Inline-Review-Kommentare — keine Findings vorhanden.
- MEMORY.md-Eintrag — kein neuer Fehler/noch ungelöste Erfahrung; Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1139-review-comment.md` ist Wegwerf-Artefakt (Body-Vorlage des Sammelkommentars) — NICHT committen; nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt: Label-Transition Richtung Merge (CI grün + reviewed); kein Fixup erwartet.

## Fallstricke
- Findungs-/Options-Nummern gibt es nicht (Runde 1 ohne Findings) — falls doch ein Fixup-Lauf folgt: neue Nummern bei 1 beginnen lassen, Sammelkommentar per Marker-ID updaten, nicht neu erstellen.
