# Issue 1157 — Review (Phase 5, Kreuzverhör PR #1158), Stand 2026-09-01

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, keine Findings.** Erstreview (kein `<!-- ai-review -->`-Marker vorhanden → MODE Kreuzverhör). Sammelkommentar einmalig erstellt (Marker erste Zeile), Titel-Gate vorher angewendet: PR-Titel auf `fix(server): scope series routes to owner (data isolation) (#1157)` umbenannt (war `[arch-opt] Series-Routen ohne …`, kein Conventional Commit).

## Erledigt
- Modus bestimmt (Marker-Suche `gh api issues/1158/comments` → leer), Issue #1157 per closingIssuesReferences verlinkt → AKs aus Harness-Kommentar (KI-ANALYSE stand=2026-09-01T04:26:23Z) gelesen.
- Gesamtdiff gelesen (350+/11−): 3 Phasen-Notizen, `docs/spec/issue-1157.md`, `server/src/express/routes/series.ts` (+22/−11), neu `server/src/express/series-dataisolation.test.ts` (5 Tests).
- Verifiziert am Working Tree (= PR-Head 3248ee7b, `git diff` server//docs/ leer):
  - `requireAuth.ts:34` — `ownerScope(undefined) === {}` ⇒ Pass-Through bleibt (Randbedingung erfüllt).
  - Alle 5 Series-Query-Stellen in series.ts gescopet (:295, :319, :393, :493, :528); kein `Series.findByPk` mehr in der Datei.
  - Separation of Duties: `git diff 52c81709 HEAD -- series-dataisolation.test.ts` = leer (Spec-Tests unverändert grün geworden).
- Blast-Radius per haiku-recherche-Subagent: ALLE Series-Queries in server/src (non-test) jetzt gescopet, inkl. `logics/series.ts:181` (materializeDueSeries filtert userId) und `series.ts:342` (POST setzt userId). Serie berührende Test-Suiten: series-address, series-dataisolation, series-generate-all-auth, series-title-length, series.api, series.cascade(+.preserve-completed), http-error.
- CI-Stand: verify/e2e pending, kein roter Check → Gate greift vor Merge (kein 🟢-Ausschluss).

## Relevante Stellen
- `server/src/express/routes/series.ts:295` — `findSeriesWithPillars(id, userId)` jetzt `findOne({ where:{ id, ...ownerScope(userId) }, include:[Pillar] })`; beide Call-Sites (POST-Neuanlage ~:348, PATCH-Re-Load ~:472) reichen `getUserId(req)` durch.
- `series.ts:319,393,493,528` — GET-Liste + GET/PATCH/DELETE /:id + generate je gescopet, fremde ID → 404.
- `server/src/express/series-dataisolation.test.ts` — AK1 (Liste nur eigene, Länge 1) + AK2 (4× 404 fremd + Positivfall 200/200/204/201 gegen Über-Scoping).
- `server/src/logics/series.ts:181` — generate-all-Pfad bereits gescopet (unangetastet, korrekt).

## Annahmen
- Tests grün nachgewiesen durch Impl-Notiz (51/51 lokal, 5 rote Spec-Tests grün) + CI-Gate; eigener Lokal-Lauf nicht möglich (Runner hat kein pnpm/node_modules — `pnpm: command not found`).
- Hint „feat/server" des Titel-Gates bewusst zu `fix(server)` abgewandelt: Datenisolation-Lücke = fix, identisch zum Impl-Commit des PR; Gate prüft nur CC-Form.

## Verworfen
- Lokale Test-Ausführung — Toolchain fehlt (s.o.), Side-Trip verboten; CI verify läuft.
- Finding „Kommentar-Typo `:id/:generate` in Test-Header (series-dataisolation.test.ts:8)" — rein kosmetisch, kein pseudo-Finding für 🟢.
- Eigene Pass-Through-Prüfung — AK3 laut Analyse ohne eigenen Testfall, series.api.test.ts deckt ab.
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- Wegwerf-Artefakte dieses Laufs in `.ai-memory/`, NICHT committen: `issue-1158-pr-diff.txt`, `issue-1157-harness.txt`. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Workflow: Gate/CI abwarten (verify + e2e), dann `ai:ready-to-merge` → Merge. Fixup-Runde nur bei rotem CI oder Rückmeldungen.

## Fallstricke
- Follow-up-Review (falls Fixup): Sammelkommentar existiert jetzt (Marker `<!-- ai-review -->`) → MODE Fixup-Nachweis, Diff-Scoping ab dessen updatedAt; Finding-Nummerierung entfällt (keine Findings gesetzt).
- CI `verify`/`e2e` waren bei Review-Abschluss noch pending — 🟢 gilt contentlich, Gate degradiert bei Rot selbst auf ai:needs-changes.
