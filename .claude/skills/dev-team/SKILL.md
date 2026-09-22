---
name: dev-team
description: "Dev-Team - lokaler Multi-Agent-Lauf fuer priority-pilot (Architect orchestriert Developer, Tester, Reviewer, Documenter, Paedagoge). Ticket-Modus fuehrt ein Issue eigenstaendig bis zum gruenen Kreuzverhoer (rote Tests, Umsetzung, review-ready PR, Fix-Schleife); freier Modus bearbeitet Aufgaben ohne Ticket (Review, Refactoring, Migration, Doku). Liest vor dem Briefing die Kennzahlen aus .costs/ fuer Modell- und Effort-Wahl und schreibt am Laufende einen Kostensatz je Lauf zurueck. Use for 'dev-team', 'Team-Lauf', 'uebernimm Ticket #N' (German: hand a ticket to the team)."
---

# Dev-Team (Multi-Agent-Lauf, priority-pilot)

Aufgabe: $ARGUMENTS

Der Architect ist Haupt-Agent und fuehrt den Lauf autonom. Dieses Skill traegt die Methode —
Rollen, Gates, Uebergabe-Verträge, Kostensteuerung. Projektregeln, die anderswo kanonisch stehen,
werden **verlinkt, nicht kopiert**: [AGENTS.md](../../../AGENTS.md) (kanonisches Gate,
Minimalprinzip, Muster-Treue, KoliBri-First, Memory-Protokoll),
[TDD-Strategie](../../../.ai-knowledge/tdd-strategy.md),
[Projekt & Konventionen](../../../.ai-knowledge/project.md),
[Mobile-UI-Regeln](../../../docs/mobile-ui-rules.md),
[Sequenzielle Bestätigung](../../../docs/ux-pattern-sequential-confirmation.md). Widerspricht diese
Datei einer davon, gilt die kanonische Quelle — und der Widerspruch ist ein Critical Finding.

## Herkunft

Destillat aus acht Generationen eines Multi-Agent-Teams: jedes Gate hier steht, weil es in
dokumentierten Läufen einen realen Fehler hinter grünen Tests gefunden hat. Neu gegenüber dem
Ursprung ist die Kopplung an die Kostenerfassung dieses Repos — der Lauf wird im selben Maßstab
messbar wie die CI-Phasen.

## Betriebsarten

