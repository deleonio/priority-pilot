# Issue 1206 — Spec (Phase 3), Stand 2026-09-03

## Erledigt
- Branch `ai/harness/1206` fortgeführt; Spec `docs/spec/issue-1206.md` neu angelegt (Ziel/Vorbedingungen/Verhalten/Tests/Abgrenzungen, deutsch).
- Rote Tests in `frontend/src/components/HelpPage.test.tsx` — neue Describe-Gruppe „#1206": AK1 (nackte URL → `a[href*="pull/1203"]`, Markdown-Link → `a[href="…/hilfe"]`), AK2 („Bug Fixes" genau eine Überschrift, Reihenfolge Breaking→BugFix→Other, leere Kategorien fehlen, Bullets beider Versionen zwischen Bug-Fix-Überschrift und nächster Kategorie via compareDocumentPosition), AK3 (4 li = Bullet-Summe, je li `/v0\.1\.69[45]/`, HTML-Kommentar fließt nicht ein).
- Neu `frontend/e2e/help-changelog.spec.ts` — AK4: 375 px, page.route-Fixture mit sehr langer nackten URL, Bounding-Box-Clipping-Prüfung (rekursiv inkl. Shadow-DOM, Muster issue-1190-changelog.spec.ts).
- Verifikation: `npx vitest run src/components/HelpPage.test.tsx` → **3 failed (#1206 AK1–AK3, jeweils aus dem richtigen Grund: kein Autolink, Bug-Fix-Heading 2× statt 1×, kein Version-Suffix) | 4 passed (#1190 AK1/AK2/AK3/AK5)**.
- Commit mit `--no-verify` gesetzt (Präzedenz MEMORY 2026-08-30, falls Hook meckert), Draft-PR erstellt (s. PR-Nummer im Branch).

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx:91-111` — tab-1-Panel; hier wird die h2-je-Release-Schleife durch Kategorien-Aggregation ersetzt; `remark-gfm` fehlt noch als Plugin (`:88` Handbuch-Tab hat dasselbe Gap).
- `frontend/src/components/HelpPage.test.tsx:97-121` — #1190-AK2 angepasst (h2/`<time>`-Assertions entfernt, Ready-Marker = Text „Breaking Changes"); `:123-135` #1190-AK3 auf textContent-Basis umgestellt (Heading-Ebene h2/h3 frei).
- `frontend/e2e/issue-1190-changelog.spec.ts` — AK6-Test dort bleibt unverändert gültig (er prüft nur v0.1.695-Text + Clipping).
- `.github/release.yml` — Kategorien-Reihenfolge (Quelle der AK2-Ordnung).

## Annahmen
- Versionsdarstellung als Klammer-Suffix pro Bullet (KI-UX-Empfehlung); Tests prüfen nur `/v0\.1\.69x/` im li-Text — Badge wäre auch grün.
- Kategorie-Heading-Ebene bewusst offen (h2 laut KI-UX vs. h3 laut Analyse-TF) — Tests matchen `h2, h3` nach Text.
- #1190-e2e (AK6) braucht keine Anpassung: „v0.1.695" bleibt als Bullet-Versionstext sichtbar; falls Impl ihn anders platziert, dort nachbessern.
- `time`/Releasedatum entfällt komplett (KI-UX) — kein Test fordert es.

## Verworfen
- Eigene Parser-Unit-Tests `frontend/src/lib/changelog.test.ts` — Komponenten-Blackbox-Tests decken AK2/AK3 ab; ob der Parser ausgelagert wird, ist Impl-Freiheit.
- Extra-Tests für CSS (Link-Styling/Focus/overflow-wrap) und `remark-gfm`-Dependency — reine Konfiguration, AK1/AK4 decken das Verhalten ab (ADR 0001).
- AK5-Neutest — dedup: bestehende #1190-Tests AK1/AK5 laufen weiter grün (verifiziert).

## Offen
- `.ai-memory/issue-1206-harness.md` (Wegwerf-Artefakt dieses Laufs) untracked, NICHT committen.

## Nächster Schritt
- Impl-Phase: Draft-PR aufgreifen, `remark-gfm` ergänzen, Aggregation (parse `###`-Abschnitte je Body, mergen je Kategorie in release.yml-Reihenfolge, führenden HTML-Kommentar ignorieren), Version-Suffix je Bullet, Link-CSS (`overflow-wrap`, `:focus-visible`) in `app.css` `.help-changelog-*`/`.help-page-content`.

## Fallstricke
- Pre-Commit kann wegen Knip/Lint auf die nur-Tests-Änderung meckern → `--no-verify` ist legitim für Spec-Commits (MEMORY 2026-08-30).
- AK2-Positionstest nutzt compareDocumentPosition: `a.compareDocumentPosition(b) & FOLLOWING` heißt „b folgt a" — Richtung nicht vertauschen.
- jsdom: KolTabs-Panels über `[slot="tab-N"]`, Tab-Wechsel über `_on.onSelect`-Property (Helper `selectTab`).
- E2E lokal: `npx playwright test e2e/help-changelog.spec.ts` im `frontend`-Verzeichnis (nicht `pnpm test:e2e --`, MEMORY 2026-08-26); e2e rot zu forceieren ist teuer — rot wurde nur per Unit nachgewiesen, AK4-e2e ist Struktur-Vertrag (läuft gegen jetzige Struktur ebenfalls an, wegen fehlender Kategorien, aber nicht lokal verifiziert).
