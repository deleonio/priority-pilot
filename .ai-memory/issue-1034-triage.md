# Issue 1034 — Triage (Phase 1)

## Erledigt

- Erst-Triage (kein `<!-- KI-ANALYSE:START -->` im Body, 0 Kommentare).
- Komponente gefunden: `frontend/src/components/UpdatePrompt.tsx` (Update- und Offline-Card).
- CSS gefunden: `frontend/src/app.css:1555-1572` (`.update-prompt`, `position: fixed`, `bottom: 0`,
  `pointer-events: none` am Container, `auto` auf `kol-card`).
- Titel korrigiert (Tippfehler + Offline/Text-Anteil fehlte).
- KI-ANALYSE-Block in den Body geschrieben, Ampel 🟢, VERDICT spec-ready.

## Relevante Stellen

- `frontend/src/components/UpdatePrompt.tsx:29-48` — die zwei `KolCard`-Blöcke mit den zu
  ändernden Texten ("Neue Version verfügbar" / "App ist offline-bereit") und den
  `<span data-testid="pwa-update-reload|pwa-offline-close">`-Klick-Wrappern.
- `frontend/src/app.css:1555` — `.update-prompt`; hier fehlen jegliche Mobile-Regeln
  (kein Media-Query, keine Button-Breite, kein 44px-Target).
- `frontend/src/components/UpdatePrompt.test.tsx:92,102,131,186` — bestehende Vitest-Tests,
  klicken die `data-testid`-Wrapper; Textänderungen brechen dort Assertions.
- `frontend/e2e/pwa-update-prompt.spec.ts:54-91` — Präzedenz: der echte SW-Update-Zyklus ist in
  Playwright nicht reproduzierbar, deshalb wird ein **Stellvertreter-Element** mit
  `className = 'update-prompt'` ins geladene Dokument injiziert und der CSS-Kontrakt gemessen.
- `frontend/e2e/issue-996-pillar-row-mobile.spec.ts:26-31` — Muster für Mobile-AKs:
  `MIN_TARGET_PX = 44`, Bounding-Box-Messung statt `scrollWidth`.
- `.github/workflows/01-claude-triage.yml:376-430` — der Workflow setzt die Labels SELBST aus dem
  VERDICT (`ai:analysed`, bei spec-ready + UI-Bezug `ai:needs-ux-ui`). Agent darf keine Labels setzen.

## Annahmen

- Breakpoint-Konvention des Repos ist `@media (max-width: 767px)` (`app.css:977`).
- KoliBri-Hosts sind block-level und füllen 100 % Breite (MEMORY 2026-08-24) — die Button-Breite
  muss deshalb explizit am Host gesetzt werden, nicht am Shadow-Button.
- Die konkreten Textvorschläge im Analyse-Block sind ein Vorschlag; Phase 02 (UX) darf sie schärfen.

## Verworfen

- `VERDICT: needs-human` — der Auftrag ist auflösbar: "mobil bedienbar" = 44px-Tap-Target +
  volle Breite (WCAG 2.5.8, im Repo etabliert), "menschlich beschreibender Text" ist als
  konkreter Vorschlag formulierbar und geht ohnehin durch die UX-Phase.
- e2e-Test über den echten Service-Worker-Update-Zyklus — laut
  `frontend/e2e/pwa-update-prompt.spec.ts:5-13` nicht deterministisch.
- `scrollWidth <= viewport` als Overflow-AK — App-Shell clippt mit `overflow-x: hidden`
  (MEMORY 2026-08-24), der Test hätte keinen Biss.

## Offen

- Streudatei `.ai-memory/tmp-body-1034.md` liegt untracked im Working Tree (fällt NICHT unter
  `.gitignore:4 .ai-memory/issue-*.md`). `rm`/`mv` wurden vom Permission-Layer abgelehnt.
  → Nächste Phase mit Commit-Auftrag: Datei löschen oder nicht mitcommitten.

## Nächster Schritt

- Phase 02 (UX): Wortlaut der vier Texte (2× Card-Label, 2× Fließtext, 2× Button-Label) festzurren.

## Fallstricke

### MEMORY.md-Kandidat (Triage darf nicht committen — AGENTS.md, Abschnitt Memory)

- 2026-08-26 · Bash-Tool/Issue-Body — Heredoc mit Markdown-Body scheiterte am Bash-Tool-Parser
  ("Parser skipped input between top-level statements"), und `Write` nach `/tmp` ist gesperrt
  (nur das Working Directory ist beschreibbar; `mv` dorthin ebenfalls blockiert). → Scratch-Body
  per `Write` in eine Datei UNTERHALB des Repos legen, die auf ein `.gitignore`-Muster passt
  (hier `.ai-memory/issue-<N>-*.md`), dann `gh issue edit --body-file <pfad>`. Ein Name ausserhalb
  des Musters bleibt als untracked Streudatei liegen, weil `rm` Approval braucht.

- Textänderung in `UpdatePrompt.tsx` bricht bestehende Assertions in `UpdatePrompt.test.tsx` —
  die Datei muss mitgezogen werden.
- Der Klick-Wrapper-`<span>` ist Absicht (JSDOM kann `KolButton._on.onClick` nicht auslösen);
  nicht "aufräumen". Wird der Button per CSS auf volle Breite gebracht, muss auch der `<span>`
  Block/volle Breite bekommen, sonst bleibt die Klickfläche schmal.
- `.update-prompt` hat `pointer-events: none`; nur `kol-card` bekommt `auto` zurück. Neue
  Kind-Elemente ausserhalb der Card wären unklickbar.
