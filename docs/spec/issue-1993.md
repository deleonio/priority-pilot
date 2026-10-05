# Spec #1993 — Vorlagen als importierbare Aufgabenpakete (Server)

Scope: nur Server/API. Ein Button in App oder Website ist ein Folgeticket.

## Datenquelle

`TEMPLATES` (`slug`, `title`, `steps[{id,title,after}]`) liegt einmal in `server/src/logics/templates.ts`
(Muster `plans.ts`); `website/src/templates.ts` re-exportiert sie. Die `/vorlagen/`-Seiten (#1976) bleiben unverändert.

## `GET /templates/:slug/preview`

- Voraussetzung: angemeldet (sonst 401); Slug bekannt (sonst 404).
- Ergebnis 200: `{ slug, title, taskCount, dependencyCount, steps:[{id,title,after}] }`.
  `taskCount` = Anzahl Schritte, `dependencyCount` = Summe aller `after`-Einträge. `hausbau`: 9 Aufgaben.
- Schreibt nichts.

## `POST /templates/:slug/apply`

- Voraussetzung: angemeldet (401), Slug bekannt (404).
- In **einer** Transaktion entstehen für den Nutzer: je Schritt eine Aufgabe (Titel = Schritt-Titel), je `after`-Kante
  eine Abhängigkeit (`dependentTaskId` = Schritt, `dependingTaskId` = Vorgänger) und die Kategorie (Name = Vorlagentitel).
- Eine vorhandene Kategorie des Nutzers mit gleichem Namen wird wiederverwendet.
- Antwort 2xx mit den neuen Task-IDs.
- Schlägt ein Schreibschritt fehl: Rollback, nichts bleibt zurück (keine Aufgaben, Abhängigkeiten, Kategorie), Antwort nicht 2xx.
- Erneutes `apply` ist erlaubt und erzeugt eine zweite vollständige Kopie (Kategorie nicht dupliziert).
- Datenisolation: Aufgaben gehören nur dem aufrufenden Nutzer.
