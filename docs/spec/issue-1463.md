# T8: Launch — Übergangs-Setzung, Prüfabfrage, CLI-Skript

**Stand:** 2026-09-24

## Ziel

Vor dem Scharfschalten von `MONETIZATION_ENFORCED` bekommen alle Bestandskonten, die noch nie ein
Paket gebucht haben (`plan = 'free'`, angelegt vor dem Stichtag), automatisch das Übergangs-Tier
`ultimate` — sie behalten damit bis zum ersten produktiven PayPal-Abo alle Funktionen. Die Setzung
ist ein einmaliger, vom Operator angestoßener CLI-Lauf, KEIN Teil des normalen Serverstarts
(`migrate.ts`), damit sie nicht bei jedem Deploy erneut über frisch angelegte `free`-Konten läuft.

## Precondition

- `User.plan` (`server/src/models/user.ts:44`) und `User.createdAt` (`:46`, `timestamps: true`
  `:120`) existieren bereits.
- `server/src/logics/plans.ts` kennt die vier Pakete `free | pro | max | ultimate`
  (`PLAN_VALUES`, `plans.ts:10-11`) unverändert.

## Verhalten

### AK1 — Setzung trifft nur Alt-Free-Konten vor dem Stichtag

`grandfatherPlans(seq, cutoff)` setzt bei jedem Konto mit `createdAt < cutoff` UND `plan === 'free'`
den Plan auf `'ultimate'`. Der Rückgabewert ist die Anzahl der geänderten Konten. Konten mit
`createdAt >= cutoff` oder einem von `'free'` abweichenden Plan (z. B. `'pro'`, `'max'`,
`'ultimate'`) bleiben unverändert — unabhängig vom Erstellungsdatum.

### AK2 — Idempotenz und keine Auto-Ausführung beim Serverstart

Ein zweiter Aufruf von `grandfatherPlans(seq, cutoff)` mit demselben Stichtag auf demselben Stand
ändert 0 Konten (alle betroffenen Konten stehen nach dem ersten Lauf bereits auf `'ultimate'`).
`server/src/logics/migrate.ts` importiert oder ruft `grandfatherPlans` NICHT auf — die Funktion
lebt außerhalb der beim Serverstart automatisch durchlaufenden Migrationskette
(`server/src/index.ts`), ein Konto, das nach dem Lauf manuell wieder auf `'free'` gesetzt wird,
bleibt bei jedem weiteren Serverstart unangetastet.

### AK3 — Prüfabfrage liefert die Paketverteilung

`planDistribution(seq)` liefert die Anzahl Konten je Paket als
`{ free: number, pro: number, max: number, ultimate: number }` — inklusive `0` für Pakete ohne
Konten. Leere `users`-Tabelle → alle vier Werte `0`.

### AK4 — CLI-Validierung des Stichtags

Das CLI-Skript liest den Stichtag aus einer Umgebungsvariable als ISO-Datum. Fehlt die Variable
oder ist der Wert kein gültiges ISO-Datum, beendet sich der Prozess mit Exit-Code `!= 0`, OHNE die
Datenbank zu verändern. Bei gültigem Stichtag läuft die Setzung, das Skript gibt die Anzahl
geänderter Konten UND danach die Paketverteilung (AK3) aus und beendet sich mit Exit-Code `0`.

## Abgrenzung

- Kein Rückfall auf `'free'` bei erstem produktiven PayPal-Abo — eigenes Folge-Ticket (Entscheidung
  2 im Harness-Kommentar).
- Keine Änderung an `AI_ASSIST_MONTHLY_QUOTA` oder `PLAN_PRICES` (`plans.ts`) — Kontingente und
  Preise bleiben, wie sie sind (AK6, Bestandstests `plans.test.ts` bleiben grün).
- Dokumentation (`.env.example`, `docs/deployment.md`, `docs/arc42.md`, `docs/user-guide.md`,
  `docs/gesamtkonzept-monetarisierung.md`, AK5) ist nicht Teil dieser Spec-PR (Spec-PR-Scope:
  `docs/spec/*.md` + rote Tests) — Review-Prüfung in der Umsetzungsphase.