**Ticket-Modus** — Aufruf mit einer Issue-Nummer („dev-team #1604", „übernimm Ticket 1604"). Der
Lauf führt das Ticket von der Analyse bis zum **grünen Kreuzverhör**: rote Tests, Umsetzung,
kanonisches Gate, review-ready PR, Fix-Schleife bis Verdict 🟢 ohne offene Findings. Der Merge
bleibt beim Menschen. Dieser Modus darf committen, pushen und den PR anlegen (Ausnahme zur
Nicht-automatisch-committen-Regel, analog den Ticket-Workflows in AGENTS.md).

**Freier Modus** — Aufruf mit einer Aufgabe statt einer Nummer (Review, Refactoring, Migration,
Doku, Analyse). Kein Branch-, kein PR-Zwang, **kein Commit ohne ausdrücklichen Wunsch**.

Beide Modi durchlaufen dieselben Gates. Nur der Abschluss unterscheidet sich.

**Der Ticket-Modus hat zwei Eingänge.** Lokal startet ihn der User mit einer Nummer. In GitHub
startet ihn das Label `ai:needs-team` am Issue — dann läuft derselbe Modus in Actions, und der
Run-Prompt des Workflows regelt, was dort anders ist: die Kostenerfassung übernimmt der Workflow
(nie selbst `.costs/` anfassen), der Pädagoge-Bericht geht in die Job-Summary statt in eine Datei,
Labels setzt ausschließlich der Workflow, und am Ende übernimmt der unabhängige CI-Review den PR.

## Globale Praemissen

- **Autonomie:** Nur der User ist Mensch. Rückfragen (per AskUserQuestion, nie still entscheiden)
  nur bei echt Irreversiblem: **irreversibler API-Kontrakt** (Form einer öffentlichen Signatur, hier
  `openapi.yml`), **Produktions-Auth/Secrets** (nicht real testbar), **Produkt-/Architektur-Weiche**
  mit offener Entscheidung. Die Schranke ist kalibriert: mehrere Klärungsrunden sind gerechtfertigt,
  wenn jede Lesart einen anderen Diff erzeugt — Raten churnt den PR.
- **Scope-Disziplin:** So viel wie nötig, so wenig wie möglich; keine ungefragten Nebenbaustellen.
  Jede Rolle bleibt strikt im Scope; Findings werden **gemeldet, nicht still gefixt**.
- **Effizienz:** Kein Routine-Lint/Build/Test auf Repo-Ebene — zielgerichtet auf die betroffenen
  Packages (`pnpm --filter server lint`). Das kanonische Gate läuft **einmal am Ende** über alle
  Änderungen, nicht je Einzeländerung.
- **Modell-Wahl:** Kleinstes sinnvolles Modell zuerst; der Architect eskaliert bei Unsicherheit
  selbstständig (Haiku → Sonnet → Opus → Fable). **Fable ist die vierte, stärkste Stufe** und bleibt
  den härtesten Fällen vorbehalten: typ-theoretisch subtile Materie, architektur-kritische Weichen,
  Kreuzverhör höchster Subtilität — nicht Routine. Ein Subagent **derselben Session** darf ein
  *stärkeres* Modell als der Koordinator nutzen — bevorzugt gegenüber teurem Kalt-Spawn.
  Die Wahl wird gegen die Kennzahlen aus `.costs/` begründet (s. Kostensteuerung).
- **Delegation (ADR 0008):** Erzeugt ein Teilschritt viel Rohtext, aber nur ein kurzes Ergebnis,
  gehört er an eine Rolle: Gate-Läufe an `gate-runner`, breite Suchfragen an `recherche` (beide in
  `.claude/agents/`). **Nie delegiert:** die Codeänderung selbst, Abweichungen vom Test-Vertrag,
  Urteil. Delegation ersetzt Kontext-Beschaffung, nicht Urteilskraft.
- **Docs-Konsistenz:** Repo-Doku ist Single Source of Truth; stille Abweichungen sind Critical
  Findings.
- **Rollen-Feedback (proportional):** Bei **≥2 echten Agents** liefert jede Rolle kurz: Confidence
  (1-10), Aufgaben-Klarheit (1-5), 1 Satz Begründung, Hindernis, Positives, Verbesserungsvorschlag.
  Bei **Solo-inline** genügt ein Satz.

## Kostensteuerung (Soll, Phase 1)

Die Läufe dieses Repos sind vermessen: jeder CI-Phasenlauf hängt einen Satz an `.costs/<issue>.json`
(Turns, Token, valueCost, Modell, Effort, Review-Verdict). Der Architect nutzt diesen Bestand
**bevor** er das erste Briefing schreibt.

1. **Kennzahlen holen — delegiert, nie roh in den eigenen Kontext:** Auftrag an `recherche`:
   „Führe `pnpm cost:report` aus und gib **nur** zurück: Ø Turns und Ø valueCost je Phase
   (implement, review, fixup, documenter), Fixup-Quote, und den Turn-Aufschlag einer Fixup-Schleife."
   Der Markdown-Report selbst ist mehrere hundert Zeilen — er darf den Architect-Kontext nicht
   fluten.
2. **Kosten-Soll in die Scope-Box:** gewähltes Modell, Effort, **erwartete Turns** und eine Zeile
   Begründung gegen den Ist-Schnitt („Small + bekanntes Muster → Sonnet/medium, Soll ≈ Ø implement").
3. **Qualität geht vor Turns:** Eine Fixup-Schleife kostet mehr als ein gründlicher erster Schritt.
   Nie ein Gate überspringen, um Turns zu sparen — genau dieser Tausch geht zulasten des
   Kontingents (AGENTS.md, „Turns bündeln").

Am Laufende wird der Ist-Wert gemessen und geschrieben (s. Kostenerfassung am Laufende).

## Pre-Flight (Entry-Gate)

**Bevor** Code geschrieben wird. Alle vier Teile sind Pflicht-Artefakte des Briefings.

### 1. Completeness-Grep (Spiegel-Stellen)

Mechanischer `rg`-Lauf über alle Stellen, die das geänderte Symbol/Skript/Endpoint/Prop spiegeln
könnten:

- `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `.ai-knowledge/**`, `docs/**` (inkl. `docs/adr/**`)
- `.claude/skills/**`, `.claude/agents/**`, `.github/workflows/**`, `.github/prompts/**`
- `openapi.yml` (Vertragsquelle), JSDoc, Tests, Playwright-Specs unter `frontend/e2e/`
- **Neues Skript/Hook/Export:** Grep auf mindestens eine Consumer-Stelle — **null Treffer =
  Finding, nicht Erfolg**.
- **Verhaltens-/Routing-/Kontrakt-Änderung:** Git-History der Spiegel-Docs gegen das jüngste
  Code-Datum — folgt die Doku noch dem Code?

**Empfänger-Framing:** nicht nur „wer schreibt/definiert X?" (Sender), sondern zwingend auch **„wer
liest X heute?"** (Empfänger). Bei jeder „X wird woanders gespeichert/gemeldet"-Änderung zuerst
greppen, wer X konsumiert — die Lese-Enden gehören in die Spiegel-Liste.

**Abarbeitungs-Nachweis je Stelle:** jede Spiegel-Stelle bekommt einen Status — **erledigt** oder
**skipped + Begründung**. Eine produzierte, aber unaufgearbeitete Spiegel-Liste ist unvollständig,
auch wenn der Grep-Beweis vorliegt. Eine **leere** Spiegel-Liste wird nur mit beigefügtem
Grep-Beweis akzeptiert — nicht auf Zuruf.

### 2. Automation-/Concurrent-Agent-Check

Dieses Repo hat eine label-getriebene KI-Pipeline (`ai:needs-*` → `ai:<Vergangenheitsform>`). Läuft
sie bereits auf dem Ticket, ist lokale Parallelarbeit doppelt teuer: doppelte Kosten **und**
Edit-War auf demselben Branch.

- `gh issue view <nr> --json labels,assignees` und `gh pr list --search "<nr>"`: Trägt das Issue
  einen **Ketten-Trigger** (`ai:needs-ux-ui`, `ai:needs-spec`, `ai:needs-impl`, am PR
  `ai:needs-review`/`ai:needs-fixup`), ist es zugewiesen oder existiert ein Pipeline-PR →
  **Rückfrage an den User**, nicht loslaufen.
- **`ai:needs-team` ist der eigene Trigger, kein Blocker.** Es bedeutet, dass ein Mensch das Ticket
  an das Team übergeben hat — im CI-Lauf hat der Workflow es beim Start konsumiert, lokal setzt es
  niemand. Wer daran abbricht, bricht an sich selbst ab. `ai:continued` markiert einen Folgelauf
  nach Soft-Abort: fortsetzen, nicht neu anfangen (Phasen-Notiz lesen).
- **Working-Tree-Drift mittendrin** (`git status` ändert sich zwischen zwei Befehlen, fremde
  Edit-Prozesse in `ps`): **nicht zurückdrehen** (kein `reset --hard`), sondern melden und
  User-Entscheid einholen. Ein Edit-War auf einem geteilten Branch ist nicht reversibel.

### 3. Working-Tree-State (Hard-Gate, jede Zuweisung)

Dirty/untracked Dateien auflisten und als **„bekannt, nicht vom Team"** markieren; stale `dist/`
warnen; fremde Secrets/Keys (`gh_deploy` taucht wiederholt auf) → **kein `git add -A`**; Offenes aus
Vor-Increments nennen; beobachtete Concurrent-Agent-Drift explizit vermerken.

### 4. Gotcha-Box

Der Architect liest [gotchas.md](gotchas.md) **einmal pro Lauf** in Phase 1 und zieht die
zutreffenden Einträge **wörtlich** in die Gotcha-Box jedes Briefings — Rollen erhalten die Auszüge,
nicht den Pfad. Berührt der Task KoliBri, Playwright, den API-Vertrag, das Monorepo oder die
Pipeline, ist der Katalog-Read **nicht optional**; „kein Eintrag zutreffend" wird explizit vermerkt,
nicht stillschweigend weggelassen.

## Leitprinzipien

### A) Fakten-first statt Raten (Quelle vor Narrativ)

- **Komponenten-Verträge (KoliBri-MCP):** Vor Nutzung/Migration einer Komponente Props, Events,
  Slots UND Lebenszyklus aus der Quelle belegen, nicht aus Erinnerung. KoliBri-First gilt
  (AGENTS.md): selbst stylen nur, wenn keine Komponente passt.
- **Vertrag vor Typen:** `openapi.yml` ist die Quelle; `server/src/api.d.ts` und
  `client/src/schema.d.ts` sind generiert und werden **nie** handeditiert.
- **Registry/Diff vor Narrativ:** Ziel-Versionen gegen die npm-Registry verifizieren, `ncu` und
  Advisory-IDs nicht blind vertrauen. PR-Beschreibungen gegen den **lokalen Git-Diff** abgleichen.
- **`git status`, Reflog und `tsc --noEmit` schlagen Agent-Erzählung.**

### B) Verifizieren, was wirklich zaehlt

- **Visuell:** Bei UI-Änderungen die echten Screenshots ansehen (`pnpm ui:inspect` +
  Playwright-MCP, 375px und 1280px). Grüne Tests beweisen Stabilität, nicht Korrektheit —
  Kontrast, Lesbarkeit, Umbruch sieht man nur am Bild. Sparsam einsetzen: erst die deterministischen
  Regeln (`docs/mobile-ui-rules.md`), dann der kurze Layout-Break-Check.
- **Test-Qualität > grüne Tests:** Ein Test, der die zu prüfende Funktion **wegmockt**, ist grün
  ohne Aussage. Mindestens ein Test ohne Mock der Kernfunktion.
- **Negativ-Kontrolle:** Eine bewusst falsche Erwartung mitführen, die **rot** werden muss. Macht
  aus „kompiliert/grün" einen kausalen Beweis — das methodisch stärkste Einzelartefakt.
- **Determinismus-Gate:** Snapshot-/Timing-sensitive Änderungen bestehen **2 aufeinanderfolgende
  grüne e2e-Läufe**, bei bekannt fragilem Muster **3** — im **Vordergrund**, Port verifiziert frei.
- **ARIA-Snapshot als Debug-Grundwahrheit:** Bei „öffnet nicht vs. Assertion falsch" den
  Playwright-`error-context.md`-ARIA-Baum lesen statt raten. `main: Lade …` im Baum heißt: das
  Backend ist tot, nicht der Selektor falsch.
- **e2e-Scope bei Test-Edits:** lint/`tsc --noEmit`-grün ≠ e2e-grün. Wer eine Spec unter
  `frontend/e2e/` ändert, **lässt sie laufen** (`pnpm --filter frontend test:e2e`) und führt die
  Negativ-Kontrolle mit (alter Stand = rot). Das Lint-Gate fängt Laufzeit-Regressionen dieser Klasse
  nie.

### C) Umgebungs-Awareness

- **Niemals** `reset --hard`, force-push oder History-Umschreiben. Heikle Git-Aussagen vorher per
  Reflog verifizieren statt blind dem Status zu trauen.
- „Modified since read" → **neu lesen**, dann editieren. **Mid-edit-Falle:** Working-Tree ≠ Staged
  durch nebenläufiges Auto-Staging oder `prettier --write` sieht wie ein Lint-Defekt aus, ist aber
  ein Staging-Artefakt — kontrolliert sauber re-testen statt blind fixen.
- **Port-Hygiene vor jedem Playwright-Lauf:** Orphans räumen. **Eltern-Prozess-Check VOR dem ersten
  `kill`:** `ps -o ppid,lstart -p <pid>`. Ein `nodemon`-Parent mit altem Start-Zeitstempel ist der
  **Dev-Server des Users**, keine Test-Leiche — nur den Kind-Prozess beenden, den Supervisor leben
  lassen.
- **Tooling-Fallbacks vorab benennen,** nicht erst beim Anschlagen: kein `gh`/Auth → GitHub-API per
  `curl`; kein `SendMessage` → Fix-Loop durch **Architect-Adjudikation** ersetzen und Strittiges
  **empirisch** entscheiden, nicht per Autorität; **zsh-Glob-Falle:** `--include=*.ts` wird von zsh
  expandiert → `rg -g` nutzen.

### D) Kontext erhalten statt kalt neu starten

Fix-Loops mit **derselben** Rolle fortsetzen. Ist Reuse unmöglich UND die Fläche klein UND der
Architect hält vollen Kontext: **inline** umsetzen statt teurem Kalt-Spawn — das ist die
token-effizienteste, risiko-angemessene Wahl.

### E) Strahlungs-Awareness

Eine Änderung strahlt weiter als die offensichtlichen Kern-Dateien — die teuerste, spät gefundene
Fehlerklasse:

- **Prozess-/Regel-Änderungen** → jede spiegelnde Datei: Skills, Agents, Workflows, Prompts,
  `AGENTS.md`, `.ai-knowledge/**`.
- **API-/Datenfluss-Änderungen** → Sender UND Empfänger prüfen, keine halben Fixes (Skript
  hinzugefügt, Verdrahtung vergessen).
- **Renaming/Renumbering/Routing** → Grep über ALLE Treffer und Varianten ist Pflicht, nicht
  visuell raten.

## Uebergabe-Vertraege

### Architect → Rolle (5 Pflicht-Artefakte)

1. **Scope-Box:** Modell, Effort, **Kosten-Soll** (erwartete Turns + Begründung), Änderungsumfang,
   Docs-Impact, betroffene Dateien, was explizit NICHT geändert wird, Abbruchbedingung.
2. **Pre-Flight-Grep-Artefakt:** Spiegel-Liste mit Grep-Beweis **und Abarbeitungs-Nachweis je
   Stelle**.
3. **Working-Tree-State** (Hard-Gate, jede Zuweisung).
4. **Gotcha-Box:** zutreffende Auszüge aus [gotchas.md](gotchas.md), wörtlich.
5. **Vertrag:** im Ticket-Modus die Akzeptanzkriterien aus dem Harness-Kommentar; im freien Modus
   die Abnahmebedingung in einem Satz.

### Developer → Reviewer (Verifikations-Paket)

Diff-Zusammenfassung + geänderte Dateien + **Pre-Flight-Grep-Output**; ausgeführte Kommandos mit
Ergebnis (Gate-Kette, Anzahl grüner e2e-Läufe); visuelle Artefakte bei UI (welche Screenshots, warum
legitim); bewusste Trades offenlegen. **Bei Test-Edits:** Nachweis, dass die e2e wirklich lief, inkl.
Negativ-Kontrolle.

### Reviewer → Architect (Findings-Vertrag)

**Melden, nicht fragen** (Unklares als „Open Questions / Needs Deeper Look"). Severity-sortiert
(Critical → High → Low), **jedes Finding mit `Datei:Zeile`**. Bei a11y-/Anzeige-Wegfall: Information
redundant oder allein-tragend? Bei Dependency-Findings **value- vs. type-Import unterscheiden**,
bevor Laufzeit-Impact behauptet wird (`import type` verschwindet zur Laufzeit).

### Bedingt: Proben-Isolation (nur bei parallelen Agents)

Schreiben mehrere parallele Agents Wegwerf-Proben, sehen sie sich gegenseitig und verfälschen
`pnpm test`. Vorab klären: **eindeutige Datei-Prefixes** ODER **serielle Proben-Phasen** ODER
**Worktree-Isolation**; Proben nach Gebrauch entfernen. Solo/sequentiell: entfällt.

## Praxis-Regeln

1. **RCA-first bei Bugs:** Erst Root Cause sauber benennen, dann minimaler Fix — kein blinder Fix.
2. **Self-Escalation** bei Architektur-Unsicherheit, möglichen Breaking Changes, unklaren
   API-Kontrakten, novel/komplexer Lib-API. Grundlage dokumentieren.
3. **Dataflow-Vollständigkeit vor Implementierung:** Sender UND Empfänger.
4. **Completeness-Grep bei Rename/Prop-Migration/Routing** als Entry-Gate, nicht visuell raten.
5. **Test-Transparenz:** kein stiller Skip (Grund + TODO Pflicht); kein Mock der getesteten
   Funktion; geänderte oder gelöschte Assertions bestehender Tests werden als bewusste Test-Pflege
   im PR begründet — undokumentierte Test-Änderungen werden immer zu Findings.
6. **Monorepo/Dependency:** nach Dep-Upgrades Lockfile-Konsistenz im betroffenen Scope; Versionen
   gegen die Registry verifizieren. Lockfile-Regen nicht durch das Team riskieren.
7. **Bewusste Nicht-Adoption dokumentieren:** Anti-Fit als Code-Kommentar an Ort und Stelle
   begründen.
8. **Guardrail gegen Scope-Übergriff:** keine stillen Produkt-/Architektur-Umentscheidungen;
   User-Auswahl faktenbasiert auf echte Fits reduzieren statt stur 1:1 — transparent machen.
9. **Architect-Cross-Check:** Findings vertrauen, aber beweisbare Fakten gegenprüfen (type- vs.
   value-Import, leere vs. geseedete Daten, Staging-Artefakt vs. echter Defekt). Ertragsstärkstes
   Gate — nicht streichen.
10. **Own-gate-early-negative-test:** Beim Schreiben eines Guards/Gates sofort der Gedankentest „was
    genau zähle/prüfe ich?" — plus eine bewusst falsche Eingabe mental durchspielen, die das Gate
    **nicht** fangen darf. Billigster Hebel, fängt Fehler vor dem ersten Lauf.
11. **Plan-Dokument als Cross-Check-Referenz:** Erweitert ein fremder Commit den Scope mittendrin,
    den echten Diff gegen das **ursprüngliche** Plan-/Analyse-Dokument abgleichen — sonst fällt
    still weg, was dort ausdrücklich gefordert war.
12. **Beleg-Erhebungs-Reflex:** Bei jedem „unbelegt"-Finding zuerst **selbst erheben** versuchen
    (DOM, Registry, `curl`, Testlauf), **erst dann** abschwächen. Die stärkste Antwort auf ein
    unbelegt-Finding ist oft der in zehn Minuten selbst erhobene Beleg.
13. **Deliverables AUSFÜHREN, nicht nur beschreiben:** generierte Tests, die nie liefen, sind
    systematisches Risiko.

## Orchestration

Ablauf: User → Architect → Rolle → Architect → … → Reviewer → Pädagoge.

- Standard ist **sequentiell**. Parallel nur bei disjunkten Dateien ohne gegenseitige
  Abhängigkeiten — dann Proben-Isolation anwenden.
- Pro Zuweisung Pflicht: die fünf Artefakte des Übergabe-Vertrags.
- Kein pauschaler Start-Healthcheck; nur bei Verdacht gezielt prüfen.

### Feature-Size-Gating

Das Gating ist ein **Feature**: voll besetzen, wo Risiko ist; Spawn-Overhead sparen, wo nicht. Kein
pauschaler „immer Reviewer"-Reflex.

- **Tiny:** Developer (oder inline) + Inline-Review.
- **Small:** Developer + Reviewer (Tester bei test-relevanter Änderung).
- **Medium:** Developer + Tester + Reviewer; Documenter bei Doku-Impact.
- **Large/Hochrisiko:** volle Pipeline; **separater Reviewer Pflicht**; Modell-Eskalation.

### Hochrisiko-/Topologie-Gate (non-umgehbar)

Separater Reviewer **Pflicht** bei: Hochrisiko, novel API, Type-Safety-kritisch, Änderungen am
API-Vertrag (`openapi.yml`), Datenbank-Migrationen, Pipeline-/Trigger-Topologie, Wiederverwendung
eines bekannt fragilen Musters. **Nicht durch bloße Behauptung umgehbar** („gründliche
Selbstverifikation" ersetzt den Pflicht-Reviewer nicht). Ist ein separater Spawn umgebungsbedingt
unmöglich, ist der Ersatz ein **adversariales Selbst-Sonden-Artefakt MIT Negativ-Kontrolle** — keine
Prosa. Die Ausnahme ist eng: nur fehlende Tooling-Fähigkeit, nie Bequemlichkeit oder Token-Sparen.

### Kreuzverhoer (adversariales Review-Muster)

Wenn der User es fordert ODER die Materie typ-/auflösungs-subtil ist:

- **2 unabhängige Reviewer parallel**, bewusst **ohne** Architect-Ground-Truth: einer als
  **Ankläger** („beweise, dass es bricht"), einer als **Verteidiger** („belege Korrektheit empirisch
  + Negativ-Kontrolle").
- Der Architect etabliert **vor** der Delegation eine eigene Sonde als Ground-Truth und
  **adjudiziert Severity-Dissens empirisch** (alt-vs-neu-Lauf), nicht per Autorität.

## Rollen

**Reviewer (2 Phasen).** Phase 1 (Quick-Blocker): Criticals sofort zurück an den Developer, nicht
auf das Full-Review warten. Phase 2 (erst nach Critical-Fixes): WCAG/BITV, API, Type Safety,
Event-/Slot-Contracts, Tests, Docs-Konsistenz, Dead Code (grep-verifiziert), **Spiegel-Stellen-
Re-Check gegen das Pre-Flight-Artefakt inkl. Abarbeitungs-Nachweis**, value- vs. type-Imports.
Critical = WCAG-Verstoß, `any`-Leak, API-Bruch ohne Migrationspfad, Contract-Lücke, **stille
Doku-Abweichung oder Silent-Stub im Vertrag, die eine Funktion aushebelt**.

**Developer.** Implementiert exakt nach Scope-Box, Grep-Artefakt und Gotcha-Box. Keine
Type-Assertions zum Unterdrücken von Fehlern (legitimes Narrowing dokumentieren). Liefert das
Verifikations-Paket mit; Unklarheiten sofort an den Architect.

**Tester.** Fokus auf geänderte Funktionalität + kritische Interaktionen; E2E/Unit proportional zum
Scope. Determinismus-Gate im Vordergrund, Port verifiziert frei (inkl. Eltern-Prozess-Check). Kein
Mock der getesteten Funktion; bei „öffnet nicht/leer" ARIA-Snapshot lesen; Skips begründen + TODO.

**Documenter.** Nur notwendige Doku-Updates gegen die Pre-Flight-Liste. **Diagramme als Mermaid**,
nie ASCII. Knowledge-Graph-Regel: neue Dokumente werden in `AGENTS.md` verlinkt, sonst sind sie
verwaist.

**DevSecOps.** Nur bei Security-/Dependency-relevanten Änderungen. Auf fremde Secrets/Keys im
Working-Tree achten → **kein `git add -A`**.

**Paedagoge.** Bewertet den Teamprozess (s. Abschluss).

## Task-Workflow — Ticket-Modus

1. **Pre-Flight** (alle vier Teile oben) + **Kostensteuerung** (Kennzahlen holen, Kosten-Soll
   setzen). Task-Typ und Feature-Size bestimmen. Laufstart notieren:
   `date -u +%Y-%m-%dT%H:%M:%SZ` — dieser Zeitstempel ist später die Untergrenze der Messung.
2. **Kontext laden:** Issue plus den **Harness-Marker-Kommentar** (ADR 0009 — der eine Kommentar,
   dessen Body mit `<!-- ai-harness -->` beginnt; `gh issue view <nr> --json comments`), Fallback
   Issue-Body. Akzeptanzkriterien und Testfälle daraus sind der Vertrag. Kein Re-Triage.
3. **Branch:** `ai/harness/<nr>` (`git fetch origin && git switch ai/harness/<nr>`, sonst
   `git switch -c ai/harness/<nr>`). Existiert ein Draft-PR zum Ticket, dessen Branch verwenden.
4. **Rot:** Tests zuerst — je Akzeptanzkriterium ein auswertender Test, der aus dem richtigen Grund
   rot ist (Test-Umfang nach TDD-Strategie: so viel wie nötig, so wenig wie möglich).
5. **Grün:** Produktionscode, bis alle Tests grün sind. Frontend: KoliBri-First über den MCP,
   sichtbare Änderungen bei 375px und 1280px prüfen.
6. **Gate:** das kanonische Gate aus AGENTS.md **einmal** über alle Änderungen, delegiert an
   `gate-runner` (grüne Ausgabe gehört nicht in den Architect-Kontext). E2E scoped auf die berührte
   UI-Fläche; Determinismus-Gate, wo Timing im Spiel ist.
7. **PR:** committen (Issue referenzieren), pushen, PR review-ready machen — Draft-PR per
   `gh pr ready <pr>`, sonst `gh pr create --assignee @me --title "<Titel> (#<nr>)" --body "… Closes #<nr> …"`.
   Die Beschreibung trägt: Umsetzungs-Zusammenfassung, betroffene Dateien, Gate-Ergebnisse,
   bewusste Abweichungen mit Begründung.
8. **Kreuzverhör-Schleife** (je Runde): adversariales Review des vollen Diffs → jedes Finding als
   verankerter Review-Kommentar → `gh pr checks <pr>` → Findings abarbeiten (valide und klein:
   fixen, antworten, Thread auflösen; unklar: nachfragen; nicht valide: sachlich begründen) → erneut
   kreuzverhören. **Ende:** Verdict 🟢 und **kein offenes Finding**. **Loop-Guard:** stehen nach
   **3 Runden** substanzielle Findings offen, entscheidet ein Mensch.
   Threads auflösen geht nur per GraphQL (`resolveReviewThread`) — `gh` hat kein natives Kommando.
9. **Kostensatz schreiben** (s. unten) und in den Abschluss-Commit des Laufes aufnehmen.
10. **Pädagoge** (Pflicht). Ohne ihn ist der Lauf unvollständig.

## Task-Workflow — freier Modus

Schritte 1 und 2 sinngemäß (Abnahmebedingung statt Akzeptanzkriterien), dann iterativer Loop: Rolle
arbeitet im Scope, liefert nach Übergabe-Vertrag, Fix-Loops mit derselben Rolle. Abschlussprüfung
durch den Reviewer: neue Probleme? Determinismus-Gate bestanden? Spiegel-Stellen konsistent? Dann
Kostensatz (`--issue 0`) und Pädagoge. **Kein Commit** ohne ausdrücklichen Wunsch — der Lauf schlägt
den Commit vor.

## Kostenerfassung am Laufende

**Nur im lokalen Lauf.** Startet der Lauf über das Label `ai:needs-team` in GitHub, misst der
Workflow nach deinem Zug und lädt den Satz als Artefakt hoch — eine zusätzliche Selbst-Erfassung
zählte dieselben Token doppelt. Dort also `.costs/` nicht anfassen.

Lokal, vor dem Pädagoge-Report, nachdem die Arbeit steht:

```
pnpm cost:record -- --issue <nr|0> --phase team \
  --since <Laufstart-ISO> --cwd "$PWD" --provider claude --effort <low|medium|high> \
  [--verdict reviewed|needs-fixup --findings <n> --nits <n>]
```

- **`--since` ist Pflicht** — der in Schritt 1 notierte UTC-Zeitstempel. Ohne ihn summiert die
  Erfassung **alle** Transkriptzeilen dieses Projekts, nicht nur den Lauf.
- **`--cwd "$PWD"`** grenzt auf Sitzungen dieses Repos ab; fremde Projekte fließen sonst ein.
- **`--issue`:** die Ticketnummer im Ticket-Modus, sonst `0` (Konvention der Stateless-Läufe).
- **`--verdict/--findings/--nits`** füllt der Ticket-Modus aus dem finalen Kreuzverhör — dieselben
  Felder, die die Review-Phase in CI schreibt, damit lokale und CI-Läufe vergleichbar bleiben.
- **Fail-open:** Meldet die Erfassung „kein Verbrauch gefunden" oder scheitert sie, wird das im
  Report vermerkt — sie färbt nie einen erfolgreichen Lauf rot.
- **Danach formatieren, sonst bricht der PR:** Die Erfassung schreibt mit zwei Leerzeichen, das Repo
  formatiert mit Tabs. Direkt nach dem Schreiben `pnpm exec prettier --write .costs/<nr>.json` —
  sonst schlägt `prettier --check .` im CI-Verify des PRs fehl (in CI tritt das nie auf, dort landet
  der Satz nur im Artefakt).
- **Commit:** Im Ticket-Modus reist `.costs/<nr>.json` im Abschluss-Commit mit; das spätere
  CI-Siegel mergt idempotent und behält den lokalen Satz. Im freien Modus wird `.costs/0.json`
  geschrieben, aber nicht committet — der Lauf schlägt `chore(costs): lokaler Team-Lauf` vor.

## Abschluss (Paedagoge)

Bericht nach `.claude/team-reports/YYYY-MM-DD-<ticket|frei>.md` (lokal, nicht versioniert).
Pflichtinhalte:

- **Soll/Ist-Tabelle:** geplante vs. gemessene Turns und valueCost, Modell und Effort, und ob eine
  Fixup-Schleife entstand. Der Ø-Aufschlag einer Fixup-Schleife ist die Vergleichsgröße.
- **Rollen-Feedback** (proportional), Beobachtungen, konkrete Empfehlungen, Aufwands-Rechtfertigung.
- **Feedback-Loop-Nachweis:** entstanden Fixes nachweislich NACH Reviewer-/Tester-Feedback?
- **Pflicht-Abgleich, nur Abweichungen (X/WARN):** Grep-Artefakt inkl. Abarbeitungs-Nachweis,
  Dirty-State inkl. Concurrent-Agent-Drift, Port-Hygiene bei Playwright, Proben-Isolation bei
  Parallelität. Immer-grüne Zeilen sind redundant, sobald die Gates als Artefakte vorliegen.
- **Offene Empfehlungen** erneut prominent markieren.

Dauerhafte Lehren (nicht-offensichtliche Werkzeug-/CI-Eigenheiten) werden als Zeile für
`.ai-memory/MEMORY.md` **vorgeschlagen** — Aufnahmekriterium und Format stehen in AGENTS.md; die
meisten Läufe schreiben gar nichts.

## Output

- Nicht-lokal-verifizierbare Restpunkte (Live-Deploy, CI-Trigger, Produktions-Auth) **ehrlich als
  offen** deklarieren, nicht „grün" behaupten.
- Ticket-Modus: review-ready PR mit grünem Kreuzverhör, Kostensatz, Pädagoge-Bericht. Der Merge
  bleibt beim Menschen.
- Freier Modus: je nach Task Code + kurze Änderungszusammenfassung, `review.md` (sortiert Critical →
  High → Low → Open Questions), Tests oder die notwendigen Doku-Updates.
