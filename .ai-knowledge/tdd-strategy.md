# Strategie: Test-Driven Development für KI-Workflows

> **Status: Stufen 1 + 2 + 3 adoptiert.** Dieses Dokument hält den Plan fest, mit dem die
> KI-Workflows (Triage → Spec → Umsetzung → Review) test-getrieben sind.
> **Stufe 1 (Szenario 1):** Die Triage erzeugt prüfbare Akzeptanzkriterien + Testfälle
> ([ticket-triage.md](ticket-triage.md) Schritt 1/4), die Issue-Templates fragen sie ab.
> **Stufe 2 (Szenario 2):** Die Umsetzung folgt Red-Green, `pnpm test` ist PR-Pflicht, das Review
> macht fehlende/rote Tests zum Gate ([pr-review.md](pr-review.md) Schritt 3/5).
> **Stufe 3 (Szenario 3):** Eigenes Spec-Gate — die Triage setzt `ai:spec-ready` statt `ai:ready`,
> ein eigener Lauf ([ticket-spec.md](ticket-spec.md),
> [spec.yml](../.github/workflows/spec.yml)) schreibt die roten Tests auf einen
> Draft-PR und gibt per `ai:ready` frei; die Umsetzung macht sie grün, ohne sie zu ändern
> (Gewaltenteilung).

## Problem: Die KI „schlingert", weil eine _ausführbare_ Spezifikation fehlt

Ohne diese Strategie erzeugt die Pipeline als Spezifikation **Prosa + Umsetzbarkeits-Ampel** (Triage,
[ticket-triage.md](ticket-triage.md) Schritt 4). Die Umsetzung ([ticket-implementation.md](ticket-implementation.md)
Schritt 3) muss daraus selbst ableiten, was „fertig" bedeutet — und interpretiert das bei jeder
Iteration neu. Es gibt keinen fixen, einklagbaren Vertrag, an dem sich die Umsetzung festhält.

**Leitidee:** Ein **roter Test ist ein einklagbarer Vertrag.** Steht er _vor_ der Implementierung
fest, hat die KI ein binäres Ziel (rot → grün) statt interpretierbarer Prosa — das stoppt das
Schlingern.

## Die Szenarien

Drei eskalierende Stufen plus eine Querschnitts-Politik. Es ist eine **Reifeleiter** — jede Stufe
baut auf der vorigen auf, nicht Entweder-oder.

### Szenario 1 — „Akzeptanzkriterien-first" (Spec als strukturierte Prosa) ✅ adoptiert

**Kerngedanke:** Bevor Code angefasst wird, gibt es prüfbare Akzeptanzkriterien (Given/When/Then-Stil),
die 1:1 zu Tests werden können.

**Was sich ändert:**

- [ticket-triage.md](ticket-triage.md) Schritt 1 + 4: Triage formuliert **Akzeptanzkriterien +
  konkrete Testfälle** (welche Datei, welche Assertion) als festen Bestandteil des Analyse-Body-Blocks.
- [ticket-triage.md](ticket-triage.md) Schritt 4: 🟢 setzt zusätzlich voraus, dass die AK **prüfbar**
  formuliert sind (sonst 🟡).
- ~~`.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml`: Feld „Akzeptanzkriterien / Wie
  verifiziert man die Lösung?".~~ — Issue-/PR-Templates am 2026-08-13 entfernt; die AK-Pflicht trägt
  nun [ticket-triage.md](ticket-triage.md) Schritt 4 (AK + Testfälle im Analyse-Body).

**Stärke gegen Schlingern:** mittel — klare Zielliste, aber noch Interpretationsspielraum (Prosa).
**Kosten:** niedrig (nur Doku/Templates). **Risiko:** minimal.
**Voraussetzung für alles Weitere** — ohne crisp AK kein sinnvolles test-first.

### Szenario 2 — „Red-Green im Umsetzungs-Schritt" (Spec = Tests, KI schreibt sie zuerst selbst) ✅ adoptiert

**Kerngedanke:** [ticket-implementation.md](ticket-implementation.md) Schritt 3 wird ein echter
Red-Green-Refactor-Loop.

**Was sich ändert:**

- [ticket-implementation.md](ticket-implementation.md) Schritt 3:
  **(a)** rote Tests aus den AK schreiben → als **erster Commit** sichtbar,
  **(b)** Code implementieren, bis Tests grün sind (`pnpm test` als primärer Erfolgsindikator),
  **(c)** erst danach `pnpm format` + Lint.
