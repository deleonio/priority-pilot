# Spec: Fürsorge-Vorschlag lässt sich nicht übernehmen (#2010)

> **Ablöst:** Die hier gepinnte Ein-Säulen-Form (`{pillarId, share: 100}`) ist mit #2077 durch
> die Vollverteilung ersetzt — siehe `docs/spec/issue-2077.md`.

## Ziel

„Vorschlag übernehmen" im Fürsorge-Hinweis wirkt zuverlässig für alle drei Vorschlagstypen —
Vorlage, eigene Aufgabe und KI-Vorschlag — gegen das echte Backend (`POST /tasks` bzw.
`PATCH /tasks/{id}`). Der Produktivfehler (Vorschlag lässt sich nicht übernehmen) ist auf main
statisch nicht reproduzierbar (Analyse im Harness-Kommentar); diese Spec pinnt daher den
Vertrag je Weg als ausführbaren Test, damit die Diagnose der Umsetzungsphase gegen einen
gesicherten Soll-Zustand läuft.

## Vertrag je Vorschlagstyp

### AK1 — Vorlage (`typ: 'vorlage'`)

- **Vorcondition:** Dashboard zeigt den Hinweis mit einem Vorlagen-Vorschlag.
- **Schritt:** Klick auf „Vorschlag übernehmen".
- **Erwartung:** Genau eine neue Aufgabe via `POST /tasks` mit Titel **und** Beschreibung des
  Vorschlags sowie Säulen-Beitrag `{pillarId der Vorschlags-Säule, share: 100}`; der Hinweis
  bleibt geschlossen, die Meldung „Konnte nicht angelegt werden." erscheint nicht.
- **Tests:** E2E `frontend/e2e/issue-1793-care-hint.spec.ts` (AK2, bestehend: Anzahl +1) und
  Unit `frontend/src/components/CareHint.test.tsx` (AK2 Vorlage, bestehend — um die
  Beschreibungs-Assertion ergänzt).

### AK2 — eigene Aufgabe (`typ: 'task'`)

- **Vorcondition:** Offene eigene Aufgabe mit Säulen-Beitrag (share > 0); sie steht in der
  Auswahl vor den Vorlagen (`waehleCareVorschlaege`, `server/src/logics/careSuggestions.ts`).
- **Schritt:** Klick auf „Vorschlag übernehmen".
- **Erwartung:** Genau diese Aufgabe wechselt auf `In process` (`PATCH /tasks/{id}`); keine neue
  Aufgabe (`createTask` wird nicht aufgerufen), Aufwandsgrenzen und Share-Summe unberührt. Der
  Hinweis bleibt geschlossen, keine Fehlermeldung.
- **Tests:** E2E neu in `frontend/e2e/issue-1793-care-hint.spec.ts` (Task per API angelegt,
  Hint-Text gate't den richtigen Vorschlag, danach `GET /tasks`: Anzahl unverändert, Status
  `In process`) + Unit (bestehend: `updateTask` mit `{status: 'In process'}`, kein
  `createTask`).

### AK3 — KI-Vorschlag (`typ: 'ki'`)

- **Vorcondition:** Dashboard zeigt einen KI-Vorschlag.
- **Schritt:** Klick auf „Vorschlag übernehmen".
- **Erwartung:** Eine Aufgabe mit Titel/Beschreibung des Vorschlags und vollem Beitrag
  (share 100, confidence 100) auf der Ziel-Säule entsteht; der Hinweis bleibt geschlossen,
  keine Fehlermeldung. Der Server akzeptiert genau dieses Payload (`POST /tasks`, Spiegel zu
  `frontend/src/components/CareHint.tsx` → `uebernehmen()`).
- **Tests:** Unit (bestehend, #1873 AK7: createTask-Payload aus activity/reason) + Server-API-
  Test neu (`server/src/express/tasks-care-hint.test.ts`: CareHint-Payload → 201 mit
  persistiertem Beitrag). Leer-Titel → 400 ist bereits durch
  `server/src/express/tasks-title-length.test.ts` („Task mit leerem Titel wird abgelehnt")
  abgedeckt — kein Duplikat.

### AK4 — Serverfehler kehrt den Hinweis zurück

- Bestehendes Verhalten bleibt erhalten: schlägt der zugrundeliegende Aufruf fehl, kehrt der
  Hinweis mit Fehlermeldung zurück (optimistisches Schließen mit `.catch`).
- **Tests:** Unit (bestehend: „schlägt Übernehmen fehl, kommt der Hinweis zurück").

## Diagnose-Auftrag an die Umsetzungsphase (aus dem Harness-Kommentar)

- Je Vorschlagstyp gegen das echte Backend reproduzieren (HTTP-Status/Server-Log), deployten
  Build gegen main vergleichen. Kandidaten: KI-Vorschlag mit leerem/überlangem
  `advice.activity` (400/500), älterer deployter Stand, Session-/CSRF-Eigenheit im
  Produktivbetrieb.
- Läuft ein neuer Vertragstest auf main bereits grün, ist das Produktiv-Delta (Deployment/
  Umgebung) dokumentiert — die Tests bleiben als Soll-Vertrag bestehen.
- Nebenbefund: `CareHint` sendet das optionale `careTemplateKey` nicht mit (#1798 AK2) —
  Analytik-Lücke, kein Fehlergrund dieses Tickets; kein Teil dieses Vertrags.
