# PR 1248 — Review (Kreuzverhör Runde 1), Stand 2026-09-06

**ERGEBNIS: VERDICT reviewed, Ampel 🟢 (3 Nits, nicht blockierend).** Review ohne Issue (closingIssuesReferences = 0 → PR-Beschreibung massgebend, im Sammelkommentar Zeile 2 vermerkt). Sammelkommentar neu angelegt (kein `<!-- ai-review -->`-Marker vorhanden war): Comment-ID **5556715608**. Review (event COMMENT, keine Inline-Threads): ID **5124042328**. Titel-Gate: alter Titel „docs(guide): Ist-Stand-Sync 2026-09-06" verstiess gegen Conventional-Commits-Regel (deutsch, Großbuchstabe) → umbenannt zu „docs(guide): sync user guide with current app state (2026-09-06)". Keine Labels gesetzt.

## Erledigt
- Modus bestimmt: kein ai-review-Marker (gh api issues/1248/comments gefiltert auf `ai-review` = leer) → Kreuzverhör, volle PR-Prüfung.
- Diff gelesen: nur `docs/user-guide.md`, +44/−5, 1 Commit (be993f53, Branch chore/user-guide-sync).
- Alle PR-Bericht-Belege code-seitig verifiziert: App.tsx:730–795 (Balance-Schalter, „Neu berechnen" nur bei balanceMode, „Daten haben sich geändert"), TaskTree.tsx:91–96 (`~P{n}`) + 127/130 („Für:"/„Erstellt von:"), Dashboard.tsx:173–177 (Herz-Karte „Meine Lebensbalance", nur pillars>0) + 219 („Erledigt"), Root.tsx:150–152 (/gruppen/beitreten VOR Auth-Gate → „auch ohne Anmeldung" korrekt), GroupJoinPage.tsx:120 („Gruppe beitreten"), GroupDetail.tsx:214/246/261/279/307 (Offene Einladungen/Konto suchen/Einladen/Link erzeugen/Ungültig machen), GroupsSection.tsx:100/113/118 (Überschrift „Einladungen", Annehmen/Ablehnen), SettingsPage.tsx:48–52 (5 Tabs: Allgemein, Säulen, KI-Provider, Standort, Gruppen) + 315/329/360/387/401 (Anzeigename, Animationen), TaskForm.tsx:922–943 (Empfänger nur Anlege-Modus + ≥1 Gruppe), balancePriority.ts:9 („unterversorgt" = Vernachlässigungs-Richtung stimmt).
- Gates: `node --test --experimental-strip-types src/logics/user-guide.test.ts` im server/ = 12/12 grün; `npx prettier --check docs/user-guide.md` grün.
- CI-rot-Klärung: e2e (3)+(4) fail (issue-843 AK1/AK2, settings-switch-layout AK1) — identische Fehler auf **main** im früheren Run 34005240890 (2026-09-06T01:57Z, PR-Lauf 03:38Z) → pre-existing, kein Docs-Diff-Kausalpfad; im Review + Sammelkommentar so dokumentiert, 🟢 trotzdem (Merge-Gate entscheidet CI).
- Review + Sammelkommentar gepostet (IDs oben), Titel umbenannt.

## Relevante Stellen
- `docs/user-guide.md:68,206,490` — die drei Nit-Anker (Herz-Bedingung, Empfänger-Bedingung, „Empfangene Einladungen" vs UI „Einladungen").
- `server/src/logics/user-guide.test.ts` — Vertragstest (#255): Stichwort-Regexes + ≥1 H1; prüft NICHT die neuen Abschnitte (Gruppen/Balance) — keine Test-Pflege nötig, da nur erweiternd.
- `frontend/src/components/GroupsSection.tsx:100` — UI-Überschrift „Einladungen" (empfangene), Gegenstück „Offene Einladungen" GroupDetail.tsx:214.

## Annahmen
- PR-Beschreibung (Guide-Sync-Report mit Funde/Korrektur-Belegen) ersetzt AKs; Abgleich erfolgte genau gegen deren 5 Funde — alle im Diff umgesetzt.
- e2e-Fails als pre-existing bewertet allein aus Run-Vergleich (gleiche Tests, früherer Zeitpunkt auf main); Einzelschritte der Fails nicht weiter diagnostiziert (nicht Review-Scope eines Docs-PR).

## Verworfen
- Fixup-Runde / needs-fixup — nur Nits (Dokumentations-Präzisierung, kein Verhaltensrisiko); Kosten-Nutzen per SKILL step 4.
- MEMORY.md-Eintrag — kein neuer Fehler/eine neue Erfahrung (Subagent-Ausfall war schon 2026-09-05 vermerkt; Delegation diesmal gar nicht erst versucht).
- „Empfänger nur mit Gruppe" u. a. als Blocker — sachlich korrekt dokumentiert wäre schöner, aber Guide-Bullets sind bewusst beschreibend, Feld-Hinweistext erklärt den Fall in der UI (TaskForm.tsx:942-943).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1248-review-body.md`, `issue-1248-sammelkommentar.md`. Nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Workflow übernimmt (Labels/Verdict-Verarbeitung); falls ein Mensch einen Fixup will: die 3 Nits in docs/user-guide.md:68,206,490 sind einzeln umsetzbar ohne neue Verifikation.

## Fallstricke
- Fixup-Nachweis-Runde (falls je getriggert): Sammelkommentar 5556715608 per PATCH updaten (Marker `<!-- ai-review -->` Zeile 1), Finding-Nummern 1–3 stabil lassen; „Review ohne Issue"-Hinweis Zeile 2 beibehalten.
- e2e-Layout-Fails (issue-843, settings-switch-layout, dazu #1051 mic-align auf main) sind auf main rot — bei Folge-PRs nicht dem Diff anlasten, gegen main-Run 34005240890 belegen.
- Commit be993f53 wurde mit `--no-verify` gesetzt (knip „Unresolved imports" pre-existing, MEMORY 2026-09-05) — im PR-Body dokumentiert, kein Review-Fund.
