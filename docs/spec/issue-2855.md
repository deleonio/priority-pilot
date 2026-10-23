# Spec #2855 — Neue Fürsorge-Anlässe: Lob, Rückblicke, Journal-Impuls, Willkommen

Status: Spec-Phase (rote Tests) · Issue: #2855 · Konzept: `docs/push-konzept.md` §7.1

## Ziel

Sechs neue serverseitige Push-Anlässe nach dem Muster `carePush.ts`/`monthlyRecapPush.ts`: je
lokales Fenster, Häufigkeitsgrenze, Gruppenschalter und Ziel-Anker aus `PUSH_TARGETS`; Texte in
de und en nach der Prüffrage aus `docs/fuersorge-tonalitaet.md` (Prüffrage selbst = Review-Check,
nicht automatisiert). Kein UI-Change → keine E2E. Budget-Tor (max. 3/Tag) greift unverändert über
die bestehende Mechanik (`sendDedupedPush`, `pushBudget.ts`); die Ruhezeit 21–7 hält jedes
Anlass-Fenster selbst ein (kein Trigger sendet nach 21 Uhr), `sendDedupedPush` prüft keine Uhrzeit.

## Modul- und Namensvertrag (bindend für die Impl-Phase)

| Anlass              | Modul `server/src/logics/…` | Funktion                | Kind              | Schalter             | `PUSH_TARGETS`-Key → Ziel                  |
| ------------------- | --------------------------- | ----------------------- | ----------------- | -------------------- | ------------------------------------------ |
| Lob                 | `appreciationPush.ts`       | `runAppreciationPush`   | `appreciation`    | `carePushEnabled`    | `appreciation` → `/#karte-balance`         |
| Willkommen zurück   | `appreciationPush.ts`       | `runWelcomeBackPush`    | `welcome-back`    | `carePushEnabled`    | `welcomeBack` → `/#karte-balance`          |
| Wochenrückblick     | `recapPushes.ts`            | `runWeeklyRecapPush`    | `weekly-recap`    | `successPushEnabled` | `weeklyRecap` → `/#karte-wochenrueckblick` |
| Jahresrückblick     | `recapPushes.ts`            | `runYearlyRecapPush`    | `yearly-recap`    | `successPushEnabled` | `yearlyRecap` → `/#karte-jahresrueckblick` |
| Journal-Impuls      | `journalImpulsePush.ts`     | `runJournalImpulsePush` | `journal-impulse` | `carePushEnabled`    | `journalImpulse` → `/journal`              |
| Willkommensschritte | `welcomeStepsPush.ts`       | `runWelcomeStepsPush`   | `welcome-steps`   | `taskPushEnabled`    | `welcomeSteps` → `/#karte-willkommen`      |

Alle Funktionen: `(now?: Date, send?: PushSender) => Promise<{ usersNotified: number }>` —
Signatur, injizierbarer Sender und Dedup-Versand wie `runCarePush` (`sendDedupedPush`, Log nur
bei `sent > 0`). Zeitzone je `nutzerZeitzone(users.zeitzone)` (Fallback UTC), lokale Uhrzeit via
`uhrzeitIn` (`carePush.ts`), lokales Datum via `tagIn` (`streak.ts`). ISO-Woche im Format
`2026-W28` über Intl (Jahreswechsel-sicher, keine Handrechnung). Fenster: Anfang inklusive,
Ende exklusiv (Repo-Konvention).

## Verhalten je Anlass

### Lob (`appreciation`, AK1)

- Bedingung: `bewerteCareDefizit` meldet **weder** Defizit **noch** Überlast (Referenz-Setup:
  1 Säule, 1 Erledigung gestern — unter der Überlast-Mindestmenge, kein Defizit).
- Zusätzlich blockiert: lokaler Tag, an dem bereits ein `care-push`-Log existiert
  (Gegenprobe `kind='care-push'`, `dedupeKey = <userId>:<lokalesDatum>`).
- Häufigkeit: Dedup-Key `<userId>:<ISO-Woche>` → höchstens 1 je ISO-Woche. Tagesfenster Tag
  09–18 Uhr Ortszeit (Anfang inklusive, Ende exklusiv).

