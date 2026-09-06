# Issue 1251 — Spec-Phase (rote Tests), Stand 2026-09-06

**ERGEBNIS: VERDICT ready.** Draft-PR **#1263** (OPEN, isDraft=true, closingIssuesReferences → 1251 verifiziert), Commit `26f81a30` auf `ai/harness/1251` gepusht (spec + 4 Testdateien, 516 Zeilen, nur Tests + `docs/spec/issue-1251.md`, kein Produktivcode). Rot-Verifikation scoped gelaufen (s. Fallstricke unten für die Signatures).

## Erledigt
- Harness-Marker-Kommentar geladen (`.ai-memory/issue-1251-harness.md`), AKs 1–7 + KI-UX-Block ausgewertet (Badge „Ruhend", WCAG 1.4.1/1.4.10, kein Toggle, Toolbar bleibt).
- Branch-Resume geprüft: `ai/harness/1251` existierte mit nur 1 Memory-Commit (Triage), kein Draft-PR → normaler Spec-Lauf auf diesem Branch fortgesetzt.
- Dedup: `groups-invitations.api.test.ts`, `groups.api.test.ts`, `series-created-by.test.ts` (#1250 = nur Lese-Scope, keine Kollision), `SeriesTab.test.tsx` geprüft — nichts doppelt, kein Widerspruch.
- `docs/spec/issue-1251.md` neu (Ziel/feste Annahmen/AK1–AK7 mit Voraussetzung-Schritte-Erwartet/Testlandkarte) — im SELBEN Commit wie die Tests.
- Tests geschrieben + rot verifiziert + committet (`--no-verify`, knip-Unresolved-imports, s. Fallstricke) + gepusht + Draft-PR #1263 mit `--body-file` (Body: `.ai-memory/issue-1251-pr-body.md`).
- Playwright-Chromium einmalig in der Sandbox installiert (`npx playwright install chromium --with-deps`).

## Relevante Stellen
- `server/src/express/groups-series-resting.api.test.ts` (NEU) — AK1–AK5: Gruppenlöschung/Austritt räumen `GroupInvitation` ab + stillagen Cross-Serien; Setup per Modell-Seed (`Group`/`GroupMember`/`GroupInvitation` direkt), Cross-Serien über API (`POST /series {userId}`, Muster series-created-by.test.ts).
- `server/src/logics/groupInvitationCleanup.test.ts` (NEU) — AK7: importiert `cleanupOrphanedGroupInvitations` aus `./groupInvitationCleanup.js` (existiert NICHT → rot = ERR_MODULE_NOT_FOUND, neue Funktionalität).
- `frontend/src/components/SeriesTab.test.tsx:184+` (erweitert) — AK6 Unit: Badge „Ruhend" bei `active:false`, keins bei `true`, Toolbar bleibt; nutzt bestehenden module-level `makeSeries`/`mockListSeries`-Mock.
- `frontend/e2e/issue-1251-series-resting.spec.ts` (NEU) — AK6 e2e: 375×812, Serie per `page.request.post('/api/v1/series', {active:false})` geseedet, Badge-Assertion + Bounding-Box-Überlauf-Check.
- Produktionsziele der Impl: `server/src/express/routes/groups.ts:214` (DELETE /groups/:id — Transaktion ab :226 nur GroupMember+Group), `groups.ts:526` (DELETE members — nur `target.destroy()`), `server/index.ts` (Start-Bereinigung), `frontend/src/components/SeriesTab.tsx:147` (Badge-Zeile).

## Annahmen
- AK2-Zustand „Mitglied MIT pending-Einladung" ist per API nicht erzeugbar (409 bereits-Mitglied + 409 Duplikat-pending) → als Legacy per Modell geseedet; im PR-Body dokumentiert.
- AK4 ist als Schutz-Guard bewusst heute GRÜN (rot nur bei zerstörerischer Impl) — im Spec + PR-Body so gekennzeichnet.
- Funktions-/Dateiname der AK7-Bereinigung im Spec festgezurrt: `cleanupOrphanedGroupInvitations()` in `server/src/logics/groupInvitationCleanup.ts` (Analyse nannte nur „Vorschlag logics/").
- `GET /series` DTO führt `active` bereits (series.ts:115) → AK6-API-Anteil ohne eigenen Server-Test abgedeckt (e2e seedit über die API).

## Verworfen
- Erweiterung von `groups-invitations.api.test.ts` statt neuer Datei — Datei bereits 2 Describes (#1212+#1221); eigener kohäriver #1251-Block in neuer Datei mit einem Server-Start.
- Eigener Server-Test für „GET /series liefert active:false" — Feld existiert im DTO schon (series.ts:115), nur lesend; e2e deckt den sichtbaren Pfad.
- MEMORY.md-Eintrag — keine neue Fehlerklasse (knip/`--no-verify`-Muster steht schon drin, 2026-09-05).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1251-harness.md`, `issue-1251-pr-body.md`, diese Datei hier (echte Phasen-Notiz, bleibt lokal, ADR 0010).

## Nächster Schritt
- Impl-Phase: Branch `ai/harness/1251` fortführen (Commit `26f81a30`), Produktionscode nach `docs/spec/issue-1251.md` — dann werden alle roten Tests grün.

## Fallstricke
- Rot-Signatures (vor Impl): API-Datei 4× fail an Ziel-Assertionen („1 !== 0", active true!==false); Cleanup-Test = ERR_MODULE_NOT_FOUND; Vitest 1 failed („Unable to find text Ruhend") | 6 passed; e2e 2 failed am fehlenden Badge.
- Commit lief mit `--no-verify` (knip „Unresolved imports" auf das fehlende Modul) — Impl-Phase: normaler Commit sollte wieder durchlaufen, sobald `groupInvitationCleanup.ts` existiert.
- E2E-Unique-Titles: `uniqueTitle()` truncatet auf 30 Zeichen — Toolbar-Regex nutzt die truncatete Variable, nie den Langtext.
- E2E-Badge-Locator: `getByText('Ruhend', { exact: true })` innerhalb des Items — Titel „E2E #1251 Ruhend …" kollidiert nicht (full-text-Match).
- AK2-Self-leave braucht zweiten Admin (seedGroup([BOB],[BOB])), sonst 409 letzter Admin — Alice ist immer admin.
- `generateAll`-Helper besteht auf 200; Serie mit `startDate 2026-01-05` (Vergangenheit) + weekly erzeugt vor Entfernung Instanzen (AK4-Setup `createdBefore > 0`).
