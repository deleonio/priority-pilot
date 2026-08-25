# Issue #1028 — Triage (2026-08-25)

## Erledigt
- Erst-Triage abgeschlossen: Titel optimiert + Body lektoriert + KI-ANALYSE-Block (stand=2026-08-25T15:01:58Z) via `gh issue edit --body-file -` in den Body geschrieben; Ping-Kommentar gepostet (issuecomment-5412410789). VERDICT: spec-ready (🟢, haiku, UI-Bezug ja, Spec nötig ja). Keine Zerlegung (1 Datei, 1 PR).

## Relevante Stellen
- `frontend/src/app.css:1879–1904` — #930-Block: globale Host-Selektoren (kol-alert …) mit transparentem Hintergrund; Anker für den neuen #1028-Block.
- `frontend/src/app.css:1482` — `.settings-switch-row kol-alert` (flex 0 1 40%): bekannter Regressionspunkt bei Breiten-/Padding-Änderungen.
- `frontend/e2e/settings-switch-layout.spec.ts` — E2E-Regressionstest für genau diese Row.

## Annahmen
- „Padding + Radius am Host" = globale CSS-Regel in app.css reicht; ~40 KolAlert-Verwendungsstellen werden nicht einzeln angefasst.
- UX/UI-Phase klärt die offene Design-Frage (sichtbare Fläche für Radius bei #930-Transparenz).

## Verworfen
- Zerlegung in Sub-Issues — Kriterium (mehrere Schichten/AKen) nicht erfüllt: eng umrissen, eine CSS-Datei.

## Offen
- -

## Nächster Schritt
- Workflow-Routing (UX/UI → Spec → Impl) auf Basis des Body-Blocks; Triage-Phase für #1028 ist fertig.

## Fallstricke
- Kein globales `box-sizing: border-box` in app.css — neues Padding kann Host-Boxen vergrößern (Flex-Aufteilungen mitprüfen).
- Radius am Host ohne sichtbare Fläche ist wirkungslos (#930-Transparenz) — Entscheidung im CSS kommentieren.
