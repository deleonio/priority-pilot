# Spec #2606 — Gescheiterte PayPal-Kündigung im Kulanzfrist-Sweep wird erneut versucht

Erweitert [issue-2234.md](issue-2234.md). Code: `server/src/logics/billing/lifecycle.ts`, Tests: `lifecycle.test.ts`.

## Ziel

Schlägt `cancel` beim Fristablauf fehl, fällt das Abo heute aus dem Sweep (`firstFailureAt: null`) und PayPal könnte später abbuchen. Die Kündigung wird in späteren Sweeps wiederholt, bis sie gelingt oder die Versuchsgrenze erreicht ist.

## Voraussetzung

PayPal-Abo mit abgelaufener Kulanzfrist, `deps.cancel` wirft beim Entzug.

## Schritte und Erwartung

1. Entzug (Plan `free`, `grace_expired`, Mail) passiert genau einmal; der Fehlschlag wird am Abo festgehalten (Spaltenname Impl-Entscheid).
2. Folge-Sweep `applyDueGracePeriods` ruft `cancel` erneut auf (AK1).
3. Gelingt `cancel`, folgen keine weiteren Aufrufe (AK2).
4. Bei Erreichen der Versuchsgrenze: `console.error`-Billing-Fehler, danach kein `cancel` mehr (AK3).
5. Retry ändert Plan/Status nicht erneut, sendet keine zweite Mail; Rückgabewert zählt nur Entzüge (AK4).
6. Ohne `deps.cancel` und für Google-Play-Abos kein Retry.
