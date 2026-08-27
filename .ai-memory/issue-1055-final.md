# Prompt-Audit 2026-08-27

## Gesamturteil
Die Prompts sind insgesamt schlank und folgen dem Muster „CI-Prompt = Operationalisierung, SKILL.md = Methode" — aber gerade implement.md, review.md, fixup.md und ux.md wiederholen Regeln, Befehlsketten und Prüffragen fast wortwörtlich aus der jeweils eigenen (laut Prompt Pflicht-)Lektüre des SKILL.md. Größter Hebel: konsequente Referenz statt Wiederholung (~3,5 kB von 22,8 kB Prompt-Korpus ≈ 15 % Initialkontext pro Phase). Dazu ein toter Werkzeugpfad (Impeccable-Detektor) und eine echte Widerspruchsstelle in triage.md (Kommentar-Leseumfang), die Laufzeit-Tokens verbrennt.

## .github/prompts/ux.md — 🟡
- „- .ai-knowledge/ux-design.md — what it looks like: color roles, scale tokens, component choice (KoliBri first) / - docs/mobile-ui-rules.md — how it's operated: mobile-first, touch zones (≥44px), thumb reach, async states, anti-patterns" — **Redundanz**: Der Quellen-und-Inhalts-Katalog steht bereits als „Mandatory sources" wortgleich in .claude/skills/ticket-ux/SKILL.md (dort inkl. derselben Beschreibungen). Zeile 3 erklärt SKILL.md selbst zu „binding, not repeated here" — dann wird er doch wiederholt. → Schritt 4 kürzen auf: „Read the rule sources per SKILL.md (Mandatory sources); KoliBri-Doku via mcp__kolibri-mcp__search/fetch." — Ersparnis ~450 B (inkl. des doppelt genannten KoliBri-MCP-Punkts, der auch in SKILL.md → Tools steht).
- „The UX review runs BEFORE the spec." — Bedienfreie Trivia: die Reihenfolge steuert das Workflow-Label, nicht der Agent. → streichen (~45 B).
- „(ux-ready = UX review written → issue ready for implementation; ux-not-ready = UX unclear …)" — Workflow 02 (L. 189) parst nur den Token; die Semantik steht in SKILL.md → „Verification & label setting". → Klammerinhalte streichen (~160 B).