- ~~`.github/pull_request_template.md`: `pnpm test` wird Pflicht (nicht mehr „falls zutreffend"),
  plus Punkt „Tests bilden die Akzeptanzkriterien ab".~~ — PR-Template am 2026-08-13 entfernt;
  `pnpm test` ist Pflicht über [AGENTS.md](../AGENTS.md) Kernregeln (`pnpm format`, `pnpm lint` **und
  `pnpm test`** pro PR) + die Pipeline.
- [pr-review.md](pr-review.md) Schritt 3: kein 🟢-Urteil, wenn Tests fehlen oder rot sind.

**Stärke gegen Schlingern:** hoch — binäres Ziel ab Schritt 1.
**Kosten:** mittel (Workflow-Doku + Template). **Risiko:** tautologische Tests (die KI passt Tests
dem Code an statt umgekehrt) — wird durch das Review-Mapping (Test ↔ AK) abgefedert.

### Szenario 3 — „Spec-Gate mit Gewaltenteilung" (Spec = Tests, getrennt erzeugt, _vor_ `ai:ready`) ✅ adoptiert

**Kerngedanke:** Wer die Tests schreibt, schreibt **nicht** den Code. Die roten Tests entstehen in
einem eigenen Schritt vor der Freigabe.

**Was sich ändert:**

- Neues Label **`ai:spec-ready`** zwischen `ai:analyzed` und `ai:ready`: Triage (oder ein
  dedizierter Spec-Lauf) legt **rote Tests mit echten Assertions** an. `ai:ready` erst, wenn die
  roten Tests stehen.
- [ticket-implementation.md](ticket-implementation.md): Die Umsetzung darf die Tests **nicht ändern**,
  nur grün machen (Tests sind der Vertrag).
- Neue/erweiterte GitHub-Action analog `.github/workflows/implement.yml`.

**Stärke gegen Schlingern:** maximal — ausführbarer Vertrag von _anderer_ Instanz als der Code →
keine tautologischen Tests.
**Kosten:** hoch (neuer Workflow + Label + Action). **Risiko:** mehr Pipeline-Komplexität; lohnt vor
allem bei riskanten/logiklastigen Tickets.

### Querschnitts-Politik — „Differenziertes TDD nach Ticket-Typ"

Nicht alles braucht gleich viel Strenge. Diese Politik kombiniert man mit 1–3:

- **Logik/Backend (`server/src/logics`, `frontend/src/lib`):** echtes Red-Green (Sz. 2/3) — billig
  und hochwirksam (reine Funktionen, deterministisch).
- **Feature/UI-Verhalten:** Akzeptanz-**e2e** im Stil von `frontend/e2e/crud.spec.ts` als Spec, kein
  Unit-TDD-Zwang.
- **Reines Styling/Layout:** visuelle Verifikation statt Tests (deckt sich mit dem bestehenden
  e2e-Ansatz).
- **Coverage-Schwelle** nur für `logics`/`lib`, **nicht** repo-weit (Effizienz-Prinzip „gezielt statt
  repo-weit"). **Umgesetzt:** `server/src/logics` via node:test (`test:coverage`, Schwellen 90/85/85,
  CI-Gate). **Vorbereitet:** `frontend/src/lib` in `vitest.config.ts` — Provider
  `@vitest/coverage-v8` installieren, dann `test:coverage`.

## Testumfang — so viel wie nötig, so wenig wie irgend möglich

> **Leitsatz (gilt für Code, Doku und Tests gleichermaßen):** Schreibe nur so viel, wie wirklich
> notwendig ist, und so wenig wie irgend möglich. Jeder Test ist Wartungslast — er muss seinen
> Platz verdienen, nicht bloß Abdeckungs-Statistik erzeugen.

Ein Test darf entstehen, wenn er **mindestens eines** leistet:

1. **Auswertung** — er rechnet etwas aus, das nirgends wörtlich in der Quelle steht: eine Funktion
   gegen echte Eingaben, ein Ausdruck gegen echte Payloads, eine abgeleitete Invariante.
2. **Spiegel** — dieselbe Information steht an mehreren Orten und darf nicht auseinanderdriften.
   Der Sollwert wird dabei **aus der führenden Quelle gelesen**, nie als Literal in den Test
   geschrieben — sonst prüft der Test nur sich selbst.
3. **Schutz** — das Versagen ist nicht rückholbar (Datenverlust, Secret-Leak) oder es fällt nicht
   von selbst auf (grüner Lauf, aber Endlosschleife, verfrühte Freigabe, still übersprungene Suite).

Alles andere bekommt **keinen** Test. Insbesondere nicht der Typ „Datei enthält den String, den ich
hineingeschrieben habe" — er kann per Konstruktion keinen Fehler finden, weil er nichts prüft, was
nicht schon dasteht. Er ist ein Change-Detector: rot, wenn sich etwas ändert, nicht wenn etwas kaputt
ist. Ebenso wenig braucht es einen Test für Fehler, die beim nächsten Lauf ohnehin sofort und laut
krachen (fehlender Build-Step, falscher Host, vergessenes Secret) — dafür ist der Lauf selbst da.

**Zwei Gegenproben, bevor ein Test bleibt:**

- **Mutations-Probe:** Das bewachte Verhalten absichtlich brechen und den Test laufen lassen. Wird er
  nicht rot, ist er wertlos — unabhängig davon, wie plausibel er aussieht.
- **Leerlauf-Probe:** Prüft der Test „für alle X", muss sichergestellt sein, dass überhaupt X
  gefunden werden. Eine kaputte Extraktion ergibt sonst einen dauerhaft grünen Test über eine leere
  Menge. Deshalb gehört zu jedem All-Quantor eine Assertion, dass die Menge nicht leer ist.

**Was bewusst NICHT getestet wird — Workflows/CI-Plumbing, Config und Markdown-Inhalt (ADR, [#567](https://github.com/deleonio/priority-pilot/issues/567)):**
Getestet wird **nur Anwendungscode** (`server/src/**`, `frontend/src/**`) sowie Frontend-E2E
(`frontend/e2e/**`). Für `.github/workflows/`, `.github/scripts/`, die `setup-claude`-Composite-Actions,
die `ci.yml`/`deploy.yml`-Plumbing, Config-Dateien (`.yml`/`.json`/`.toml`) und **Markdown-Inhalt
(jede `.md`-Datei, egal wo — auch Spec-Prompts `.github/prompts/*.md` und `docs/spec/*.md`)** werden
**keine** Tests geschrieben oder gepflegt. Meta-Tests auf diese Dateien sind überwiegend
Tautologie-/Change-Detector-Tests ohne Fehlerfangwert (sie re-encodieren die Datei und werden rot bei
_Änderung_, nicht bei _Defekt_) und blockieren den Pipeline-Umbau durch ständigen Meta-Test-Churn — sie
haben Agenten und Phasen bisher auch stets als Vorbild eingeladen, neue zu schreiben. Die alte Suite
wurde am 2026-08-12 vollständig **gelöscht** (User-Direktive; [#564](https://github.com/deleonio/priority-pilot/issues/564)
hatte eine `__quarantine__/`-Verschiebung geplant, übersprungen); neuer Testbedarf entsteht spec-first nur
noch für Domänenlogik ([#566](https://github.com/deleonio/priority-pilot/issues/566)). Entscheidung
und abgegrenzter Scope: [ADR 0001 — GitHub-Workflows bleiben ungetestet](../docs/adr/0001-github-workflows-bleiben-ungetestet.md).

## Wie konkret das aussieht (an bestehendem Code)

Akzeptanzkriterium aus einem Ticket → roter Test, bevor `buildTaskForest` angefasst wird — exakt im
bestehenden Stil (`server/src/logics/tree.test.ts`):

```typescript
// AK: "Tasks mit Status 'Done' erscheinen nicht im Forest."  → erst rot, dann gruen
it('schließt Done-Tasks aus dem Forest aus', async () => {
	await Task.create({ title: 'Done', priority: 5, estimatedEffort: 1, status: 'Done' });
	const open = await Task.create({ title: 'Open', priority: 3, estimatedEffort: 1 });
	const forest = await buildTaskForest();
	assert.equal(forest.length, 1);
	assert.equal(forest[0].id, open.id);
});
```

Die KI hat damit kein „ungefähr so", sondern ein binäres Ziel — genau das stoppt das Schlingern.

## Vergleich

|           | Spec liegt vor als | Wer schreibt den Test | Anti-Schlinger | Umbau-Kosten |
| --------- | ------------------ | --------------------- | -------------- | ------------ |
| **Sz. 1** | Prosa-AK           | Triage                | mittel         | niedrig      |
| **Sz. 2** | Tests              | Umsetzer (selbst)     | hoch           | mittel       |
| **Sz. 3** | Tests              | getrennte Instanz     | maximal        | hoch         |
