# Issue 1118 — Review (PR 1120), Runde 3, Stand 2026-08-29T11:5xZ

**ERGEBNIS: VERDICT reviewed, Ampel 🟢.** Runde 3 = Fixup-Nachweis über Commit `28b7111c` (einziger Code-Commit seit Runde 2). **Sammelkommentar (ID 5461790301) war zerschossen** — Body literarisch `@/tmp/ai-review-1120.md`, weil Runde 2 `gh api -f body=@file` (kleines -f postet literal, nur `-F` liest `@file`) benutzt hatte; der Workflow dokumentierte das als Fallback-Marker-Kommentar (5462165596, 11:37:04Z). Body rekonstruiert und mit `-F body=@` wiederhergestellt (verifiziert: Marker + 2370 Zeichen, gleiche ID).

## Erledigt
- MODE: Marker-Kommentar gefunden → Fixup-Verifikation; Closing-Issue #1118 vorhanden (kein „Review ohne Issue“).
- Delta-Scoping: seit updatedAt 11:35:45Z genau 1 Commit = `28b7111c` (11:40:11Z, `frontend/src/app.css` +5/−1) → begutachtet, kein erneutes Gesamtkreuzverhör.
- Fixup verifiziert gegen die Messstelle: `frontend/e2e/issue-1042-dashboard-start-button.spec.ts:42-56` (`innerWidth = rect.width − paddingLeft − paddingRight`, Border INKLUSIVE) + `:69-77` (AK1, 375px, Toleranz 2 px, Button via Flex-stretch = Content-Box). Mit 6-px-`border-left` war die Differenz exakt 6 px → rot; mit `box-shadow: inset 0.375rem` + `padding-left: calc(var(--pp-gap-base) + 0.375rem)` ist `innerWidth` == Buttonbreite (Differenz 0) → grün. Akzent bleibt sichtbar (inset-Schatten malt über background), Wash/Tinte unverändert im Card-Inhalt (`app.css:526-535`), Kontrast-Fix der Runde 2 unberührt.
- Neighborhood per Haiku-Subagent (SKILL-Delegation): AK1-Messung, kein globales `box-sizing` in app.css (für `getBoundingClientRect` ohne Belang), Signal-Tokens `--pp-signal #f2b155 / -ink #8a4b00 / -wash #fdf3e3` (`app.css:22-24`), keine weiteren padding-Regeln auf den beiden Klassen, `Dashboard.tsx:186/192-197` (Content mit KolButton „Jetzt starten“), `:182` (empty = `<p>` ohne Button).
- Sammelkommentar 5461790301 gepatcht: Review-Status (Runde 3, Wiederherstellung erwähnt), Behobene-Anmerkungen-Tabelle (3 Zeilen: Runde-2-Fix Kontrast, Runde-2-Fix AK2-Messkonvention, Runde-3 CI-Gate-Befund border-left), keine Entscheidungs-/offenen Findings, Footer `Review-Typ: Fixup-Nachweis`, Updated 2026-08-29.
- Titel-Gate: `feat(frontend): render dashboard sections as equal-height Kolibri cards` (71 Z., conventional, lowercase) → kein Rename. Keine Inline-Kommentare (0 Findings), keine Labels gesetzt.

## Relevante Stellen
- `frontend/src/app.css:526-538` — Signal-Block; Runde-3-Änderung = `border-left` → `box-shadow: inset` + `padding-left: calc(...)`.
- `frontend/e2e/issue-1042-dashboard-start-button.spec.ts:42-56` — Messkonvention (Border in rect.width enthalten); Grund, warum der Rahmen 6 px Differenz erzeugte und der Schatten 0.
- `frontend/e2e/issue-1118-dashboard-section-cards.spec.ts:94,145` — von Runde 2 umgestellte AK2-Asserts (unverändert von `28b7111c`).
- Sammelkommentar ID 5461790301 — via `gh api --method PATCH … -F body=@.ai-memory/issue-1118-review-comment.md`.

## Annahmen
- „Lokal grün (15/15)“ im Commit-Body von `28b7111c` nicht selbst nachgefahren (Chromium-Kosten); CI-e2e (4 Shards) läuft am Head, nichts rot → 🟢 nach SKILL-Regel zulässig, Merge entscheidet `gate-merge`.
- Runde-2-Tabellenzeilen aus `issue-1118-review.md` (Runde-2-Stand) übernommen — der ursprüngliche Kommentarbody war vor dem Patch nicht mehr lesbar.

## Verworfen
- Kosmetik-Finding zur 6-px-Schattenleiste an der 8-px-Rundung (leichter Verlauf an den Ecken) — rein optisch, kein AK-Bezug, Pseudo-Finding.
- Erneutes Gesamtkreuzverhör — Marker vorhanden, Diff-Scoping per SKILL step 5.
- MEMORY.md-Eintrag „kol-card übermalt Host“ — bereits repo-seitig dokumentiert (app.css:515-Kommentar).

## Offen
- `.ai-memory/issue-1118-review-comment.md` = Wegwerf-Artefakt (Body-Quelle für den PATCH), NICHT committen. Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Keine weitere Review-Aktion; Merge entscheidet der Gate (verify + e2e am `28b7111c`).

## Fallstricke
- **`gh api -f body=@file` postet den Literal-String `@pfad`** (hat Runde 2 den Sammelkommentar zerstört) — nur `-F`/`--field` mit `@` liest Dateien; Ergebnis nach jedem PATCH gegenlesen.
- CI-spezifische Zeile 2 des Sammelkommentars (PR #1120 + Issue #1118) nicht vergessen — der Workflow-Verifier testet u. a. `Entscheidungs-Findings` wörtlich (deutsche Headings beibehalten).
- Zwei Stop-Guard-Kommentare (11/12 Commits > 10) im PR sind Workflow-Signale, keine Review-Objekte; die Fixup-Begründung steht im Owner-Kommentar 5462121780 (11:31:18Z) + Commit-Body.
