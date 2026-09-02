# Issue 1186 — Triage (Phase 1), Stand 2026-09-02T23:39:07Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 23:34:29Z, keine Entscheidungen). Harness-Marker-Kommentar erstellt (issuecomment-5518035764) mit KI-ANALYSE-Block + Routing-Tabelle, Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (Endstand verifiziert). Kein Ping (CI-Regel), Titel unangetastet („Fokus-Outline im „…"-Popover der Aufgabenliste ist abgeschnitten" — korrekt), kein Body-Edit, kein Split (eine Komponente + E2E = ein PR), kein Auto-Close (Fix existiert nicht im Code).

## Erledigt
- Issue geladen (`.ai-memory/issue-1186-input.json`), Trigger = Initial-Triage bestimmt.
- Code-Recherche via recherche-Subagent: `popoverAlign.ts` komplett, TaskTree.tsx Popover-Verwendung, Style-Override-/Test-Präzedenzen, Versions-Pins, Konventionen (AGENTS.md KoliBri-First).
- Kommentar-Body nach `.ai-memory/issue-1186-comment.md` geschrieben, `gh issue comment 1186 --body-file` (HID-Lookup entfiel — kein Harness-Kommentar vorhanden).

## Relevante Stellen
- `frontend/src/lib/popoverAlign.ts:25-45` — greift bereits per `host.shadowRoot.querySelector('.kol-popover-button__popover')` auf das Panel zu, setzt Inline-Styles (Alignment, `width: max-content`, Viewport-Korrektur); HIER kommt `overflow: visible` rein (AK1). Positioning-only, kein CSS-Injection heute.
- `frontend/src/lib/popoverAlign.ts:77,86` — `setupPopoverAlignment(host)` Entry, wartet `customElements.whenDefined('kol-popover-button')`.
- `frontend/src/components/TaskTree.tsx:8,65` — einziger Call-Site (useEffect); `:118-201` das „…"-Menü (`KolPopoverButton _label="Weitere Aktionen"` + `KolToolbar`).
- `frontend/e2e/issue-930-transparent-backgrounds.spec.ts:346-361` — E2E-Vorbild: `toBeFocused` + getComputedStyle-Assertion (Shadow-DOM-piercing), kein `:focus-visible` im Repo.
- `frontend/e2e/issue-1063-geo-badge.spec.ts:180-196` — Bounding-Box-Assertions-Vorbild (AK2).
- `frontend/src/migration-check.test.ts:36-47` — verbietet `.shadowRoot` in Testdateien (helpers.ts ausgenommen; Check aktuell `.it.skip`, trotzdem beachten) → deshalb E2E- statt Unit-Tests.
- `frontend/package.json:17-19` — `@public-ui/components`/`react-v19`/`theme-default` exakt 4.3.0 gepinnt; kein vendored KoliBri-CSS.

## Annahmen
- Fix-Ort = bestehender Helper (Issue nennt diese Richtung; AGENTS.md „KoliBri-First", Shadow-DOM-CSS = unpublizierte API) — kein Upstream-Patch, kein Vendor.
- Kein UX-Lauf: reines Styling-/Clipping-Verhalten, Dialog-Struktur unverändert (Präzedenz #1095).
- „Vollständig sichtbar" ist über computed `overflow: visible` (Panel) + sichtbare Outline am fokussierten Button prüfbar; direkte Outline-Rendering-Assertion ist in Playwright nicht möglich.

## Verworfen
- Unit-Test für popoverAlign (neu `popoverAlign.test.ts`) — migration-check verbietet `.shadowRoot` in Testdateien, jsdom-Mock des Shadow-DOM wäre quer zu dieser Regel; E2E deckt ab.
- Titel-/Body-Copyedit — Issue präzise (Diagnose + Playwright-Nachweis + Fix-Richtung), nicht substantiell falsch.
- Split — ein Helper + eine Spec = ein PR (Komplexität „Einfach" lt. Autor).
- MEMORY.md-Eintrag — kein neuer Fehler, Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1186-input.json` + `issue-1186-comment.md` sind Wegwarf-Artefakte, NICHT committen (Muster #1083/#1095/#1098); nur diese Datei hier ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote E2E-Tests AK1–AK3 in neu `frontend/e2e/issue-1186-popover-focus-outline.spec.ts` (375px-Viewport-Block für AK3), Draft-PR auf `ai/harness/1186`.

## Fallstricke
- Inline-`overflow: visible` im Helper darf die bestehende Alignment-/Viewport-Logik nicht stören — Reihenfolge der Style-Zuweisungen in popoverAlign.ts beachten.
- Helper-Doc-Kommentar (popoverAlign.ts:13-14) nennt App-Avatar-Menü als weiteren Call-Site — STALE, gibt es nicht; bei Impl-Anpassung nicht „reparieren" gehen (außerhalb Scope).
- Upgrade-Warnhinweis im Helper um die Overflow-Regel erweitern (unpublizierte KoliBri-API, Re-Check bei 4.x-Upgrades).
- E2E: keine scrollWidth-Assertions (App-Shell clippt overflow-x:hidden, Memory 2026-08-24); Bounding-Box statt dessen.
- Bestehende „…"-Menü-E2Es (crud.spec.ts:85,117, keyboard-shortcuts.spec.ts:215,352, dependency-editor.spec.ts:73 …) nicht kaputtspielen — die öffnen dasselbe Popover.
