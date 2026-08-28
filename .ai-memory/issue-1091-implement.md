# Issue 1091 — Implement (Phase 4), Stand 2026-08-28

## Erledigt
- Spec-Modus: Draft-PR #1093 (Branch `vibe/fix-issue-1091-70cd86`, closingIssuesReferences=[1091], 1 Commit 069f2210) ausgecheckt.
- Quick-Check AKs: Datei `frontend/src/lib/useAddressSearch.test.ts` existiert, Test „Debounce: …" (jetzt Zeile 60–80) prüft Mock-Aufruf UND State (`suggestions`, `loading`). Ampel 🟢 (kein KI-ANALYSE-Block im Body; AKs direkt aus „Woran messen wir das?").
- Tests waren bereits GRÜN gegen die unveränderte Implementierung (Issue: „Der Hook selbst ist korrekt implementiert") → kein Produktionscode geändert, Tests (Vertrag) nicht angefasst.
- Gate lokal: `pnpm format` ✅, `prettier --check .` ✅, `pnpm lint` ✅ (server+frontend), `pnpm knip` ✅ (nur Configuration hints = pre-existing), Frontend-Suite `npx vitest run`: 447 passed / 0 failed (44+2 skipped Dateien).
- `pnpm test` (gesamt): rot NUR an `server/src/express/session.test.ts:249` „Session von Instanz 1 …" (401 !== 200) — der bekannte Redis/Umgebungs-Failure (MEMORY 2026-08-27, t.skip läuft weiter), im PR-Body dokumentiert, nicht Fix-Ziel.
- PR #1093 aus dem Draft geholt (`gh pr ready`) + Body um Implementations-Zusammenfassung + Testergebnisse erweitert.

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.test.ts:60-80` — der geänderte Debounce-Test (async, `result` destrukturiert, State-Assertions nach `await act`).
- `frontend/src/lib/useAddressSearch.ts` — Hook unverändert (Debounce + AbortController bereits korrekt).

## Annahmen
- Der schwache Charakter der neuen Assertion (`mockResolvedValue([])` → `suggestions toEqual([])` ist auch im Initial-State wahr) erfüllt die AK wörtlich („Ergebnis im State (suggestions)") — als Test-Pflege-Hinweis im PR-Body vermerkt, Test selbst nicht geändert (Separation of Duties).

## Verworfen
- Test-Verstärkung (Mock mit Treffern statt `[]`) — wäre Änderung am Spec-Vertrag; nur Test-Pflege-Bedarf dokumentiert.
- Fix von session.test.ts — pre-existing/umgebungsbedingt, außerhalb des Scopes.

## Offen
- -

## Nächster Schritt
- Review-Phase (Kreuzverhör) für PR #1093.

## Fallstricke
- `pnpm test` ist lokal durch Redis immer rot (session.test.ts) — Exit-Code bzw. Failing-Test prüfen, nicht blind auf Rot reagieren.
- Branch heißt `vibe/fix-issue-1091-70cd86` (nicht `ai/harness/1091`) — vom Ersteller des Draft-PRs so angelegt.
