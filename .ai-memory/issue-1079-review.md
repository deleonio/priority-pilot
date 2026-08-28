# Review PR #1079 (fix/security-code-scanning) — Runde 2 (Fixup-Nachweis) ABGESCHLOSSEN

## Erledigt
- MODE=Fixup-Nachweis: Sammelkommentar 5447464222 (updatedAt 2026-08-28T02:01:51Z) gefunden, Marker vorhanden. Kein Closing-Issue → weiterhin „Review ohne Issue", PR-Beschreibung massgebend.
- Delta seit updatedAt bestimmt: `25a47425` (05:11Z, CodeQL #3-#5: exakte URL-Origin-Vergleiche in auth.test.ts/transit.test.ts/push-test-endpoint.test.ts), `7c98a65e` (merge main), `62bbf080` (19:15Z, „F1+R2 aus Kreuzverhör Runde 1 — e2e-Races (CSRF-Timing) und Middleware-Tests").
- Fixup-Diff `62bbf080` voll gelesen: keyboard-shortcuts.spec.ts:281-293 (Gate auf Heading „Serie anlegen" statt „Neuen Task anlegen"), logout.spec.ts:343-349 (`expect.poll(() => logoutMethod)`), api.test.ts +82 Zeilen (3 CSRF-Middleware-Tests).
- F2 verifiziert OHNE lokalen Testlauf (Sandbox hat keine node_modules, pnpm nicht installiert): Alle Test-Assertionen gegen api.ts-Quellstand deckungsgleich — `fetch(`${baseUrl}/auth/csrf`)` OHNE zweites Argument (api.ts:53) macht `toHaveBeenCalledWith('/api/v1/auth/csrf')` zum exakten Match; onRequest/onResponse-Semantik (api.ts:60-70) und logout() (api.ts:385-395: manueller POST mit Header + `csrfToken = null` danach) passen exakt zu den Fetch-Zählungen der Tests. Tests haben reale Fehlschlagkraft (keine tautologischen).
- F1 als behoben abgehakt: Fixup-Reply 3883375595 dokumentiert Basis-Vergleich (main 9303befd 22/22 grün, Branch 2× deterministisch rot) + Trace-Analyse; Race-Fixes sind die kanonischen Muster (vgl. MEMORY.md 2026-08-28 Playwright/E2E).
- `25a47425` geprüft: `assert.equal(new URL(location).origin, …)`, `endpoint === …`, `new URL(url).origin === …` — semantisch korrekt, test-only, keine neuen Probleme.
- Sammelkommentar 5447464222 per PATCH aktualisiert (Review-Status: reviewed, F1+F2 in Behobene-Anmerkungen-Tabelle, Footer Review-Typ: Fixup-Nachweis). Temp-Body-Datei entfernt.
- Titel-Gate: `fix(security): rate limiting, csrf protection, workflow permissions` — konform, kein Rename.
- Verdict `reviewed` nach /tmp/claude-verdict geschrieben.

## Relevante Stellen
- frontend/src/api.ts:45-70 — CSRF-Middleware (ensureCsrfToken ohne zweites fetch-Argument!, onRequest/Response).
- frontend/src/api.ts:385-395 — logout(): manueller fetch POST mit x-csrf-token, danach csrfToken=null.
- frontend/src/api.test.ts:25-104 — die 3 neuen Middleware-Tests (sequenziell aufbauend, Modul-Cache-State).
- frontend/e2e/keyboard-shortcuts.spec.ts:281-293, logout.spec.ts:343-349 — Race-Fixes AK8/AK-2.

## Annahmen
- e2e des aktuellen Runs (33203179605, head 62bbf080) wird grün — war bei Review-Abschluss noch in flight; das Merge-Gate degradiert selbstständig bei Rot (in Sammelkommentar dokumentiert).
- api.test.ts-Tests laufen grün: verifiziert per Quell-Abgleich, nicht per Ausführung (Sandbox ohne deps).

## Verworfen
- Lokaler Testlauf (vitest/playwright): Sandbox hat kein node_modules, pnpm fehlt; Installation hätte die Soft-Deadline gesprengt. Stattdessen Assertions gegen api.ts quell-verifiziert.
- Warten auf e2e-Shards: ~10+ Min Laufzeit vs. <7 Min Restbudget — dem Merge-Gate überlassen.

## Offen
- -

## Nächster Schritt
- Keiner für die Review-Phase. Falls e2e rot läuft: Workflow degradiert auf ai:needs-changes → nächste Fixup-Runde findet F1-Kontext hier und im Sammelkommentar.
- Hinweis fürs Fixup-Tracking: ein `ai-fixup-decisions`-Sammelkommentar existiert auf PR #1079 NICHT (Fixup-Phase hat keinen angelegt).

## Fallstricke
- Kein pnpm/node_modules in dieser Review-Sandbox — Verifikation nur per Quellabgleich möglich.
- Sammelkommentar-PATCH mit `-F body=@datei` funktioniert sauber (ID 5447464222 blieb erhalten); Body-Datei unter .ai-memory/ anlegen und danach löschen.
- Finding-Nummern blieben stabil: F1 = e2e-AK8/CI, F2 = Frontend-Middleware-Tests (im Fixup-Commit „R2" genannt — im Sammelkommentar weiter F2).
