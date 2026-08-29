# Issue 1119 / PR 1124 — Review (Kreuzverhör Runde 1), Stand 2026-08-29

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, keine Findings.** Sammelkommentar `<!-- ai-review -->`
einmalig erstellt (issuecomment-5463384113). Titel-Gate: PR-Titel war deutsch + 74 Zeichen →
umbenannt zu `test(frontend): assert observable outcomes in useGeolocation (#1119)`.
Keine Labels angetastet. Kein MEMORY.md-Eintrag (kein neuer Fehler).

## Erledigt
- MODE bestimmt: 0 PR-Kommentare → kein Marker → Kreuzverhör (kein Fixup-Nachweis).
- Issue #1119 geladen: scanner-generiert (test-optimization.yml), 4 kritische Findings in
  `frontend/src/lib/useGeolocation.test.ts`. KEIN `<!-- ai-harness -->`-Kommentar und KEIN
  KI-ANALYSE-Block → AKs direkt aus „Woran messen wir das?" des Issue-Bodys (4 Tests müssen
  beobachtbare Ergebnisse prüfen statt nur Mock-Aufrufe).
- Vollen Diff gelesen (nur `useGeolocation.test.ts`, Test-only, Commit 8ae8b22f) und gegen
  den Hook am PR-Head (`git show origin/ai/harness/1119:frontend/src/lib/useGeolocation.ts`)
  verifiziert: `applyPosition` setzt `positionUpdatedAt = Date.now()` bei JEDER Ermittlung
  (auch gleiche Koordinaten), Intervall-Effekt armiert erst nach `intervalMs !== null`,
  Initial-Fetch nur bei `positionRef.current === null`, Config-Reload per Event re-armt
  über `intervalMs`-Dep. Fake-Timer (`shouldAdvanceTime: true`) + gefaktes `Date.now()` →
  Zeitstempel-Assertions deterministisch; waitFor-Timeout macht beide Intervall-Tests bei
  Regression (z. B. verdoppeltes Intervall) tatsächlich rot.
- Randchecks: `GEOLOCATION_INTERVAL_MS`-Import bleibt genutzt (Test Z. 92/134, #845-Block);
  `vi.clearAllMocks()` löscht KEINE Implementierungen → `reportGeoPositionMock.mockResolvedValue`
  aus dem vi.mock-Factory überlebt; Fake-Timer nur im #1098-Describe (afterEach `useRealTimers`).
- CI: `verify` pass, `precheck` pass, e2e-Shards pending (unit-only-Änderung, nicht blockierend);
  Skill-Regel „kein 🟢 bei roter CI" nicht verletzt.

## Relevante Stellen
- `frontend/src/lib/useGeolocation.test.ts:269-346` — #1098-Describe: Fake-Timer-Umstellung AK5 + Re-Arm-Event-Test (beobachtbar via `positionUpdatedAt`).
- `frontend/src/lib/useGeolocation.test.ts:382-410` — #1101-Describe: State-Asserts aktiv/inaktiv, Ersatz der vakuen waitFor-Negativ-Assertion.
- `frontend/src/lib/useGeolocation.ts:100-215` — Hook-Vertrag, gegen den die Tests verifiziert wurden (Config-Fetch → `intervalMs` → Intervall-Effekt mit `locate()`).

## Annahmen
- PR-Body-Angaben (format/lint/knip/test grün, Rote-Verifikation per verdoppeltem Intervall)
  geglaubt, lokal nicht nachgefahren — Runner-Sandbox hat keine `frontend/node_modules`
  (deps:no); `verify`-CI-Job ist gelaufen und grün.
- e2e-Auslassung ist gerechtfertigt (reine Test-Datei-Änderung, keine UI-Verhaltenänderung).

## Verworfen
- Eigener Test-Lauf im Worktree — ohne node_modules nicht machbar; CI-verify deckelt das.
- Findings zu verbliebenen `setInterval`-Spys im #845-Block (AK2/AK6) — nicht Teil der 4
  Scanner-Findings des Issues, Scope des PRs ist die genannte Liste.

## Offen
- `.ai-memory/issue-1124-comment.md` ist Wegwerf-Artefakt (Comment-Body) — nicht committen.

## Nächster Schritt
- Workflow übernimmt: Verdict `reviewed` → Gate prüft CI (e2e pending) → `ai:ready-to-merge` erst bei grün.

## Fallstricke
- Fixup-Runde (falls trotzdem eine kommt): Marker-Kommentar existiert jetzt (5463384113) →
  MODE = Fixup-Nachweis, nur Delta seit Updated 2026-08-29 prüfen, Finding-Nummerierung bleibt stabil (keine vergeben).
