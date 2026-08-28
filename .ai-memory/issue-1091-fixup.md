# Issue 1091 — Fixup (Phase 7), Stand 2026-08-28

## Erledigt
- Findings gelesen: GENAU 1 Inline-Finding (ID 3881750192, `useAddressSearch.test.ts:80`, 🟡) — State-Assertion ohne unterscheidende Kraft, weil der Mock `[]` liefert und `suggestions toEqual []` auch im Initial-State wahr ist. Keine weiteren Threads, kein Entscheidungskommentar, kein Options-ID-Kommentar. CI des Review-SHA grün (verify ✅, e2e 1–4 ✅; skipping-Jobs sind die Phasen-Dispatcher).
- SKILL.md step 5 (cross-examination loop) + step 3c (Gate) gelesen; MEMORY.md gelesen (u. a. Fake-Timer/vitest-Reporter/Prettier-Regeln).
- Fix umgesetzt: `frontend/src/lib/useAddressSearch.test.ts` Debounce-Test — Mock statt `mockResolvedValue([])` jetzt `mockResolvedValue(treffer)` mit `treffer = results(['Musterstraße 1, Musterstadt'])` (nutzt den bestehenden `results()`-Helper des Files, Kommentar im Inline-Finding vorgeschlagene freie Variante), Assertion `expect(result.current.suggestions).toEqual(treffer)` + `loading toBe(false)`; Kommentarzeile „State zeigt leere Vorschläge" auf die neue Begründung umgeschrieben.
- Ergebnis: (hier nach Testlauf aktualisieren)

## Relevante Stellen
- `frontend/src/lib/useAddressSearch.test.ts:60-82` — der Debounce-Test; Finding-Anker Zeile 80.
- `frontend/src/lib/useAddressSearch.test.ts:35-36` — Helper `results(addresses)` (address + feste lat/lon), für die Mock-Antwort genutzt.
- `frontend/src/lib/useAddressSearch.ts` — unverändert, Issue sagt Hook ist korrekt.

## Annahmen
- Finding ist unambiguous → fixbar ohne menschliche Entscheidung (Verdict needs-fixup im ai-review-Sammelkommentar).
- Statt des wörtlichen Literals aus dem Vorschlag wird der vorhandene `results()`-Helper genutzt — gleicher Effekt (nicht-leerer Treffer), konsistenter mit Zeile 116.

## Verworfen
- -
## Offen
- -
## Nächster Schritt
- Test lokal grün fahren, Gate (format/prettier/lint/knip/test) laufen lassen, commit+push inkl. dieser Notiz, Thread beantworten+auflösen, ai-review-Sammelkommentar per PATCH auf Fixup-Verifikation (Runde 2) updaten.

## Fallstricke
- Branch `vibe/fix-issue-1091-70cd86` ist der Spec-Branch; ein `fixup`-Workflow-Job läuft bereits parallel auf dem PR (pending) — nach dem Push auf Concurrency-Cancel achten (MEMORY 2026-08-23: kein Rerun direkt nach Push).
- `.ai-memory/issue-1090-*.md` liegen untracked und gehören NICHT in diesen Commit (fremdes Ticket).