### Wochenrückblick (`weekly-recap`, AK2)

- Nur am lokalen Sonntag, Fenster 17:00–19:59 Uhr Ortszeit.
- Dedup-Key `<userId>:<ISO-Woche>` → höchstens 1 je Woche; Schalter `successPushEnabled` stoppt.

### Jahresrückblick (`yearly-recap`, AK3)

- Nur am lokalen 2. Januar, Tagesfenster 9–17 Uhr Ortszeit.
- Dedup-Key `<userId>:<Jahr des Rückblicks>` (= Vorjahr, Muster `vormonatVonTag`) → höchstens
  1 je Jahr; Schalter `successPushEnabled`.

### Journal-Impuls (`journal-impulse`, AK4)

- Nur wenn ein `JournalEntry` mit `createdAt` in den letzten 30 Tagen existiert.
- Abendfenster 18–20 Uhr Ortszeit (Anfang inklusive, Ende exklusiv).
- Häufigkeit: höchstens 2 je ISO-Woche, gezählt über `NotificationLog`-Einträge des Kinds der
  Woche; Dedup-Key `<userId>:<ISO-Woche>:<slot>` (Slot = fortlaufende Nummer, damit zwei Sends
  der Woche unterscheidbar bleiben). Schalter `carePushEnabled`.

### Willkommensschritte (`welcome-steps`, AK5)

- Genau am lokalen Kalendertag 2 nach `users.createdAt` (lokales Datum `now` = lokales Datum
  `createdAt` + 2 Tage), nur wenn der Nutzer **keine** Aufgabe hat (Server-Kriterium; der
  localStorage-Zustand `pp-welcome-steps` ist serverseitig unsichtbar).
- Tagesfenster Tag 09–18 Uhr Ortszeit (Anfang inklusive, Ende exklusiv) — sonst feuerte der
  stündliche Scheduler den Tag-2-Push nach Ortszeit-Mitternacht.
- Dedup-Key fix `<userId>` → genau einmal je Konto. Schalter `taskPushEnabled`.

### Willkommen zurück (`welcome-back`, AK6)

- Nur wenn in den letzten 7 Tagen weder eine Aufgabe angelegt (`Task.createdAt`) noch erledigt
  wurde (`ScoreEntry.zeitpunkt`) — ältere Historie ist unschädlich.
- Tagesfenster Tag 09–18 Uhr Ortszeit (Anfang inklusive, Ende exklusiv).
- Häufigkeit: höchstens 1 je 30 Tage, geprüft über `NotificationLog`-Einträge des Kinds mit
  `sentAt` innerhalb der letzten 30 Tage; Dedup-Key `<userId>:welcome-back:<lokalesDatum>`.
  Schalter `carePushEnabled`.

### Texte (AK7)

Je Anlass Volltexte in de und en (Titel + Text, beide nicht leer, Sprachwahl über
`spracheVon(users.sprache)`, Deutsch-Fallback). Prüffrage aus `docs/fuersorge-tonalitaet.md`
bleibt Review-Check.

### Budget-/Ziel-Wiring (AK8)

- Alle sechs Kinds in `pushBudget.ts`: `VORRANG`-Liste (kein Fallback-Rang) und `TAGS` mit
  Gruppentag — `appreciation`/`welcome-back`/`journal-impulse` → `pp-fuersorge`,
  `weekly-recap`/`yearly-recap` → `pp-erfolge`, `welcome-steps` → `pp-aufgaben`.
- Alle sechs Ziele in `pushTargets.ts` (`PUSH_TARGETS`); die vier `karte-…`-Anker sind per
  Spiegel-Test an die Frontend-Ids gebunden (Dashboard, WeeklyBalanceCard, YearlyRecapCard,
  WelcomeSteps).
- Scheduler-Registrierung in `server/src/index.ts` (`vorrangVon(kind)`, Muster der bestehenden
  Trigger): bewusst ohne Test — String-Match ohne Zähne (ADR 0001); die Impl-Phase verdrahtet.

## Abgrenzungen

- Keine Änderung an `care-push`, `monthly-recap`, Budget-Grenze oder Ruhezeit.
- Rückwärts-Kompatibilität: keine (kein Bestandskunden-Ballast).
