# Test-Suite-Reduktions-Plan — „So viel wie nötig, so wenig wie möglich"

> Status: Entwurf · Angelegt: 2026-08-08 · Ablage: `.ai-knowledge/`
> Vorgänger/Diagnostik: `.github/workflows/test-optimization.yml` + `.github/scripts/analyze-test-suite.ts`
> Strategie-Kontext: `.ai-knowledge/tdd-strategy.md` (Substance over Quantity)
> **Update 12.08.2026 — ADR 0001:** Das hier geplante Artefakt
> `.github/scripts/test-reduction-contract.test.ts` (VERDICT-Contract, Phase 3 / Dateiübersicht)
> ist von [ADR 0001 — GitHub-Workflows bleiben ungetestet](../docs/adr/0001-github-workflows-bleiben-ungetestet.md)
> überholt: für `.github/**` werden **keine** Tests geschrieben. Der VERDICT-Contract ist
> stattdessen inline im Workflow zu verifizieren oder entfällt. Der app-Test-Reduktionsanteil
> (Unit/E2E-Coverage-Matrix, Phasen 1–2) bleibt von ADR 0001 unberührt.

---

## 1. Ziel & Problem

**Ziel:** Die Test-Suite auf das Notwendige reduzieren und optimieren — nur so viel wie nötig, so wenig wie möglich.

**Problem (historisch gewachsen):**

- Über die Zeit wurden **nur Tests hinzugefügt, nie abgebaut**. Die Suite ist monoton gewachsen.
- **Widersprüche** zwischen Tests wurden **mühsam durch Aneinanderreihung weiterer Tests** aufgelöst, statt bestehende Tests abzubauen.
- Folge: Redundanz, verdeckte Ordnungsabhängigkeit, längere CI-Laufzeit, sinkendes Vertrauen in die Aussagekraft grüner Läufe.

**Auftrag an den Workflow:** Diese Dynamik umkehren — aktiv Streich-Kandidaten _identifizieren_, _verifizieren_ und _sicher entfernen_.

---

## 2. Warum der aktuelle Job das nicht leistet

Der bestehende `test-optimization.yml`-Job ist eine **Diagnostik**, keine **Reduktion**:

| Schwäche                         | Bedeutung für das Reduktionsziel                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Falsches Signal**              | Er nutzt Text-Ähnlichkeit (erste 300 Zeichen Test-Body). Für „darf ich streichen?" braucht man Verhaltens-Überlappung (Coverage/Mutation), nicht Quelltext-Ähnlichkeit. Text-Ähnlichkeit ist das schwächste von drei Signalen. |
| **Nur beratend**                 | Er schreibt einen Report / öffnet evtl. ein Issue. Die Suite **schrumpft nie**.                                                                                                                                                |
| **Keine Widerspruchs-Erkennung** | Redundanz (dasselbe zweimal) hat er; Ordnungsabhängigkeit/Konflikt (Tests, die nur in einer Reihenfolge grün sind) fehlt vollständig — obwohl genau das der benannte Schmerzpunkt ist.                                         |
| **Keine Verification-Loop**      | Es gibt keinen Schritt „Kandidat entfernen → Suite + Coverage neu → unverändert?". Ohne das ist jede Streich-Empfehlung unbewiesen.                                                                                            |
| **Issue-Spam-Bug**               | `.github/workflows/test-optimization.yml:77-90` erstellt bei kritischen Findings **bedingungslos** ein neues Issue (kein Dedup). Persistente Findings → tägliches Duplikat.                                                    |
| **Regex fragil**                 | Nur `test(`-Blöcke (nicht `it()`), `toBe` fehlt in der Observable-Liste, `});`-am-Zeilenanfang als Block-Ende.                                                                                                                 |

**Konsequenz:** Der Job wird ignoriert, weil man ihm nicht traut — und richtig: eine Heuristik, die nie validiert wurde, ist keine Streich-Grundlage.

---

## 3. Leitarchitektur: deterministische Engine + Claude (via `setup-claude`)