## .github/prompts/spec.md — 🟡
- „SPEC-FIRST — update the specification BEFORE deriving tests (rule: SKILL.md step 2): check docs/spec/*.md, extend the existing one or create a new one, in the same commit as the tests." — **Redundanz**: nahezu wortgleiche Zusammenfassung von SKILL.md Schritt 2 (ls docs/spec/*.md, erweitern/neu, same commit). Schritt 4 derselbe Prompt macht es richtig („rules incl. dedup, mutation check, spec-PR scope: SKILL.md step 3"). → auf „SPEC-FIRST per SKILL.md step 2." kürzen (~180 B).
- „(ready = red tests written + draft PR created → releases the issue for implementation; spec-partial = partial …)" — doppelt zur HONESTY RULE drei Zeilen tiefer („ONLY if the draft PR actually exists AND at least one test file has been committed+pushed"). → Klammerinhalte streichen, HONESTY RULE bleibt (~130 B).
- 🟢 am PROCEDURE-Skelett selbst (Branch/Resume/Draft-PR-Logik ist CI-spezifisch, steht so nicht im SKILL).

## .github/prompts/implement.md — 🟡
- „pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test" — **Redundanz**: Befehlskette steht wortgleich in .claude/skills/ticket-implementation/SKILL.md Schritt 3c, den der Prompt (Zeile 6) explizit lesen lässt — doppelt im Kontext. → „GATE (SKILL.md step 3c), every command green BEFORE the push." (~120 B).
- „e2e (pnpm --filter frontend test:e2e) ONLY if the change affects UI behavior and an e2e spec exists for it — otherwise skip and note it in the PR body." — **Redundanz**: 1:1 aus SKILL.md Schritt 3c („e2e: … ONLY if the change affects UI behavior and an e2e spec exists for it — otherwise skip and note it in the PR body"). → „e2e-Regel: SKILL.md step 3c." (~190 B).
- „Idempotency: a draft PR with Closes #{{ISSUE_NR}} is the normal spec handoff — pick it up. A non-draft PR = implementation already ran → end the run." — **Redundanz**: doppelt zu SKILL.md Schritt 1 („Idempotency: …") und zum eigenen Schritt 3 desselben Prompts. → streichen (~230 B).
- „(AGENTS.md requirement: document format/lint/test results)" — die Kernregel steht wortlich in der (automatisch geladenen) AGENTS.md („Jeder PR führt pnpm format, pnpm lint und pnpm test aus … und dokumentiert die Ergebnisse in der PR-Beschreibung"). → nur der Verweis „(AGENTS.md)" bleibt (~90 B).
- **Korrektheit**: „deterministic tools first — Impeccable detector + mobile-ui-rules.md" — `.claude/skills/impeccable/` existiert im Repo nicht (auch der Skriptpfad in SKILL.md 3c ist tot). Der Agent sucht ein nicht vorhandenes Werkzeug. → Detector-Nennung streichen oder Pfad reparieren.
- **Präzision**: Nummerierung „3., 3b., 3.5., 4." — zwei parallele Nummerierungsschemata (3b/3.5). → einheitlich 3a/3b/3c.

## .github/prompts/fixup.md — 🔴
- **Toter Befehl**: „`node .claude/skills/impeccable/scripts/detect.mjs <files…>`" — Pfad existiert nicht (Skill-Ordner fehlt komplett). Der Fixup-Lauf stößt auf einen fehlschlagenden Befehl oder verbraucht Turns mit der Suche. → Befehl streichen, bis das Werkzeug wieder existiert; Deterministische Vorprüfung = docs/mobile-ui-rules.md.
- „run the GATE (`pnpm format && pnpm exec prettier --check . && pnpm lint && pnpm knip && pnpm test` — everything green before the push …)" — **Redundanz**: dritte wortgleiche Kopie der Kette (SKILL.md 3c, implement.md). → „run the GATE (SKILL.md step 3c) — alles grün vor dem Push, sonst dreht die Loop weiter." (~110 B).
- „Playwright MCP only for the short 375/1280 layout-break check, not for design analysis. Fix layout breaks, KoliBri-first" — **Redundanz**: nahezu wortgleich SKILL.md Schritt 3c. → „UI-Prüfreihenfolge: SKILL.md step 3c." (~200 B).

## .github/prompts/review.md — 🟡
- „Check adversarially: does the PR fully solve the problem? Edge cases? Simplest path? Performance/security?" + Regression-Absatz „(Obsolete tests should already have been removed at the spec stage; if there's a contradiction → finding "Test-Pflege-Bedarf" …)" — **Redundanz**: die Prüffragen und der Regression-/Test-Pflege-Absatz stehen (ausführlicher, mit derselben Test-Pflege-Bedarf-Regel) in review-kreuzverhoer/SKILL.md Schritt 2, den Zeile 1 als Methode deklariert. → „Cross-examination questions incl. regression/Test-Pflege-Bedarf: SKILL.md step 2." (~280 B).
- „2.5. KoliBri-first followed? … Custom styling without a KoliBri alternative = finding. / When in doubt, search for alternatives via mcp__kolibri-mcp__search. / A missing justification … = finding." — **Redundanz**: Bullet-für-Bullet aus SKILL.md Schritt 2 (letzter Bullet). → „KoliBri-first: SKILL.md step 2." (~300 B).
- „MODE FIXUP VERIFICATION … Fixup diff since updatedAt: gh pr view --json commits, filter committedDate > updatedAt, then git diff on that. … don't re-litigate … do NOT re-cross-examine unchanged parts" — **Redundanz**: das ist SKILL.md Schritt 5 („Diff scoping on a follow-up review") in Reinform (gleiche updatedAt-/committedDate-/git-diff-Mechanik, gleiche Nicht-re-litigieren-Regel). CI-spezifisch bleibt nur die MODE-Erkennung oben. → Schritte 2–5 des Fixup-Modus zusammenfassen auf „Delta-Review per SKILL.md step 5 (Diff scoping): nur Fixup-Diff + neue Probleme; offene Findings abhaken, Kontext im Blick behalten." (~400 B).
- „VERDICT (deliver it twice — without a verdict the PR gets stuck): ORDER: FIRST post the collected comment with the Entscheidungs-Findings section filled in (without it, the PR gets parked on a human with a generic diagnosis), THEN the verdict channels." — **Weitschweifigkeit**: dieselbe Begründung („PR gets stuck"/„parked on a human") zweimal pro Absatz. → „VERDICT — ORDER: first the collected comment (inkl. Entscheidungs-Findings), then the verdict channels (otherwise the PR gets stuck)." (~220 B).

## .github/prompts/documenter.md — 🟡
- „Rules (short form, details in SKILL.md): - `title`: empty if … - `files`: the 3-8 most relevant … - `issues`: from {{LINKED_ISSUES}} … - After writing: verify with `jq . /tmp/doc.json`" — **Redundanz**: alle vier Regeln wortgleich in pr-documenter/SKILL.md → Rules (inkl. jq-Verifikation). → Block streichen, ersetzen durch „Rules: SKILL.md → Rules." (~430 B ≈ Hälfte der Datei). Voraussetzung: „Method and rules …: .claude/skills/pr-documenter/SKILL.md." um „read it before starting" ergänzen — die anderen Prompts ordnen das Lesen explizit an, documenter.md nicht; ohne das wäre die Redundanz dernierendes.
- INPUTS-Block bleibt (funktional): Workflow 06 substituiert Platzhalter nur in /tmp/claude-prompt.txt — im SKILL.md blieben {{TITLE_OK}} & Co. beim Lesen literal stehen.

## .github/prompts/triage.md — 🔴
- **Widerspruch**: „Initial triage: no <!-- KI-ANALYSE:START --> block in the issue body. Research = issue body + ALL comments (they may contain decisions)." vs. ticket-triage/SKILL.md Schritt 1: „for **initial triage** title + description (`gh issue view <nr> --json title,body`); for **re-triage** additionally **only the delta comments**". Prompt befiehlt ALLE Kommentare, Skill nur Titel+Body. Je nach Issues verbrennt das beim Erstlauf deutliche Laufzeit-Tokens (oder der Skill übersieht Entscheidungen — eine der beiden Fassungen ist falsch). → abstimmen; Empfehlung: dem Prompt-Verweis folgen lassen („Research per SKILL.md step 1") und die Antwort im SKILL fixieren.
- „Routing table (its own ai-phase-routing block, ASCII, exact format in the skill): impl+review ALWAYS `ja` (yes); model haiku|sonnet|opus, effort low|medium|high; for Run=`nein` (no), set model/effort to '-'. It controls model+effort PER phase." — **Redundanz**: Pflichtwerte + ASCII-Forderung stehen wortgleich in SKILL.md Schritt 4 („impl and review ALWAYS run … For Run: nein, set model/effort to - … parsed by machine (resolve-phase-routing.sh)"). → „Routing table (Format + Pflichtwerte): SKILL.md step 4." (~250 B).
- „VERDICT (one line):" + „TIME LIMIT: soft deadline = {{SOFT_DEADLINE}}" — Token bzw. Deadline korrekt (Workflow 01 parst spec-ready|needs-human|analyzed); im Gegensatz zu allen anderen Prompts fehlt aber die Check-Anweisung „Before every step: [ $(date +%s) -ge … ]". → eine Zeile ergänzen (kein Spar-, ein Vollständigkeitsbefund). Kein LABEL-BAN nötig — Triage setzt Labels selbst (SKILL Schritt 5), korrekt ohne Ban.

## .github/prompts/memory-read.md — 🟢
„KONTEXT AUS DEN VORHERIGEN PHASEN"-Verweis, Block-Verträge (Erledigt/Verworfen/…) und „DON'T TRUST FILE STATES BLINDLY" sind uniq (AGENTS.md → Memory regelt nur MEMORY.md). Einzige Mini-Dopplung: „ALWAYS READ FIRST (even on the first run)" deckt sich mit AGENTS.md („immer beide, MEMORY.md zuerst — auch beim ersten Lauf") — ~60 B, unter der Eingriffsschwelle.

## .github/prompts/memory-write.md — 🟡
- „Short version: strict — when in doubt, NO entry; most runs write nothing at all." — **Redundanz**: wortlich AGENTS.md → Memory („Aufnahmekriterium streng — im Zweifel kein Eintrag … Die meisten Läufe schreiben gar nichts — Normalfall."), direkt nachdem der Prompt ebendorthin als „binding, not repeated here" verweist. → beim Verweis enden (~110 B).
- Phasen-Notiz-Format (7 deutsche Überschriften) und Zweck/Aktualisierungs-Regeln: uniq und vertragstragend — 🟢.

## Widersprüche (quer über die Phasen)
1. **triage.md vs. ticket-triage/SKILL.md** — Kommentar-Leseumfang bei Erst-Triage: „issue body + ALL comments" (Prompt) vs. „title + description" (Skill). Einziger echter Zielkonflikt; zugleich der größte Laufzeit-Token-Hebel.
2. **fixup.md + implement.md + ticket-implementation/SKILL.md** — alle drei verweisen auf den Impeccable-Detektor (`.claude/skills/impeccable/scripts/detect.mjs`); das Verzeichnis existiert nicht. Kein Widerspruch untereinander, aber kollektiv tot.
3. **documenter.md vs. allen anderen Prompts** — als einziger ohne explizite Lese-Anweisung („read it before starting") für das eigene SKILL.md; das macht seine Regel-Wiederholung faktisch dernierend und sollte mit der Kürzung zusammen aufgelöst werden.
4. Geprüft und **kein** Widerspruch: Verdict-Kanäle (05 liest /tmp/claude-verdict, 01/02/03/04 grepen /tmp/claude-output.log — Prompts spiegeln das korrekt), Label-Bans (nur in Phasen ohne eigenes Label-Set, korrekt), spec-partial-Rename (Workflow 03 nimmt spec-ready noch als ALT-Token an), „Jede Phase liest nur ihren eigenen Phase-Skill" (AGENTS.md) wird von allen Prompts eingehalten.

## Token-Hebel (Rangfolge der Maßnahmen nach Wirkung)
1. **review.md auf Referenzen trimmen** (Schritt 2/2.5/Fixup-Modus/Verdict-Absatz): ~1,2 kB von 5,2 kB — größter Einzelhebel, doppelt sich jeder Punkt mit dem ohnehin gelesenen SKILL.md.
2. **triage.md Kommentar-Widerspruch auflösen** — 0 Byte Prompt-Ersparnis, aber der einzige Hebel, der Laufzeit-Tokens (Kommentar-Lektüre beim Erstlauf) einspart statt nur Initialkontext.
3. **implement.md entdoublen** (GATE-Kette, e2e-Regel, Idempotenz-Absatz, AGENTS-Verweis): ~0,6 kB.
4. **fixup.md**: toten Detektor-Befehl streichen (Korrektheit, spart Fehlversuch-Turns) + GATE/UI-Regeln referenzieren: ~0,3 kB.
5. **ux.md Quellen-Katalog referenzieren**: ~0,5 kB.
6. **documenter.md Rules streichen + Lese-Anweisung ergänzen**: ~0,4 kB.
7. **spec.md + memory-write.md Kleinigkeiten**: ~0,3 kB.
Summe statisch: ~3,5 kB von 22,8 kB Prompt-Korpus (≈ 15 % Initialkontext pro Phase), plus Korrektheitsgewinne (toter Pfad) und den Runtime-Hebel aus Nr. 2.



---

<!-- KI-ANALYSE:START stand=2026-08-27T05:19:18Z -->
### Umsetzungskontext
- **Scope-Entscheid (aus Autor-Kommentar):** Es wird EINE granulare wertvolle Optimierung umgesetzt — Hebel 1 der ticket-eigenen Rangfolge: **review.md auf Referenzen trimmen** (~1,2 kB von 5,2 kB, größter Einzelhebel des Audits). Die Hebel 2–7 des Audits bleiben offen und sind NICHT Teil dieses Tickets.
- Betroffene Dateien: `.github/prompts/review.md` (einzige Änderung); Referenz-Ziel: `.claude/skills/review-kreuzverhoer/SKILL.md`
- Betroffene Komponenten: CI-Prompt der Review-Phase (Workflow 05), operationalisiert die review-kreuzverhoer-Methode.
- Vorhandenes Muster: `review.md` L39 referenziert die Sammelkommentar-Struktur bereits korrekt („SKILL.md section ‚Struktur des Sammelkommentars' — reuse it from there, not repeated here") — exakt dieses Muster ist die Vorlage. Verifizierte Referenz-Ziele: SKILL.md Step 2 (L42 ff., inkl. Regression/Test-Pflege-Bedarf L52 und KoliBri-first-Bullet L53), Step 5 (L102 ff., inkl. Diff-Scoping updatedAt/committedDate/git diff L134–139).
- Randbedingungen (dürfen nicht brechen): MODE-Erkennung mit Marker-Strings (L6–8), Closing-Issue-Logik (L12–14), TITLE GATE (L32), LABEL-BAN (L43), beide Verdict-Kanäle mit exakten Tokens `reviewed`/`needs-fixup`/`needs-human` + `/tmp/claude-verdict` (L49–59), Sammelkommentar-Vertrag „EXACTLY ONE `<!-- ai-review -->`" (L38–41), Soft-Deadline-Check (L45). Das SKILL.md ist laut Prompt L1 Pflichtlektüre → Referenz statt Wiederholung verliert keine Information.
- Erwartetes Ergebnis: review.md um vier redundante Passagen kürzer, jede ersetzt durch einen Einzeiler-Verweis auf SKILL.md Step 2/Step 5; Verhalten der Review-Phase unverändert.
- **Kein Anwendungscode** (nur `.github/prompts/**`) → spec-Phase übersprungen, keine Testfälle (Begründung für Routing `spec: nein`).

### Akzeptanzkriterien
- AK1: Vier redundante Passagen sind je durch einen Kurzverweis ersetzt: (a) Kreuzverhör-Fragen + Regression-Absatz (L15–16) → „Cross-examination questions incl. regression/Test-Pflege-Bedarf: SKILL.md step 2."; (b) KoliBri-first-Block 2.5 (L17–20) → „KoliBri-first: SKILL.md step 2."; (c) Fixup-Modus Schritte 2–5 (L25–29) → Delta-Review-Verweis auf SKILL.md step 5 (nur Fixup-Diff + neue Probleme, offene Findings abhaken); (d) VERDICT-Einleitung (L49–52) → „VERDICT — ORDER: first the collected comment (inkl. Entscheidungs-Findings), then the verdict channels (otherwise the PR gets stuck)."
- AK2: Alle CI-funktionalen Inhalte aus den Randbedingungen überleben unverändert (per grep prüfbar): `<!-- ai-review -->`-Vertrag, MODE-Erkennung, TITLE GATE, LABEL-BAN, Verdict-Tokens `reviewed`/`needs-fixup`/`needs-human`, `/tmp/claude-verdict`, Soft-Deadline-Zeile.
- AK3: Jeder neu gesetzte Verweis benennt ein real existierendes Ziel in `review-kreuzverhoer/SKILL.md` (step 2 bzw. step 5).
- AK4: Keine andere Datei als `.github/prompts/review.md` wird geändert.

### Testfälle
Keine — kein Anwendungscode (`server/src/**`, `frontend/src/**`, `frontend/e2e/**` nicht betroffen). Verifikation stattdessen strukturell im Review: grep auf die AK2-Marker/Tokens, Diff-Sichtung für AK1/AK3.

### Ampel
- Ampel: 🟢
- Begründung: Eine Datei, ein PR, eindeutige Vorgabe (Audit nennt Passagen mit Zeilen und Ersatztexte); Referenz-Ziele im SKILL.md verifiziert vorhanden; Antwort auf die Autor-Frage („welche granulare Optimierung?") durch die ticket-eigene Rangfolge eindeutig entschieden.

### ❓ Offene Fragen
- keine — die übrigen Audit-Hebel (2–7, inkl. toter Impeccable-Pfad und triage.md-Widerspruch) sind bewusst ausgeklammert und können bei Bedarf eigene Folge-Issues bekommen.
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | nein | - | - |
| spec | nein | - | - |
| impl | ja | sonnet | low |
| review | ja | sonnet | low |
<!-- ai-phase-routing:END -->
