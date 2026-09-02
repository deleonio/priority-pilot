# Issue 1169 — Fixup (PR #1177), Stand 2026-09-02

**ERGEBNIS: Beide Review-Findings behoben, Commit gepusht, Threads aufgelöst.** Keine Entscheidungs-Findings, kein needs-human. Review-Befund war: 2 strukturell rote Spec-E2Es (AK3/AK5) — Prämissen der Spec-Phase, nicht der Impl; Fixes folgen exakt den Inline-Vorschlägen des Reviews.

## Erledigt
- Findings SCOPED gelesen: ai-review-Sammelkommentar (needs-fixup, 2 offene Findings, 0 Entscheidungs-Findings) + 2 Inline-Threads (beide `frontend/e2e/issue-1169-confetti.spec.ts`, Anchor 137/151). Kein Konflikt (Working Tree clean auf `ai/harness/1169`).
- **Finding 1 (AK3):** API-`setStatus(...,'Done')` ersetzt durch UI-Weg (`seedOpenTask` → Popover → Erledigt → `expect.poll` Done). KEIN Warten auf Overlay-Selbstabbau vor dem Reopen — erster Versuch damit rot: nach ~5 s Konfetti-Warten hat die Liste neu geladen und die Done-Zeile entfernt („Noch keine Tasks vorhanden", Popover weg). Stattdessen Overlay-`count()` VOR dem Reopen merken (`overlaysBeforeReopen`) und nach Reopen + 1 s auf gleichen Wert asserten (der Vorschlag „Overlay-Referenz merken" aus dem Inline-Kommentar).
- **Finding 2 (AK5):** Task B wird jetzt VOR `page.goto` per API geseedet (A + B → gemeinsames `goto`/`waitForStableView`/`openTasksTab` → beide Zeilen sichtbar), statt nach der Navigation zu erzeugen (Liste pollt nicht).
- `setStatus`-Hilfsfunktion entfernt (danach unbenutzt, wäre Lint-Fehler).
- Verifikation: `npx playwright test e2e/issue-1169-confetti.spec.ts` im `frontend`-Verzeichnis → **6/6 grün** (27 s). Gate (via gate-runner): format/prettier/lint/knip/`pnpm --filter frontend test` alle exit 0 (knip nur Konfig-Hints = bekannter Zustand; volles `pnpm test` bewusst lokal nicht gerannt — session.test.ts braucht Redis-Service, dokumentierte pre-existing-Limitation, CI stellt Redis).
- Commit + Push auf `ai/harness/1169`, beide Review-Threads per GraphQL `resolveReviewThread` aufgelöst.

## Relevante Stellen
- `frontend/e2e/issue-1169-confetti.spec.ts:120` — AK3-Test (neu: UI-Done + count-Differenz-Assertion).
- `frontend/e2e/issue-1169-confetti.spec.ts:150` — AK5-Test (beide Tasks vor Navigation geseedet).
- `frontend/e2e/done-toggle.spec.ts:104-110` — Vorbild Reopen-Pattern (Popover bleibt offen, #387); funktioniert NUR ohne mehrsekündige Pause dazwischen.
- `frontend/e2e/helpers.ts` — `waitForStableView` (unverändert benutzt).

## Annahmen
- AK3-Count-Beweisführung (kein NEUES Overlay statt `count === 0`) ist vom Review ausdrücklich als Alternative vorgeschlagen („Overlay-Referenz merken bzw. zählen") — Vertragsabweichung vom Spec-Wortlaut ist damit gedeckt.
- Review-Runde 2 (Kreuzverhör des neuen Diffs) läuft als nächster Workflow-Schritt automatisch; dieser Fixup-Rundlauf endet ohne VERDICT (Commits bestimmen den Fortschritt).

## Verworfen
- AK3 mit Warten auf Overlay-Selbstabbau (AK2-Muster, `toBeHidden` 6,5 s) — praktisch rot gelaufen: Liste refresht und entfernt die Done-Zeile, Popover weg, Toggle nicht mehr findbar. Nicht nochmal versuchen.
- „Erledigte Aufgaben anzeigen"-Checkbox als Weg, die Done-Zeile fürs Reopen sichtbar zu halten — nicht geprüft; der schnelle Reopen aus done-toggle.spec.ts reicht und ist Präzedenz.
- `pnpm test` lokal voll — Redis-abhängiges session.test.ts macht die Suite lokal rot (MEMORY 2026-08-27/29), CI hat den Service.

## Offen
- CI auf dem Fixup-Commit beobachten (Push passiert am Lauf-Ende; falls rot: nächster Lauf behandelt Schritt 5).

## Nächster Schritt
- Review-Runde 2 abwarten/auslösen:Wenn 🟢 + keine offenen Findings → Fixup-Loop beendet.

## Fallstricke
- In AK3 KEINE mehsekündige Wartephase zwischen Done-Klick und Reopen-Klick einbauen (Zeile verschwindet durch Listen-Refetch).
- `setStatus`-Hilfsfunktion nicht wieder einführen: per API auf Done gesetzte Tasks sind im Aufgaben-Tab unsichtbar (GET /forest liefert nur offene) — genau das war Finding 1.
- Tasks in AK5 erst nach `page.goto` anlegen → Zeile erscheint nie (kein Polling) — genau das war Finding 2.