Zwei Schichten, klare Rollen — analog zur bestehenden Pipeline (`01-claude-triage.yml` … `05-claude-pr-fixup.yml`):

```
Deterministisch (bash/TS)  →  Claude (setup-claude)  →  Deterministisch (Trust-Loop)  →  PR
   harte Signale              semantische Auswahl          Verifikation durch Re-Run        via App-Token
   + Ground Truth             + Begründung                 (Claude schlägt vor,            (setup-claude liefert
                                                           der Re-Run entscheidet)          GH_TOKEN + git creds)
```

**Trust-Grenze (essenziell):** Claude **schlägt vor**, der Re-Run **entscheidet**. Das Vertrauen für „sicher streichbar" kommt **immer** aus der deterministischen Verification-Loop, nie aus dem LLM. Ein LLM irrt sich gelegentlich bei „die zwei prüfen dasselbe" — der Re-Run fängt das.

**Provider-Strategie:** Bulk-Klassifikation auf `vars.LLM_PROVIDER=zai` (GLM, billig); nur harte/ambige Fälle auf `claude`. Claude läuft **nur auf Kandidaten**, nie über die ganze Suite.

---

## 4. Machbarkeits-Befund (Tooling-Check, 2026-08-08)

| Ebene             | Coverage-Tooling                                                                                                    | Konsequenz                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Frontend-Unit** | `@vitest/coverage-v8` (4.1.10), Script `test:coverage` vorhanden — aber **aggregiert**.                             | Pro-Test-Matrix muss über **isolierte Runs pro Test/Datei** selbst aufgebaut werden.                  |
| **Server**        | Node-Test-Runner `--experimental-test-coverage`, Thresholds 90/85/85 — existierendes Coverage-Gate, **aggregiert**. | Pro-Test-Matrix ebenfalls isolierte Runs; Thresholds bleiben als zusätzliche Untergrenze erhalten.    |
| **E2E**           | **Keine** Coverage-Infrastruktur.                                                                                   | Hier sitzt die schlimmste Aufblähung (375px × 21 Specs) → **eigener, semantischer Track via Claude**. |

**Daraus folgt:** Reduktion läuft in **zwei Tracks** — Unit (coverage-basiert, hoch-vertrauenswürdig deterministisch) und E2E (semantisch via Claude, menschlich bestätigt im PR).

---

## 5. Phasen

### Phase 1 — Unit-Reduktions-Engine (Coverage-Matrix + Set-Cover + Verification-Loop)

_Das Vertrauens-Fundament. Liefert ohne Claude eine bewiesene „sicher streichbar"-Liste._

**Artefakte (neu):**

- `scripts/test-reduction/coverage-matrix.ts` — baut die Pro-Test-Coverage-Matrix durch isolierte Runs.
- `scripts/test-reduction/set-cover.ts` — Greedy-Set-Cover: findet Tests, deren Coverage-Menge ⊆ Union der anderen → Streich-Kandidaten.
- `scripts/test-reduction/verify-removal.ts` — entfernt jeden Kandidaten, läuft Suite + Coverage neu, vergleicht die Union. Nur bei **Delta == 0** → `removal-verified.json`.
- `.github/workflows/test-reduction.yml` — getriggert (`schedule` + `workflow_dispatch`), führt Phase-1-Schritte aus.

**Vorgehen:**

1. Pro Test-Datei (Granularität Datei reicht i.d.R. für Redundanz; einzelne Tests optional) isoliert mit v8-Coverage laufen lassen → Map `test → {file,line,branch}-Menge`.
2. Set-Cover: Kandidat = Test, dessen Menge in der Union der restlichen enthalten ist.
3. Verification-Loop: Kandidat entfernen → `test:coverage` neu → Union vergleichen. Coverage-Verlust → BEHALTEN (war doch nötig).
4. Ausgabe `removal-verified.json` (ausschließlich bewiesenermaßen redundante Tests).

