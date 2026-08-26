# Issue 1034 — Implementierung (Phase 4)

## Erledigt

- Draft-PR #1035 (Branch `feat/issue-1034-pwa-mobile-buttons`) ausgecheckt, Spec-Modus bestätigt.
- `frontend/src/components/UpdatePrompt.tsx:32-45` — Texte umgestellt: `_label="Neue Version verfügbar"`
  (statt „Update"), Fließtext „Priority Pilot wurde aktualisiert. Lade die App neu, um die neue
  Version zu nutzen.", Button „Jetzt neu laden"; analog Offline-Card `_label="Offline einsatzbereit"`,
  Fließtext „Priority Pilot funktioniert ab jetzt auch ohne Internetverbindung.", Button „Verstanden".
- `frontend/src/app.css:1570-1583` — neue Regel nach `.update-prompt kol-card { pointer-events: auto }`:
  `@media (max-width: 767px) { .update-prompt kol-card span[data-testid] { display: block } .update-prompt kol-card kol-button { display: block; width: 100%; min-height: 44px } }`.
- Commit `74eec9f8` (Autor `ticket-implementation-agent@users.noreply.github.com`, siehe Fallstricke),
  gepusht, PR #1035 mit vollständiger GATE-Doku aus dem Draft geholt (`gh pr ready 1035`).
- GATE komplett grün: `pnpm format`, `pnpm exec prettier --check .`, `pnpm lint`, `pnpm knip` (nur
  bestehende Config-Hinweise, unverändert) — alle ok.
- Vitest frontend: 414 passed/13 skipped (0 failed). Server node:test: 684 passed, 1 fail
  (`server/src/express/session.test.ts` „geteilter Redis-Store" — kein Redis in Sandbox, laut
  Testmeldung selbst CI-only; unabhängig von dieser Frontend-Änderung).
- e2e **live ausgeführt** (Playwright-Browser WAR in dieser Sandbox installiert, anders als in
  Phase 3 vermerkt): `npx playwright test e2e/pwa-update-prompt.spec.ts` → 7/7 grün, inkl. der 4
  neuen AK1-AK3-Tests für #1034.

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx:32-45` — die geänderten Texte/Labels.
- `frontend/src/app.css:1570-1583` — die neue Mobile-Media-Query.
- `docs/spec/issue-1034.md` — Vertrag, unverändert übernommen.

## Annahmen

- KoliBri-Hosts (`kol-card`, `kol-button`) sind block-level (Shadow-DOM `:host{display:block}`),
  bestätigt durch grünen e2e-Lauf (AK1: Button füllt ≥90% Card-Innenbreite tatsächlich, keine
  Überraschung durch internes Slot-Padding).
- `span[data-testid]` auf `display: block` zu setzen reichte aus, um die Klickfläche auf Button-Breite
  zu bringen — kein zusätzliches `width: 100%` am Span nötig (Block-Element füllt Containerbreite
  automatisch).

## Verworfen

- Keine Anpassung an `UpdatePrompt.test.tsx` — die Spec-Phase hatte die Testpflege bereits erledigt
  (Datei unverändert in dieser Phase, nur gegengelesen).
- Impeccable-Detektor übersprungen — `.claude/skills/impeccable/` existiert in diesem Repo-Checkout
  nicht (nur 7 andere Skills unter `.claude/skills/`).

## Offen

- Server-Redis-Testfehler (`session.test.ts`) bleibt ungelöst — außerhalb des Scopes (Issue 1034 ist
  reines Frontend-Ticket), im PR-Body als Sandbox-Limitation dokumentiert.

## Nächster Schritt

- Kreuzverhör-Loop (Schritt 5 des Skills) auf PR #1035 anstoßen, falls noch nicht durch die Pipeline
  angestoßen.

## Fallstricke

- `git commit` ohne gesetzte Identität schlägt in dieser Sandbox fehl („Author identity unknown").
  Lösung: dieselbe Bot-Identität wie die Vorphase verwenden (`git log -1 --format='%an <%ae>' <sha>`
  auf einen bestehenden Commit des Tickets prüfen) und per `-c user.name=... -c user.email=...` am
  `git commit`-Aufruf mitgeben, statt global zu konfigurieren.
- `gh issue edit 1034 --add-assignee @me` schlägt mit GitHub-App-Token fehl („Assigning agents is not
  supported with GitHub App installation tokens") — nicht blockierend, einfach ignorieren/weitermachen.
- Phase-3-Notiz „Playwright-Browser nicht installiert" war sandbox-spezifisch und in dieser Phase NICHT
  mehr zutreffend (`~/.cache/ms-playwright/chromium-1234` vorhanden) — vor dem Überspringen von e2e
  immer selbst prüfen (`ls ~/.cache/ms-playwright`), nicht die alte Notiz blind übernehmen.
