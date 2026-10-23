# Spec #2879 — Gruppen-Sweep: Rückstands-Schutz für Challenge-Ende-Pushes

**Stand:** 2026-10-22

## Journey: Stündlicher Gruppen-Sweep (Challenge-Ende)

### Ziel

Der stündliche Sweep `runGroupPush` lädt beendete Challenges nur noch aus einem 7-Tage-Fenster
(Rückstands-Schutz nach dem Muster `aboPush.ts`, `FENSTER_TAGE = 7`): Challenges, die länger als
7 Tage zurück endeten, erzeugen weder Sendeversuch noch NotificationLog-Eintrag. Die Abfrage
bleibt mit wachsender Challenge-Historie konstant klein.

### Vorbedingung

- Gruppe mit mindestens einem Mitglied (Push-Subscription vorhanden, `groupPushEnabled` an)
- Beendete `GroupChallenge` mit `endsAt` in der Vergangenheit

### Schritte

1. **Challenge außerhalb des Fensters** — `endsAt` liegt mehr als 7 Tage vor dem Sweep-Tick
   - Der Sweep lädt die Challenge nicht: `sends: 0`, kein Push, kein `challenge-end:`-Eintrag im NotificationLog

2. **Challenge an der Fenstergrenze** — `endsAt` liegt exakt 7 Tage vor dem Sweep-Tick
   - Das Fenster ist inklusiv (`Op.gte`): die Challenge sendet noch, je Mitglied genau ein
     `challenge-end:<id>:<userId>`-Log

### Erwartetes Ergebnis

- Nur Challenges mit `endsAt` im Intervall `[jetzt − 7 Tage, jetzt]` werden je Mitglied einmal
  benachrichtigt (Bestandsverhalten aus #2854 AK4 unverändert)
- Frisch beendete Challenge (z. B. 1 Tag zurück) sendet unverändert je Mitglied genau einen Push
- Der Dedupe-Schutz (`challenge-end:{id}:{userId}`) bleibt unberührt; Wiederholungs-Ticks senden nichts