**Trust-Signal:** Coverage-Union nach Streichung unverändert = _coverage-bewiesen_ redundant. Caveat: Coverage ≠ Bug-Fang (eine Zeile abgedeckt ≠ richtig assertiert). → Phase-1b (optional): **Mini-Mutation** — Assertion flippen / Source-Zeile im Deckungsbereich brechen und prüfen, ob ein _anderer_ Test es noch fängt. Erhöht Trust von „coverage-redundant" auf „bug-redundant".

**Abhängigkeiten:** keine (abgekoppelt von Claude).

### Phase 2 — Widerspruchs-/Ordnungs-Erkennung (benannter Schmerzpunkt)

_Findet die „durch Aneinanderreihung gehaltenen" Widersprüche._

**Artefakte:**

- `scripts/test-reduction/shuffle-detect.ts` — Suite in randomisierter Reihenfolge laufen lassen (Vitest `--shuffle`; Playwright eigene Reihenfolge-Randomisierung). Diff der Failure-Mengen.
- Ausgabe `order-dependence.json`: Tests, die nur in bestimmten Reihenfolgen grün sind = verdeckte Kopplung/Konflikt.

**Trust-Signal:** Ordnungsabhängigkeit ist **bewiesen** (Test rot bei anderer Reihenfolge). Solche Tests sind keine Streich-, sondern **Reparatur-Kandidaten** (Shared State kapseln / Isolation herstellen).

### Phase 3 — Claude semantische Schicht (via `setup-claude`)

_Fälle, die Coverage nicht entscheiden kann — v.a. E2E und ambige Unit-Fälle._

**Artefakte:**

- Erweiterung `.github/workflows/test-reduction.yml`: `uses: ./.github/actions/setup-claude` + `claude -p`-Step.
- Claude-Prompt bekommt: `removal-verified.json` + `order-dependence.json` + **E2E-Spec-Quellen**.

**Claudes Aufgaben:**

1. **E2E-Dedup** (primär, da keine Coverage): Specs lesen, identische User-Flows gruppieren (der 375px×21-Fall), „stärkste Formulierung behalten" vorschlagen.
2. **Ambige Unit-Fälle** lösen: Tests mit verschiedenem Code, aber evtl. gleichem Verhalten — Lesen des Intents nötig.
3. **Widersprüche semantisch** beurteilen (geht über Shuffle-Signal hinaus).
4. **Begründung + PR-Body** schreiben.

**VERDICT-Contract** (executor-agnostisch, contract-test-bar — wie bestehende Pipeline):

```
CUT: <file::test> | KEEP: <reason> | MERGE: <a,b> → <keep>
```

**Wrinkle:** `setup-claude` ist ticket-zentrisch (`event-type` + `ticket-ref` → Issue/PR, Memory keyed auf Issue-Nr.). Für getimten Job: `memory-load=false`, `ticket-ref` synthetisch (z.B. `reduction-<run_id>`).

**Trust-Signal für E2E:** niedriger als Unit (keine Coverage) → Claude-Vorschläge landen als **PR mit Review-Pflicht**, nicht auto-mergend. Optional: Canary-Break (Verhalten absichtlich brechen, prüfen ob Rest-Suite rot wird) als Nach-Mast-Check.

### Phase 4 — Add-Gate (Wieder-Aufblähen verhindern)

_Die Wurzel von „nie abgebaut" an der Entstehungsstelle schließen._

**Artefakte:**

- `.github/workflows/test-add-gate.yml` auf `pull_request` (nur wenn Test-Dateien hinzugefügt/geändert).
- Logik: Coverage-Delta des neuen Tests gegen `main`. Wenn der Test **keine** neuen Zeilen/Branches abdeckt, die nicht schon abgedeckt waren → Warnung/Block-Kommentar.

**Trust-Signal:** Neuer Test muss **beweisen**, dass er etwas abdeckt, das nichts anderes abdeckt. Dreht die add-only-Dynamik um.

### Phase 5 — Alt-Job aufräumen

