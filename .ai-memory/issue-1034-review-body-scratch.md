<!-- ai-review -->

**PR #1035** — Issue #1034 (PWA-Update-/Offline-Hinweis: mobile Bedienbarkeit + beschreibende Texte)

## 🎯 Review-Status

**needs-fixup** — Erstreview (Kreuzverhör), ein fixbares Finding zur Mobile-First-Konvention.

## 📋 Offene Findings

**Finding 1 (🟡, needs-fixup) — Mobile-First-Verstoß in `frontend/src/app.css:1577-1587`**

Die neue Regel für die Vollbreite-/44px-Tap-Fläche nutzt `@media (max-width: 767px)` (Desktop-Downgrade), obwohl `.ai-knowledge/project.md` § Mobile-First (Frontend) explizit eine Aufwärts-Kaskade (`min-width`) vorschreibt: Basis-Styles für den schmalsten Viewport, breitere Layouts nur additiv per `min-width`. Die Datei selbst zeigt an anderer Stelle (Zeile 977) bereits dasselbe Anti-Pattern — dieser PR verfestigt die Abweichung, statt sie einzuhalten. AK1 (375px) und AK3 (1280px, prüft nur Position/Bottom von `.update-prompt`, nicht die Button-Breite) lassen beide Richtungen zu, ein Fix ist also ohne Testanpassung möglich.

Vorschlag: Vollbreite/44px-Regel als Basis-Stil (ohne Media-Query) für `.update-prompt kol-card span[data-testid]` und `.update-prompt kol-card kol-button` setzen, ab `@media (min-width: 768px)` auf die kompakte Desktop-Darstellung zurücksetzen. Siehe Inline-Kommentar.

*(Kleinere Randnotiz, kein eigenes Finding: Der PR-Body begründet nicht explizit, warum eigenes CSS statt einer KoliBri-Vollbreiten-Prop nötig ist — geprüft via `kolibri-mcp`: `kol-button` hat keine `_block`/Vollbreite-Prop, nur `_inline` (Standard `false`, erzwingt bereits ≥44px, aber keine Vollbreite). Die Eigenständigkeit ist also sachlich gerechtfertigt, eine kurze Zeile im PR-Body wäre trotzdem sauberer.)*

## Sonstiges

- Tests: AK1-AK6 sind durch grüne Vitest- (frontend/src/components/UpdatePrompt.test.tsx) und e2e-Tests (frontend/e2e/pwa-update-prompt.spec.ts, laut PR-Beschreibung 7/7 live gelaufen) abgedeckt, TDD-Trennung (Spec-Commits vs. Implementierungs-Commit) eingehalten.
- Test-Pflege: obsolete Stichwort-Assertions wurden bereits in der Spec-Phase entfernt/nachgezogen (`docs/spec/issue-1034.md` „Test-Pflege-Bedarf"), keine offenen Widersprüche gefunden.
- Titel war nicht Conventional-Commits-konform (deutsch, kein `type(scope):`) — umbenannt zu `feat(frontend): improve pwa update/offline prompt tap targets and copy`.

---
Review-Typ: Kreuzverhör
Updated: 2026-08-26
