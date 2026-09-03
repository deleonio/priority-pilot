# Issue 1190 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-03

**ERGEBNIS: VERDICT reviewed, Ampel 🟢, keine Findings.** Gesamter PR #1203-Diff adversarial geprüft (MODE=CROSS-EXAMINATION, kein vorhandener `<!-- ai-review -->`-Kommentar). Titel auf Conventional Commits umbenannt (`feat(frontend): changelog tab next to manual on help page (#1190)`). Sammelkommentar mit Marker einmalig erstellt.

## Erledigt
- Modus bestimmt: kein `<!-- ai-review -->` in PR-Kommentaren (API-Suche leer) → Kreuzverhör des Gesamtdiffs.
- AKs aus Harness-Kommentar (KI-ANALYSE stand 2026-09-03T10:42:00Z) geladen: AK1–AK6; Abgleich mit Diff + Tests: alle gedeckt, AK4 bewusst ohne Test (upstream release.yml, ADR 0001) — akzeptiert, in Spec + PR-Body begründet.
- **Trennung der Rollen verifiziert:** `git diff 4325100c 06bfd404 -- HelpPage.test.tsx issue-1190-changelog.spec.ts docs/spec/issue-1190.md` = leer → rote Spec-Tests unverändert grün umgesetzt.
- CI geprüft: `gh pr checks 1203` — verify **pass**, e2e (1)–(4) **pass**, review pending (= dieser Lauf). HelpPage.tsx final gelesen (Ist-Stand = Diff, Zeilen stimmen).
- Musterabgleich: `SettingsPage.tsx:243-248` nutzt identisches KolTabs-Muster (`_selected={activeTab}`, `_on={tabsCallbacks}`, Modulkonstante) → keine Abweichung. `App.tsx:570-571` Mount unverändert, Props (`onBack`) stabil.
- Kreuzverhör-Fragen durchlaufen: Race/Re-Entrancy (`loading`-Guard verhindert Doppelfetch; Retry nur bei `idle|error`), Fehlerpfad (r.ok-false + Reject → error-State, Meldung analog Handbuch-Fallback), unmount-während-Load (React-18-No-op, unkritisch), Rate-Limit (lazy + Caching nach Erfolg), XSS (ReactMarkdown ohne rehype-raw → rohes HTML im Release-Body wird nicht gerendert), `key={tag_name}` unique. Kein Test-Pflege-Bedarf (help.spec.ts #256 in CI grün, keine obsolete Aussage).

## Relevante Stellen
- `frontend/src/components/HelpPage.tsx:56-69` — Kern der Lazy-Logik (`useMemo` auf `[changelog.status]`), geprüfter Hauptpunkt.
- `frontend/src/components/HelpPage.test.tsx:460-467` — `selectTab`-Helper (Property-Pfad auf nicht upgegradetem kol-tabs), Tests nicht tautologisch (DOM- + fetch-Call-Assertions).
- `frontend/e2e/issue-1190-changelog.spec.ts:357-380` — Bounding-Box-Overflow-Check inkl. Shadow-DOM, gescoped auf `<main>`; Fixture mit langem Code-Span gibt dem Check Zähne.
- `docs/spec/issue-1190.md` — Vertrag AK1–AK6 + Abgrenzungen (Leerzustand/Pagination bewusst kein AK).

## Annahmen
- CI-Grün (verify + e2e) + PR-Body-Gate-Protokoll (275/275 Unit) als Testnachweis akzeptiert; Unit-Suite nicht lokal neu laufen gelassen (Zeitbudget, CI deckt ab).
- TZ-Fragilität des de-DE-Datums-Unit-Tests („2.9.2026") ist für `10:00:00Z` robust über ±13 h Zonen; CI ist UTC — kein Finding (auch in implement-Notiz als Annahme verankert).

## Verworfen
- Finding „Fehlermeldung als plain `<p>` statt KolAlert" — KI-UX-Block hat Plain-Fallback explizit als gleichwertig benannt, Bestands-Präzedenz HelpPage.tsx:49.
- Finding „Leerstand bei 0 Releases" — Spec-Abgrenzung: bewusst kein AK.
- Memory.md-Eintrag — kein neues Fehlermuster aufgetreten; Kriterium nicht erfüllt.

## Offen
- `.ai-memory/issue-1190-review-comment.md` (Sammelkommentar-Body) ist Wegwerf-Artefakt — NICHT committen.

## Nächster Schritt
- Workflow: Gate/auto-merge (CI + Review grün → `ai:ready-to-merge`); danach Documenter-Phase.

## Fallstricke
- Für einen Fixup-Fall (sollte jemand doch noch pushes machen): MODE dann FIXUP VERIFICATION — Sammelkommentar per API suchen (Marker `<!-- ai-review -->`), nicht neu erstellen; Diff nur seit `updatedAt`.
- Bei Fixup-Runden Finding-Nummerierung stabil halten (erste Runde hatte keine nummerierten Findings).
