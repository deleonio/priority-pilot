# Issue 1206 — Implementierung (Phase 4), Stand 2026-09-03

## Erledigt
- Issue zugewiesen (@me); Draft-PR **#1207** (Branch `ai/harness/1206`, closing=1206) verifiziert und ausgecheckt.
  Lokale untracked Phasen-Notizen (triage/ux/spec) waren byte-identisch mit den Branch-Blobs → gelöscht, dann sauberer Switch.
- Analyse-Block (Ampel 🟢), KI-UX-Block, Spec `docs/spec/issue-1206.md`, rote Tests gelesen: 3 Unit-rot (AK1–AK3) + 4 Unit-grün (#1190) + e2e `help-changelog.spec.ts` (AK4).
- Implementiert: `remark-gfm@^4.0.1` installiert; `frontend/src/lib/changelog.ts` NEU (`aggregateChangelog` + `entriesToMarkdown`); `HelpPage.tsx` tab-1 auf Kategorien-Sections (h2 je Kategorie) umgebaut, `MARKDOWN_COMPONENTS` (a: target=_blank+noopener) + `remarkGfm` für BEIDE Tabs; `app.css`: `a`-Regel + `:focus-visible` + `.help-changelog-category` (var(--pp-space-6)), alte `.help-changelog-entry/-date` entfernt.
- Unit-Tests: **7/7 grün** (`npx vitest run src/components/HelpPage.test.tsx`), inkl. vormals roter AK1–AK3.
- E2E: `e2e/help-changelog.spec.ts` AK4 ✓ (375px, kein Clipping inkl. Shadow-DOM) und `e2e/issue-1190-changelog.spec.ts` AK6 ✓ — beide im frontend-Verzeichnis per `npx playwright test e2e/<datei>`.
- Lint-Fix am SPEC-Test: `help-changelog.spec.ts:64-65` zwei `eslint-disable-next-line no-restricted-syntax` für `el.shadowRoot` nach Präzedenz `issue-1190-changelog.spec.ts:68-70` — KEINE Assertionsänderung, im PR-Body dokumentiert.

## Relevante Stellen
- `frontend/src/lib/changelog.ts` — reine Aggregations-Logik: `###`-Abschnitte je Body parsen (split `/^### /m`), Kategorie via NAME (ohne Emoji, lowercase) auf release.yml-Reihenfolge (`CATEGORY_TITLES`) mappen, Bullets (`- `/`* `) sammeln (eingerückte Fortsetzungen anhängen), `(vX.Y.Z)`-Suffix.
- `frontend/src/components/HelpPage.tsx` — tab-1 rendert `aggregateChangelog(releases)` als Sektionen; `MARKDOWN_COMPONENTS` Modulkonstante.
- `frontend/package.json:26` — `remark-gfm` Version 4.0.1 installiert.
- `frontend/src/app.css` (`.help-page-content`-Block) — Link-Regeln neu; `.help-changelog-category`.

## Annahmen
- Kategorie-Anzeige MIT Emoji (Original aus release.yml), Match über Namenstext.
- „** Full Changelog**:"-Zeile (ohne `###`-Header) wird nicht eingesammelt — kein Bullet, kein Verlust (AK3-Zählung passt).
- Playwright-MCP (375/1280-Screenshot-Check) ist in dieser Sandbox nicht verfügbar; deterministischer 375px-e2e (Bounding-Box inkl. Shadow-DOM) + reine vertikale Textliste decken den Layout-Break-Check — im PR-Body vermerkt.

## Verworfen
- Array.prototype-Polyfill in `changelog.ts` (erst geschrieben, sofort ersetzt) — Prototyp-Verschmutzung; plain while-Loop.

## Offen
- -

## Nächster Schritt
- Keiner — Phase abgeschlossen: Gate komplett grün (format/prettier/lint/knip/test 275/275 + Pre-Commit-Hook), Commit `b55bcc9a` (inkl. dieser Notiz) gepusht, PR **#1207** aus Draft genommen (`gh pr ready`) und Body um Implementierungs-/Gate-Sektion erweitert. VERDICT needs-review.

## Fallstricke
- Tests NICHT ändern (Separation of Duties); #1190-AK2/AK3 wurden von der Spec-Phase bereits auf neue Struktur gepflegt.
- Bullet-Zählung AK3: Fortsetzungszeilen (eingerückt) an vorherigen Bullet anhängen, sonst Verlust.
- jsdom-Tests laufen gegen `[slot="tab-N"]`-Panels — Struktur des Panels frei, solange li/h2/h3/a wie erwartet.
