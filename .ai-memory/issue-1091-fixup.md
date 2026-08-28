# Issue 1091 — Fixup (Phase 7), Stand 2026-08-28

## Erledigt
- Findings gelesen: GENAU 1 Inline-Finding (ID 3881750192, `useAddressSearch.test.ts:80`, 🟡) — State-Assertion ohne unterscheidende Kraft, weil der Mock `[]` liefert und `suggestions toEqual []` auch im Initial-State wahr ist. Keine weiteren Threads, kein Entscheidungskommentar, kein Options-ID-Kommentar. CI des Review-SHA grün (verify ✅, e2e 1–4 ✅; skipping-Jobs sind die Phasen-Dispatcher).
- SKILL.md step 5 (cross-examination loop) + step 3c (Gate) gelesen; MEMORY.md gelesen (u. a. Fake-Timer/vitest-Reporter/Prettier-Regeln).
- Fix umgesetzt: `frontend/src/lib/useAddressSearch.test.ts` Debounce-Test — Mock statt `mockResolvedValue([])` jetzt `mockResolvedValue(treffer)` mit `treffer = results(['Musterstraße 1, Musterstadt'])` (nutzt den bestehenden `results()`-Helper des Files), Assertion `expect(result.current.suggestions).toEqual(treffer)` + `loading toBe(false)`; Kommentarzeile „State zeigt leere Vorschläge" auf die neue Begründung umgeschrieben.
- **Mutation-Check** (Biss-Nachweis): `setSuggestions(...)` im `.then` des Hooks (`useAddressSearch.ts`) temporär entfernt → genau der Debounce-Test rotiert (3 failed inkl. ihm); Hook per `git checkout` restauriert (Diff leer). Vor dem Fix hätte dieselbe Mutation den Test GRÜN gelassen — genau die Lücke aus dem Finding.
- Gate: `pnpm format` ✅, `prettier --check` ✅, `pnpm lint` ✅, `pnpm knip` ✅ (nur pre-existing Configuration hints), frontend-Suite **447 passed / 0 failed** (13 skipped), server 730 pass / 1 fail = bekanntes Redis-Env-Failure `session.test.ts` („Session von Instanz 1 ist auf Instanz 2 gültig", 401 !== 200 — CI stellt Redis als Service, pre-existing).
- Commit `8bdd6017` „test(frontend): fill debounce mock with a hit so the state assertion bites" (Test + diese Notiz) gepusht; Pre-Commit-Hook (format/knip/lint) grün durchgelaufen.
- Thread PRRT_kwDONloM186dNpap beantwortet (Reply-Kommentar 3881829649) und per `resolveReviewThread` aufgelöst (isResolved=true).
- `<!-- ai-review -->`-Sammelkommentar (issuecomment-5454298375) per PATCH aktualisiert: Finding 1 in „✅ Behobene Anmerkungen" mit SHA + Mutation-Check-Nachweis, keine offenen Findings, „Review-Typ: Fixup-Nachweis".
- Soft-Deadline (1787930891) trat direkt nach dem Push — CI des neuen SHAs (Run 33185234713: verify + e2e 1–4) war noch pending; kein Rerun angestoßen (Concurrency-Gefahr, MEMORY 2026-08-23).

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.test.ts:60-82` — der Debounce-Test; Finding-Anker Zeile 80.
- `frontend/src/lib/useAddressSearch.test.ts:35-36` — Helper `results(addresses)` (address + feste lat/lon), für die Mock-Antwort genutzt.
- `frontend/src/lib/useAddressSearch.ts` — unverändert, Issue sagt Hook ist korrekt.

## Annahmen
- Finding ist unambiguous → fixbar ohne menschliche Entscheidung (Verdict needs-fixup im ai-review-Sammelkommentar).
- Statt des wörtlichen Literals aus dem Vorschlag wird der vorhandene `results()`-Helper genutzt — gleicher Effekt (nicht-leerer Treffer), konsistenter mit Zeile 116.

## Verworfen
- Wörtliche Übernahme des Vorschlags-Literals aus dem Finding („Musterstraße 1, Musterstadt" mit lat:1/lon:2) — stattdessen der vorhandene `results()`-Helper des Test-Files; gleicher Effekt (nicht-leerer Treffer), konsistent mit Zeile 116.
- Neuer eigener Test statt Umbau des bestehenden — das Finding zielt auf die schwache Assertion IM Debounce-Test, nicht auf eine Lücke in der Abdeckung.

## Offen
- CI des Fixup-SHAs 8bdd6017 (Run 33185234713, verify + e2e 1–4) war bei Soft-Deadline noch pending — durch Test-only-Änderung mit lokal grünem Gate ist kein Fix-Risiko erwartet; nächste Runde (Fixup-Verifikation/Re-Review) prüft CI-Grün.

## Nächster Schritt
- Nächste Fixup-/Review-Runde: `gh pr checks 1093` auf Run 33185234713 prüfen; bei Rot Log lesen und fixen, bei Grün Verdict auf 🟢 heben (Sammelkommentar per PATCH, Ampel-Zeile „nach grünem CI 🟢" einlösen).

## Fallstricke
- Mutation-Check am Hook nur per `git checkout` sofort zurücknehmen — der Hook ist Produktivcode und gehört NICHT in den Fixup-Commit (Diff war danach leer).
- Branch `vibe/fix-issue-1091-70cd86` ist der Spec-Branch; ein `fixup`-Workflow-Job lief parallel auf dem PR (pending) — nach dem Push NICHT `gh run rerun --failed` absetzen (Concurrency-Cancel des neuen Runs, MEMORY 2026-08-23).
- `.ai-memory/issue-1090-*.md` liegen untracked und gehören NICHT in diesen Commit (fremdes Ticket).
- `pnpm test` bricht am Redis-Failure ab, BEVOR die Frontend-Suite läuft → Frontend-Suite separat (`npx vitest run` im `frontend`-Verzeichnis) fahren, sonst fehlt der Grün-Nachweis für die geänderte Datei.