- **Issue-Spam-Fix** in `test-optimization.yml`: vor `create` offenes Issue mit Label `test-maintenance` suchen → Kommentar/Update statt Neu-Erstellung.
- **Entscheidung:** `analyze-test-suite.ts` (AST statt Regex, `it()` abdecken, `toBe` nachziehen) weiterpflegen **oder** stilllegen, sobald die Reduktions-Engine die Diagnostik subsumiert. Heuristiken (Tautologie, Empty-Set) bleiben als **günstige Vorfilter** für Phase 3 erhalten.

---

## 6. Dateiübersicht

| Aktion     | Pfad                                                                                                                   | Phase |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| **neu**    | `scripts/test-reduction/coverage-matrix.ts`                                                                            | 1     |
| **neu**    | `scripts/test-reduction/set-cover.ts`                                                                                  | 1     |
| **neu**    | `scripts/test-reduction/verify-removal.ts`                                                                             | 1     |
| **neu**    | `scripts/test-reduction/shuffle-detect.ts`                                                                             | 2     |
| **neu**    | `.github/workflows/test-reduction.yml`                                                                                 | 1 → 3 |
| **neu**    | `.github/workflows/test-add-gate.yml`                                                                                  | 4     |
| **ändern** | `.github/workflows/test-optimization.yml` (Issue-Dedup)                                                                | 5     |
| **prüfen** | `.github/scripts/analyze-test-suite.ts` (AST/Stilllegung)                                                              | 5     |
| ~~neu~~    | ~~`.github/scripts/test-reduction-contract.test.ts`~~ (VERDICT-Contract) — **ADR 0001: entfällt, kein `.github`-Test** | —     |

---

## 7. Risiken & offene Punkte

- **Pro-Test-Matrix-Kosten:** O(Tests) isolierte Runs. Für nächtlichen Job vertretbar; shardbar. Granularität = Datei (nicht Einzeltest) als Kosten/Nutzen-Kompromiss.
- **Coverage ≠ Mutation:** Verify-Loop liefert _Coverage-Trust_, nicht _Bug-Trust_. Mini-Mutation (Phase-1b) optional für hochkritische Streichungen.
- **E2E-Trust niedriger:** Keine Coverage → Claude-Vorschläge + PR-Review-Pflicht, kein Auto-Merge.
- **Claude-Kosten:** nur auf Kandidaten, Provider `zai`, strukturierte Batch-Output statt Einzel-Call.
- **Verify-Loop-Laufzeit:** parallelisieren/sharden; ggf. nur auf Top-N Kandidaten pro Lauf.
- **Öffne Frage:** Set-Cover findet die _minimale_ Teilmenge — wollen wir tatsächlich bis aufs Minimum streichen, oder eine Sicherheits-Hülle (z.B. mind. 2 Tests pro Akzeptanzkriterium) behalten? Entscheidung offen.

---

## 8. Erfolgskriterien / Metriken

- **Suite-Größe ↓** (Anzahl Tests/Laufzeit) bei **Coverage-Union unverändert** (kein Verlust).
- **CI-Laufzeit ↓** messbar.
- **Null eingeschlichene Regressionen:** Canary-Check — Verhalten absichtlich brechen, Rest-Suite muss rot werden.
- **Keine Ordnungsabhängigkeit mehr:** Suite läuft in jeder Reihenfolge grün.
- **Add-Gate greift:** neue Tests ohne neuen Deckungsbeitrag werden abgewiesen → Wachstum gebremst.

---

## 9. Empfohlene Reihenfolge

1. **Phase 5 (Issue-Spam-Fix)** — trivial, sofort, beseitigt aktiven Bug.
2. **Phase 1 (Unit-Engine + Verification-Loop)** — liefert ohne Claude ersten vertrauenswürdigen Streich-Ertrag.
3. **Phase 2 (Shuffle)** — adressiert den Widerspruchs-Schmerzpunkt direkt.
4. **Phase 3 (Claude via setup-claude)** — öffnet E2E-Track + ambige Fälle.
5. **Phase 4 (Add-Gate)** — hält das erreichte Niveau.

_Phasen 1–2 liefern Wert unabhängig von Claude und sind die Vertrauens-Basis, auf der Phase 3 erst sicher aufsetzen darf._
