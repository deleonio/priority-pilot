# ADR 0008 — Delegation nach unten, Mentor nach oben

- **Status:** Accepted
- **Datum:** 2026-08-29
- **Entscheidungsquelle:** User-Direktive („Claude-Code-Potenziale voll ausschöpfen — Subagents
  und Mentor geschickt einsetzen, diffenzierte Modelle je Teilaufgabe, Eskalation aus
  Kreisläufen mit schwachen Modellen")
- **Schreibt fort:** [ADR 0004](0004-analyse-getriebenes-routing.md) (Routing je Phase →
  zusätzlich Steuerung innerhalb einer Phase)
- **Pilot:** Umsetzung/Fixup (04) und Review (05) — dort liegen laut Messreihe 97 % des
  bewerteten Verbrauchs (Review+Fixup, Issue #993)

## Kontext

ADR 0004 wählt Modelle **pro Phase** (Routing-Tabelle > Label > Default). Innerhalb eines Laufs
läuft alles auf einem Modell: Die Umsetzung liest mit `opus` Gate-Logs, sucht mit `opus` nach
Aufrufern und fixt mit `opus` einen Tippfehler. Und wenn ein schwaches Modell in der
Review→Fixup-Schleife feststeckt, wiederholt es denselben Versuch, bis der Rundendeckel es an
den Menschen übergibt — Rat holt es sich nie.

Zwei Ebenen fehlten:

1. **Delegation nach unten** für Teilaufgaben, die viel Rohtext erzeugen und ein kurzes
   Ergebnis liefern (breites Lesen, Kommandoketten ausführen, Logs sichten).
2. **Eskalation nach oben** für Blockaden, wo ein einmaliger, teurer Rat billiger ist als
   eine weitere Schleifenrunde (#932: 10 Review- + 4 Fixup-Läufe, 34,5 Mio Token ohne
   Konvergenz).

Die Infrastruktur war teilweise vorhanden, aber ungenutzt: `setup-claude` kennt
`subagent-model` (`CLAUDE_CODE_SUBAGENT_MODEL`), `Task` stand in der `restricted`-Allowlist,
die Triage setzt `subagent-model: haiku` — aber kein Prompt oder Skill wies an zu delegieren.

## Entscheidung

Zwei Mechanismen mit klarer Arbeitsteilung — sie dürfen sich nicht ins Gehege kommen:

|          | Delegation (Subagent)                            | Eskalation (Mentor)              |
| -------- | ------------------------------------------------ | -------------------------------- |
| Richtung | nach unten, billiger                             | nach oben, teurer                |
| Modell   | `haiku`, global via `CLAUDE_CODE_SUBAGENT_MODEL` | `opus`, eigener Prozess          |
| Auslöser | der Agent selbst, nach SKILL-Regel               | deterministischer Workflow-Step  |
| Aufgabe  | breit lesen, ausführen, fassen                   | einmal urteilen, Weg vorschlagen |
| Rückgabe | kurzes Fazit, nie Rohtext                        | ≤ 40 Zeilen Handlungsanweisung   |

### 1. Delegation: statische Rollen mit Rückgabevertrag

Zwei Rollen in `.claude/agents/` (Frontmatter `model: haiku`, Tools minimal je Rolle):

- **`recherche`** — read-only Suchfragen („wo wird X aufgerufen", „welche Tests decken Y ab",
  „wie löst die Bestandsstelle Z das"). Antwort ≤ 30 Zeilen, Pfade als `datei:zeile`,
  nie Dateiinhalte.
- **`gate-runner`** — führt die Gate-Kette (`pnpm format`, `prettier --check`, `lint`, `knip`,
  `test`) aus und meldet je Kommando nur exit code + Fehlersignatur mit `datei:zeile`.

**Das Kriterium ist der Dreh- und Angelpunkt:** Delegiert wird, wo die Teilaufgabe **viel
Rohtext erzeugt und ein kurzes Ergebnis liefert**. Der Vertrag steht in der Agent-Datei, nicht
im aufrufenden Prompt — eine Rolle ohne Rückgabevertrag verdoppelt Tokens statt sie zu sparen,
denn jedes Ergebnis fließt in den Elternkontext zurück (ADR 0004, „Verworfene Alternative",
Argument 1).

**Gegenregel:** Der eigentliche Code-Änderungsschritt und das Review-Urteil bleiben beim
Phasenmodell. Delegation ersetzt **Kontextbeschaffung**, nie Urteilsbildung.

**Modellwahl:** `CLAUDE_CODE_SUBAGENT_MODEL` überschreibt das `model:`-Frontmatter aller
Subagents — beide Rollen stehen auf `haiku`, der CI-Override ebenfalls (`subagent-model:
haiku`), also kein Konflikt. Wird je eine Rolle mit anderem Modell gebraucht, ist das ein
Widerspruch zu diesem ADR, kein Feature-Wunsch. `inherit` bliebe möglich, liefe aber auf dem
Phasenmodell und kehrte die Kostenlogik um.

### 2. Mentor: eigener Prozess vor dem Phasenlauf

Der Mentor ist **kein Subagent**, sondern ein eigener `claude -p`-Step im selben Job, **vor**
dem Phasen-Step (read-only: `Read,Glob,Grep,Bash(gh *),Bash(git *)`). Gründe:

- Als Subagent unterläge er dem globalen `CLAUDE_CODE_SUBAGENT_MODEL`-Override — billiger
  Fan-out und teurer Mentor können nicht gleichzeitig als Subagents mit verschiedenen
  Modellen laufen. Der Override-Aufsatz zugunsten eines Mentor-Subagents würde den Fan-out
  auf das Phasenmodell heben und die Ersparnis aus Entscheidung 1 kippen.
- Als eigener Step ist er budgetierbar (eigene Soft-Deadline, ~8 Min), bekommt einen eigenen
  `record-cost`-Eintrag (`phase: mentor`) und ist mit `continue-on-error` fail-open: Ohne Rat
  läuft die Phase normal weiter.

**Auslöser — deterministisch, kein LLM-Ermessen** (`mentor-gate.sh`, via `node:test`
abgedeckt wie `fixup-rounds.sh`):

| Eingang   | Auslöser                                           | Signalquelle                        |
| --------- | -------------------------------------------------- | ----------------------------------- |
| Fixup     | `rounds >= 2` (ab der 2. Review→Fixup-Runde)       | `fixup-rounds.sh` (bestehend)       |
| Umsetzung | `escalated == true` (Wiederholung nach Soft-Abort) | `resolve-escalation.sh` (bestehend) |

Genau einmal je Job; dieselben Signale, die die Pipeline ohnehin schon zählt.

**Auftrag** (`.github/prompts/mentor.md`): Liest den `<!-- ai-review -->`-Sammelkommentar,
Diff bzw. Analyse-Block, den gesäuberten CI-Log-Tail und die Phasen-Notizen. Schreibt
`/tmp/mentor-advice.md`, ≤ 40 Zeilen, drei Abschnitte: **Ursache** (warum die bisherigen
Versuche scheitern — nicht was das Finding sagt), **Weg** (konkret, mit Datei und Reihenfolge),
**Fallen** (was der letzte Versuch übersehen hat). Kein Schreibzugriff, kein Label, kein
Kommentar — der Rat geht nur an die Phase.

**Einspeisung:** Der Rat wird als Markerblock (`═══ MENTOR-RAT (VERBINDLICH) ═══` …) an den
Phasen-Prompt angehängt — nicht per `sed` in einen Platzhalter substituiert, weil der Rat
LLM-Freitext ist und `{{…}}` enthalten darf (`assert-prompt-complete.sh` würde fälschlich rot;
der Block wird wie der Vor-Phasen-Kontext ausgenommen). Die Phase weicht nur mit Begründung
in ihrer Phasen-Notiz ab.

**Kostenabgrenzung:** `record-cost` summiert alle Transkriptzeilen seit `--since` — der
Phasen-Datensatz zählt ab Mentor-**Ende** (nicht ab Job-Start), sonst verbuchte er die
Mentor-Tokens als Phasenkosten.

**Modell:** `vars.CLAUDE_MODEL_MENTOR` (Default `opus`). Die Auflösung folgt der
setup-claude-Bauform: bei `claude` natives `--model`, bei `zai`/`openrouter` Alias per
`jq` in `settings.local.json` (Auflösung über die bereits gesetzten
`ANTHROPIC_DEFAULT_*_MODEL`) — dieselbe Alias-Tabelle wie setup-claude, dort als Pflegestelle
geführt.

### 3. Prompt-Audit-Kriterium G

Die Delegations- und Eskalations-Ökonomie wird Prüfkriterium des nächtlichen Prompt-Audits
(Kriterium G, Kategorie `Delegation`): Hält ein Prompt Arbeit im teuren Elternkontext, die
eine günstige Rolle erledigen könnte? Und nennt er in Blockade-Situationen einen konkreten
Ausweg statt denselben Versuch zu wiederholen? Die bestehende NET-Kosten-Logik des Audits
trägt beides: Ein Delegationsfund spart im Elternkontext und kostet im Subagenten.

## Revision von ADR 0004, „Verworfene Alternative: ein Claude Team mit Subagent-Rollen"

ADR 0004 verwirft, die Phasen als Subagent-Rollen **in einem Prozess** zu fahren. Vier
Argumente — zwei tragen weiter, zwei waren zu breit formuliert:

- **Bestätigt — Hard Stop braucht die Prozessgrenze.** `ai:needs-human` parkt ein Ticket
  tagelang; ein Actions-Job ist endlich. Phasen bleiben getrennte Workflows.
- **Bestätigt — Serialisierung, Review, Spec-Vertrag hängen an GitHub.** `concurrency`,
  Review nach CI, Draft-PR als Artefakt zwischen Läufen.
- **Zurückgeführt — „er kehrt die Kostenlogik um".** Richtig für _Phasen als Subagents_ (die
  Elternsession bleibt resident, jedes Ergebnis fließt zurück). Nicht richtig, sobald das
  Ergebnis kleiner ist als der gelesene Rohtext — genau das macht der Rückgabevertrag der
  Rollen zur Bedingung. ADR 0004 nannte die Analyse als „den einzigen Ort" dieser Ausnahme;
  ein Ort ist keine Begründung, das Kriterium („Elternkontext schlank halten") trägt überall.
- **Zurückgeführt — „Pro-Subtask-Modellwahl ist unmöglich".** Belegt war die Unmöglichkeit
  _dynamischer_ Wahl zur Laufzeit („diese Subtask `haiku`, jene `opus`"). Statische Rollen
  nach Aufgabentyp sind davon nicht betroffen: Delegiert wird nicht „diese Subtask", sondern
  „diese Art von Arbeit". Dass `CLAUDE_CODE_SUBAGENT_MODEL` weiterhin global überschreibt,
  bleibt wahr und wird hier zur Randbedingung (alle Rollen auf einer Stufe).

Die „eng begrenzte Ausnahme" von ADR 0004 wird damit von einem **Ort** zu einem **Kriterium**:
Delegiert wird, wo die Teilaufgabe viel Rohtext erzeugt und ein kurzes Ergebnis liefert.
Die Verwerfung des Claude-Teams als Phasen-Ersatz bleibt bestehen — getragen von den zwei
bestätigten Argumenten.

## Konsequenzen

- **Umsetzung/Fixup und Review delegieren** Gate-Ketten bzw. Umfeldrecherche an `haiku`-
  Rollen; die Triage rückt nach (ihre Verdrahtung existierte bereits, nur die Anweisung
  fehlte). Ausrollen auf weitere Phasen erst mit Daten aus `.costs/`.
- **Der 04er kann in beiden Jobs einen Mentor-Vorlauf starten** — Fixup ab Runde 2,
  Umsetzung bei Eskalationslauf. Der Raten-Block ist für die Phase verbindlich, Abweichen
  nur mit Begründung in der Phasen-Notiz.
- **Agent-Rollen sind Pflegestelle der Modell-Allowlist**: Frontmatter `model:` trägt
  dieselben Aliase wie `resolve-model-label.sh`/`setup-claude` (Liste in
  [ci-architecture.md](../ci-architecture.md)); derselbe Freigabe-Prozess gilt.
- **Ob die CLI projekt-lokale Rollen (`.claude/agents/`) im Actions-Workspace lädt, ist im
  ersten Pilot-Lauf zu belegen** (Log-/Kosten-Split). Fallback ohne Codeänderung:
  `general-purpose` mit derselben Anweisung — der Modell-Override greift ohnehin global.
- **Zwei `claude -p`-Läufe je Job** sind der Preis der Mentor-Trennung: Er trägt sich, wenn
  eine vermiedene Schleifenrunde (2–4 Mio Token) teurer ist als ein Mentor-Lauf — genau die
  Rechnung, die `.costs/` nach dem Pilot ausweist.

## Abgrenzung — was dieses ADR NICHT entscheidet

- **Keine rollenbasierte Eskalation im Lauf** („Agent ruft bei Blockade selbst den Mentor"):
  bewusst verworfen — der Auslöser muss deterministisch außerhalb des blockierten Modells
  liegen, sonst ruft das schwache Modell nie an. Re-evaluierbar, falls In-Run-Blockaden
  auftreten, die kein Gate-Signal haben.
- **Keine Mentor-Rolle für Review (05) oder andere Phasen** im Pilot. Der Review erzeugt die
  Schleife, der Fixup hängt darin fest — der Mentor sitzt am Fixup-Eingang (und am
  Implement-Restart). Weitere Eingänge mit Daten.
