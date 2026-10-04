# Scores: Streak je /scores/balance-Request genau einmal berechnen, Test-Cast entfernen (#2157)

**Stand:** 2026-10-04 (Spec-Phase #2157, Findings aus dem Review von PR #2155 / Folge von #2150)

## Ziel

Ein `GET /scores/balance`-Request berechnet den Streak **genau einmal**: in der Route
(`berechneStreak` für das `streak`-Feld). `meilensteinStandVon` rechnet den Streak nicht mehr
selbst, wenn die Route ihre bereits berechneten Werte durchreicht — der `daten`-Seam aus
#2150 wird um `bestStreak`/`punkteSumme` erweitert. Außerdem entfällt der überflüssige
`as unknown as`-Cast in `server/src/logics/milestones.test.ts`.

## Vorbedingung

Eingeloggter Nutzer (Auth-Gate wie bisher). Antwort-Vertrag von `GET /scores/balance`
(`BalanceStatusDto`) bleibt inhaltlich unverändert.

## Verhalten

1. **AK1 — Antwort unverändert:** `/scores/balance` liefert dieselben Felder/Werte wie bisher.
   Abgedeckt durch die bestehenden #1423/#2150-Tests in `server/src/express/scores-balance.test.ts`
   (bleiben ohne Anpassung grün) — kein neuer Test (Dedup).
2. **AK2 — genau eine Streak-Berechnung je Request:** Die Route reicht ihren berechneten
   `best`-Streak und die Punkte-Summe über `daten` an `meilensteinStandVon` durch
   (`daten: { entries, bestStreak, punkteSumme }`). Übergebene Werte schlagen die interne
   Berechnung — heute rechnet `meilensteinStandVon` intern selbst, das ist der zweite Aufruf.
3. **AK3 — Rückfall unverändert:** Ohne `daten` verhält sich `meilensteinStandVon` exakt wie
   bisher (eigener `ScoreEntry.findAll`-Leselauf, eigene Berechnung; #2150-Test bleibt grün).
   Mit `daten.entries`, aber ohne `bestStreak`, wird der Streak weiterhin intern aus den
   Entries berechnet.
4. **AK4 — Cast entfällt:** In `server/src/logics/milestones.test.ts` steht kein
   `as unknown as` mehr; der #2150-Aufruf nutzt die typsichere Signatur direkt, Assertions
   bleiben inhaltlich unverändert; `tsc` strict bleibt grün.

## Tests

| TF  | AK  | Datei                                       | Kern                                                                                       | Startzustand   |
| --- | --- | ------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------- |
| TF1 | AK2 | `server/src/logics/milestones.test.ts`      | Übergebene `bestStreak`/`punkteSumme` schlagen die interne Berechnung (leere Entries, 0/0) | rot            |
| TF2 | AK3 | `server/src/logics/milestones.test.ts`      | `entries` ohne `bestStreak`: Streak/Punkte-Summe werden intern aus den Entries berechnet   | grün (Pinnung) |
| TF3 | AK4 | `server/src/logics/milestones.test.ts`      | #2150-Test ohne `as unknown as`-Cast, Assertions unverändert                               | grün (Pflege)  |
| —   | AK1 | `server/src/express/scores-balance.test.ts` | bestehende Tests bleiben unverändert grün (Dedup)                                          | grün           |

## Entscheidungen

- **Spy auf `berechneStreak` (EBN des Harness):** Ein echter Aufrufzähler auf `berechneStreak`
  ist im API-Test technisch nicht umsetzbar: Node 26.10 stellt `mock.module` nur hinter
  `--experimental-test-module-mocks` bereit (Probe verifiziert), und ESM-Bindings sind nicht
  patchbar — anders als `ScoreEntry.findAll` (statische Methode, Muster #2150). Einen
  Injection-Seam nur für den Test in Produktivcode zu ziehen, widerspricht dem Minimalgrundsatz.
  AK2 wird deshalb am `daten`-Seam als Vertrags-Test gefasst (TF1): gewinnt die
  durchgereichte `bestStreak` gegen die interne Berechnung, fließt der interne Streak-Lauf von
  `meilensteinStandVon` nicht mehr in das Ergebnis ein — zusammen mit den bestehenden
  #1423-Tests (die Route berechnet den Streak für das Antwortfeld, AK1) ist „genau eine
  Berechnung je Request" damit abgesichert.
- **TF2 ist bewusst grün (Pinnung):** das Rückfallverhalten existiert bereits und muss die
  Seam-Erweiterung überleben; eine Umsetzung, die `entries` ohne `bestStreak` bricht, färbt
  ihn rot.
