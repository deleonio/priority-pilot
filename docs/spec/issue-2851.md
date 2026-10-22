# Spec: Issue 2851 — Bestehende Push-Nachrichten öffnen ihr Thema statt der Startseite

## Ziel

Tippt jemand eine Push-Benachrichtigung an, öffnet die App die Karte, Seite oder Aufgabe aus
`docs/push-konzept.md` §6 — nicht mehr die Startseite. Die Auslieferung steht bereits:
`frontend/public/push-sw.js` öffnet bei `notificationclick` die `payload.url` (App-Pfade werden
auf den `/app/`-Scope aufgelöst), das Anker-Springen im Dashboard lief #2848. Nur der Server
versendet heute noch `url: '/'` (streak-reminder: `/aufgaben`).

## Vertrag: `server/src/logics/pushTargets.ts` (neu, AK2)

Die Ziel-Strings stehen in **einer** Server-Liste (je Push-Art ein Eintrag); die neun Sender
beziehen ihr Ziel daraus, statt es als Literal zu duplizieren. Die Bündelungs-Regel
„eine Aufgabe vs. mehrere" ist als abbildbare Funktion vertreten:

| Push-Art          | Ziel (§6)                                                     |
| ----------------- | ------------------------------------------------------------- |
| `dueTask`         | eine: `(id) => /tasks/<id>` · mehrere: `/#karte-deadlines`    |
| `dailyTopTasks`   | eine: `(id) => /tasks/<id>` · mehrere: `/#karte-top-aufgaben` |
| `carePush`        | `/#karte-fuersorge`                                           |
| `streakReminder`  | `/#karte-streak`                                              |
| `monthlyRecap`    | `/#karte-monatsrueckblick`                                    |
| `milestone`       | `/#karte-meilensteine`                                        |
| `taskCreated`     | `(id) => /tasks/<id>`                                         |
| `taskCompleted`   | `(id) => /tasks/<id>`                                         |
| `seriesGenerated` | `/serien`                                                     |

Geo-Nearby bleibt unverändert `/tasks/<id>` (Deep-Link, bereits durch
`geo-background-job.test.ts:169,186` gedeckt — kein neuer Test).

## Voraussetzungen

- Frontend-Anker aus #2848 vorhanden: `karte-deadlines` (Dashboard.tsx:846),
  `karte-top-aufgaben` (Dashboard.tsx:686), `karte-fuersorge` (CareHint.tsx:178),
  `karte-streak` (StreakCard.tsx:67), `karte-monatsrueckblick` (MonthlyBalanceCard.tsx:107),
  `karte-meilensteine` (MilestoneBadges.tsx:56).
- Frontend bleibt unberührt (ux = nein — reine Server-Logik).

## Tests (rot)

- **AK2/AK4:** `server/src/logics/pushTargets.test.ts` (neu) — Liste enthält je Push-Art das
  §6-Ziel (inkl. Regel „eine Aufgabe vs. mehrere" als Funktion); Spiegel-Test liest die fünf
  Frontend-Komponenten (Dashboard, CareHint, StreakCard, MonthlyBalanceCard, MilestoneBadges)
  und failt, wenn ein `/#karte-…`-Anker der Server-Liste dort nicht als `id="…"` existiert
  (Muster `careDeficit.test.ts:146-170`).
- **AK1/AK3:** Payload-`url`-Assertionen in den neun Sender-Tests — Bestands-Tests erweitert;
  die alten Assertionen auf `url: '/'` bzw. `/aufgaben` werden angepasst (Test-Pflege-Bedarf,
  s. PR-Body).

## Erwartetes Ergebnis

Jede der neun Push-Arten trägt exakt das §6-Ziel. AK3: Ein Push „Neue Aufgabe von …" trägt
exakt `url: '/tasks/<id>'` der neu angelegten Aufgabe.
