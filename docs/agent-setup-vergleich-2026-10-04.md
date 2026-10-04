# Agent-Setup-Vergleich: Runtime × Provider (29.09.–03.10.2026)

Vier-Tage-Vergleich der vier Setup-Kombinationen aus Agent-Laufzeit (Claude Code, pi)
und LLM-Provider (Anthropic, z.ai): Kosten, Laufzeiten, Durchsatz und Nacharbeit — plus
die Erkenntnis, dass der eigentliche Durchsatz-Engpass die Concurrency-Gruppe `llm` ist,
nicht das Modell.

## Datenbasis

- `.costs/<issueId>.json`: je Phasen-Lauf ein Satz (Timestamp, Tokens in/out, Turns,
  Kosten, Provider; `runtime`-Feld seit [#2090](https://github.com/deleonio/priority-pilot/issues/2090)).
- Workflow-Runs je Phase über die GitHub-API (`created`-Filter, skipped Runs ausgeschlossen).
- Messfenster: je Tag 04:00–04:00 MESZ. Reale Umschalt-Zeitpunkte: Provider→ZAI am
  01.10. ~05:30, Runtime→pi (v0, gepinnt 0.87.1) am 02.10. ~06:12, pi `@latest` (v1)
  am 03.10. 14:16 ([#2108](https://github.com/deleonio/priority-pilot/issues/2108)).

## Kosten je Phasen-Lauf

| Setup          | LLM-Läufe | Ø Turns | Ø In-Tokens | Ø Out-Tokens | Ø Kosten |
| -------------- | --------- | ------- | ----------- | ------------ | -------- |
| CC + Anthropic | 157       | 15,1    | 1,08 M      | 7,3 k        | $0,72    |
| CC + ZAI       | 79        | 23,9    | 2,26 M      | 14,9 k       | $0,65    |
| PI v0 + ZAI    | 137       | 21,1    | 1,50 M      | 22,0 k       | $0,54    |
| PI v1 + ZAI    | 41        | 29,1    | 2,18 M      | 24,9 k       | $0,68    |

Der Documenter läuft über OpenRouter (Free-Model, $0) und ist kostenneutral.

Tageskosten vs. Output (Issues geschlossen / PRs gemergt): 30.09. $99 (32/21) ·
01.10. $62 (16/24) · 02.10. $50 (20/25) · 03.10. $56 (33/30). Die Kosten pro erledigtem
Issue haben sich von ~$3,10 auf ~$1,70 halbiert — Hebel war der Provider-Wechsel auf ZAI,
nicht die Runtime.

## Laufzeiten (Median echter Läufe) und Nacharbeit

| Phase      | CC+Anthropic | CC+ZAI | PI v0+ZAI        | PI v1+ZAI       |
| ---------- | ------------ | ------ | ---------------- | --------------- |
| Triage     | 5,7 min      | 5,1    | 10,5             | 9,3             |
| Spec       | 34,5         | 14,4   | 49,2             | 24,3            |
| Implement  | 32,4         | 32,6   | 42,1             | 59,9            |
| Review     | 10,3         | 13,7   | 23,9 — 23 % fail | 21,0 — 0 % fail |
| Documenter | 3,1          | 4,4    | 6,3 — 16 % fail  | 3,9 — 0 % fail  |

Fixup-Bilanz je Issue: CC+ZAI 0,57 (43 % der Issues, 10 % mit ≥2) · PI v0 0,44 (37 %/7 %)
· **PI v1 0,20 (20 %/0 %)**. Nacharbeit ist also nicht der Zeitfresser — PI v1 hat die
sauberste Bilanz. Echter Kostenvorbehalt von PI v1: der Fixup-Lauf selbst ($1,06, Ø 5,2 M
Input-Tokens, 45,7 Turns — der Context wird komplett neu gelesen; n=3).

## Durchsatz ist flusslimitiert, nicht rechenlimitiert

- Die LLM-Slots sind nur zu **12–35 % belegt** (aktive Job-Stunden je Tag gegen 6 Slots × 24 h).
- Ein Issue braucht im Median **1,4–1,7 h** (Analyse→Review-Ende); die p90 von 5,4–8,8 h
  kommt fast komplett aus **Warte-Lücken zwischen den Phasen** (Ø 1,8–2,7 h pro Issue).
- Extremfälle: [#2009](https://github.com/deleonio/priority-pilot/issues/2009) und
  [#1972](https://github.com/deleonio/priority-pilot/issues/1972) standen 14–16 h zwischen
  Analyse und Spec; am 03.10. liefen Spec/Implement als Einer-Kette mit 5,5 h Leerstrecke.
- Ursache der Serialisierung: die gemeinsame Concurrency-Gruppe `llm` für Spec (03),
  Implement/Fixup (04) und team — strikt ein Run gleichzeitig. Damit liegt die Kapazität
  dieser Stufe bei ~1,5 h/Issue ≈ **16–20 Issues/Tag**; gemessene 30 PRs/Tag lagen damit am
  bzw. über dem geschätzten Limit. Details und Barriere-Falle: Kommentar in `01-triage.yml`
  (CONCURRENCY-Block).

## Erkenntnisse

1. **Der Provider dominiert die Kosten**, die Runtime ist Zweitfaktor: ZAI halbierte die
   Tageskosten bei gleichem oder höherem Output, obwohl ZAI-Läufe mehr Turns und mehr
   Output-Tokens erzeugen.
2. **PI v0 ist der falsche Preisführer**: nominell der günstigste Lauf ($0,54), aber
   16–23 % Fail-Quoten in Review/Documenter/Implement erzeugen Fixup-Schleifen, die die
   Ersparnis auffressen.
3. **PI v1 ist auf CC+ZAI-Niveau** ($0,68 vs. $0,65) mit den besten Fail-Quoten — aber
   2× Turns und 60 min Implement-Median. Nach dem Pin-Remove (#2108) zieht jeder Lauf
   `@latest`: Laufzeit-Messungen bleiben schwer vergleichbar, wenn sich die Version
   täglich ändert.
4. **CC+Anthropic ist abgewählt** (teuerster Tokenpreis ohne Qualitätsvorteil).

## Empfehlung und offene KPIs

PI v1 + ZAI produktiv lassen und über KPIs entscheiden (Messung je Tag):
Review-Fail-Quote < 10 %, Implement-Median < 40 min, Turns/Lauf < 25, Fixup < $0,70.
Erfüllt PI v1 das, bleibt es (auf dem pi5-Runner zusätzlich 3–4× günstiger); sonst
Rückwechsel auf CC+ZAI per `gh variable set` — der Wechsel kostet nur Minuten.

Nächster Durchsatz-Hebel, größer als jede Modellentscheidung: die `llm`-Gruppe splitten
(`llm-spec` / `llm-impl`) — nur zusammen mit dem Verschieben des Folge-Labels auf den
letzten Job-Step (Job-Ende-Barriere, s. `01-triage.yml`). Danach limitiert der Issue-Zulauf
bzw. die Implement-Dauer, nicht mehr die Concurrency. Zusätzlich zu fixen: die mechanischen
Triage-Fails ([#2138](https://github.com/deleonio/priority-pilot/issues/2138), Container-Step).

## Nachtrag 04.10.: Entkopplung umgesetzt — und eine Korrektur

Die Entkopplung ist umgesetzt: Spec läuft in `llm-spec`, Implement/Fixup + team in
`llm-impl` (jeweils `queue: max`, `cancel-in-progress: false`). Innerhalb eines Issues
ketten die Labels weiter; Implement ↔ Fixup desselben Issues serialisieren weiterhin über
die gemeinsame Gruppe `llm-impl` (ADR 0005). team.yml bewusst nicht in eine dritte Gruppe —
erst messen, ob `llm-impl` dauerhaft belegt ist.

Dabei eine Korrektur an der eigenen Argumentation: Der Übergang Implement→Review (04→05)
ist **kein** Beleg dafür, dass Gruppen-Grenzen unkritisch sind — Review wartet als ersten
Schritt auf CI (bis zu 20 min), hat den Puffer also eingebaut. Spec→Implement hat keinen
solchen Puffer; deshalb setzt 03 das Folge-Label (`ai:needs-impl` bzw. `ai:needs-spec` beim
Partial-Retry) jetzt als **allerletzten Job-Step** (`label-final`), nachdem
Ergebnis-Zusammenfassung und Fair-Usage-Check durch sind. Die Rest-Überlappung schrumpft
auf Composite-Post-Steps (Sekunden); der Runtime-Precheck von 04 skippt zusätzlich bei
veraltetem Label-Zustand. Bewusst nicht umgesetzt: issue-granulare Concurrency-Keys (der
Fixup-Eingang triggert über den PR — die PR→Issue-Normalisierung wäre eine Überhol-Falle).

Zu beobachten nach dem Merge: Besetzung von `llm-impl` (dauerhaft ~1 ⇒ nächster Schritt:
team raus), Fixup-Quote (drücken zwei parallele Git-Phasen die Qualität?), Merge-Kollisionen
auf main. Erwartung: Kapazität der Engpass-Stufe von ~16–20 auf ~30–40 Issues/Tag.

## Confounds (sauber lesen)

Der Vergleich ist kein sauberes A/B: Issue-Mix unterscheidet sich je Tag (P0-Onboarding vs.
Pipeline-Meta), das zai-Peak-Vertagen ([#2100](https://github.com/deleonio/priority-pilot/issues/2100))
ging am 03.10. morgens live, das `runtime`-Feld (#2090) wurde zeitgleich mit dem PI-v1-Wechsel
deployt (daher die 15 Triage-Fails an dem Tag = Mechanik, nicht Modell), und die PI-v1-Stichprobe
war anfangs auf wenige Stunden begrenzt.
