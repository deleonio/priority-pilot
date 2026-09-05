# Spec #1222 — Aufgaben-Serie für ein Gruppenmitglied anlegen

## Ziel

Eine Serie (wiederkehrendes Template) lässt sich — wie eine Aufgabe seit #1213 — für ein
Gruppenmitglied anlegen: die Serie und alle daraus erzeugten Instanzen gehören dem Empfänger,
der Ersteller sieht sie im Serien-Tab mit Empfänger-Kennzeichen und kann sie nicht ändern oder
löschen.

## Voraussetzungen

- Ersteller und Empfänger teilen eine Gruppe (sonst 403, analog #1213).
- Bestandsserien ohne `createdById` bleiben lesbar und unverändert (nullable Spalte,
  Migration idempotent, kein Default).
- Pass-Through-Modus ohne Auth (`ownerScope(undefined)`) bleibt unverändert.

## Ablauf / erwartetes Verhalten

- **AK1/TF1** `POST /series` ohne `userId` → 201, Serie gehört dem Aufrufer (`userId` = eigene
  ID), DTO-Felder `createdById` = eigenes Konto, `forUserId`/`forUserName` = null.
- **AK2/TF2** `POST /series` mit `userId` eines Kontos ohne gemeinsame Gruppe → 403 und kein
  Datensatz (bei Ersteller UND Empfänger). `userId` ohne Ganzzahl → 400.
- **AK3/TF3** `POST /series` mit `userId` eines Gruppenmitglieds → 201; Serie trägt
  `userId` des Empfängers und `createdById` des Erstellers.
- **AK4/TF4** Generierte Instanzen tragen dieselbe `userId` wie die Serie — für
  `/series/generate-all` (Empfänger-Lauf) UND `/series/:id/generate`. Kernstelle:
  `logics/series.ts` (`generateDueInstances`) muss die Instanz-`userId` aus `series.userId`
  defaulten, nicht aus `options.userId ?? null`.
- **AK5/TF5** `GET /series` des Erstellers enthält die fremde Serie mit Empfänger-Kennzeichen
  (`forUserId`/`forUserName`, analog Task-DTO #1213); eigene Serien bleiben ohne Kennzeichen.
  Lese-Scope wird analog `taskReadScope` erweitert (`{userId}` ODER `{createdById}`);
  Schreib-Scope bleibt `ownerScope`.
- **AK6/TF6** `PATCH /series/:id` und `DELETE /series/:id` durch den Ersteller → 404, solange
  er nicht Empfänger ist (kein Kaskaden-Löschen fremder Aufgaben über `?cascade=true`).
- **AK7/TF7** Bestandsserie ohne `createdById` bleibt lesbar: direkt am Modell geseedete Serie
  ohne `createdById` erscheint weiterhin in `GET /series` des Eigentümers, Kennzeichen-Felder
  null. Migration nach `migrateTaskCreatedById`-Muster (idempotent, frische DB No-op).
- **AK8/TF8** Empfängerauswahl im Formular auch im Serie-Modus: nach Umschalten auf „Serie“
  sichtbar, im Bearbeiten-Modus ausgeblendet, Vorbelegung eigenes Konto; eine bereits
  getroffene Wahl darf der Moduswechsel NICHT zurücksetzen; `createSeries`-Payload enthält
  `userId` bei fremdem Empfänger.
- **AK9/TF9** Serien-Tab: fremde Serie mit Hinweis „Für: <Name>“ (Badge, nur wenn
  `forUserName` vorhanden); Bearbeiten/Löschen für fremde Serien nicht gerendert.
- **AK10/TF10** Bei 375 px UND 320 px sind Empfängerauswahl (Serie-Modus) und „Für:"-Hinweis
  ohne horizontales Scrollen lesbar/bedienbar — per Bounding-Box (`x+width <= viewport`,
  `scrollWidth` ist in der App-Shell strukturell geclippt).

## UX-Anforderungen (KI-UX-Block, in den Tests berücksichtigt)

- `KolSingleSelect` mit sichtbarem Label „Empfänger“ auch im Serie-Modus; Ladehinweis statt
  leerer Liste.
- „Für: Name“ als `KolBadge` (Text sichtbar UND im A11y-Baum), nur bei `forUserId != null`.
- Bearbeiten/Löschen für fremde Serien nicht rendern (keine fokussierbaren Geister-Buttons).
- Serien-Tab-Zeile bleibt umbrechfähig (kein `nowrap`), damit das dritte Badge nicht
  horizontales Scrollen erzwingt.
- Der 403-Fallback-Hinweis der Empfängerauswahl muss im Serie-Modus „Serie“ statt „Aufgabe“
  sagen (Wording — durch Review verifiziert, kein eigener Unit-Test).

## Testfälle → Dateien

| TF                | Datei                                                         |
| ----------------- | ------------------------------------------------------------- |
| TF1–TF3, TF5, TF7 | `server/src/express/series-created-by.test.ts` (neu)          |
| TF4, TF6          | `server/src/express/series-recipient-instances.test.ts` (neu) |
| TF8               | `frontend/src/components/TaskForm.test.tsx` (Erweiterung)     |
| TF9               | `frontend/src/components/SeriesTab.test.tsx` (Erweiterung)    |
| TF10              | `frontend/e2e/issue-1222-series-recipient.spec.ts` (neu)      |
