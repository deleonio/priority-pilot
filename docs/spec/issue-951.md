# Single LLM-Provider-System – Issue 951

**Stand:** 2026-08-28  
**Ziel:** Genau ein aktiver LLM-Provider für alle KI-Anfragen, per Radio-Button gewählt — statt fester Kaskade aus Mistral + OpenRouter

Diese Spezifikation beschreibt das Single-Provider-System: Alle LLM-Anfragen laufen gegen genau einen aktiven Provider; konfiguriert wird er unter Einstellungen → Tab „KI-Provider“.

---

## Journey: LLM-Provider verwalten

### Ziel

Nutzer können LLM-Provider konfigurieren (fixe Built-ins Mistral/OpenRouter plus eigene Custom-Provider) und per Radio-Button genau einen aktiven Provider auswählen.

### Vorbedingung

- Nutzer ist angemeldet
- Einstellungen → Tab „KI-Provider“ ist geöffnet

### Schritte

1. **Provider-Liste anzeigen**
   - `GET /llm-providers` liefert alle Provider; API-Keys werden in Antworten nie zurückgegeben (write-only)
   - Radio-Group „KI-Provider" mit dynamischen Optionen: Mistral und OpenRouter sind fixe Built-ins (Key aus Server-ENV, kein Bearbeiten/Löschen) sowie angelegte Custom-Provider
   - Ist kein Provider aktiv, erscheint zusätzlich die Option „Kein Provider aktiv" samt Hinweis, dass kein ENV-Key gesetzt und kein Custom-Provider gewählt ist
   - Ein Alert zeigt die Bereitschaft des aktiven Providers in vier Stufen: „KI-Features bereit" (Erfolg, zuletzt erfolgreich getestet, mit Latenz), „KI-Features schlagen derzeit fehl" (konfiguriert, aber letzter Test schlug fehl), „KI-Features bereit (noch ungetestet)" (konfiguriert, aber noch nicht getestet) oder „KI-Features noch nicht nutzbar" (Warnung mit Key-/Modell-Hinweis)

2. **Neuen Provider anlegen**
   - Klick auf „Neuer Provider" öffnet den Dialog mit Feldern Name, Endpoint (URL), API-Key (Passwortfeld, startet leer), Modell
   - Alle vier Felder sind Pflicht (`POST /llm-providers`, HTTP 400 bei leerem Feld oder ungültiger Endpoint-URL); das Modell ist bewusst schon beim Anlegen Pflicht, weil der Modell-Endpoint nicht bei jedem Anbieter erreichbar ist

3. **Provider aktivieren**
   - Radio-Auswahl → `POST /llm-providers/{id}/activate`; alle anderen Provider werden deaktiviert
   - Toast „Provider gewechselt: {Name}"
   - Ohne explizite Wahl markiert der Server den Built-in-Fallback als aktiv (Mistral vor OpenRouter, nach ENV-Key-Präsenz)

4. **Provider bearbeiten**
   - Nur Custom-Provider haben Bearbeiten-/Löschen-Aktionen
   - Dialog vorausgefüllt (`PUT /llm-providers/{id}`); API-Key-Feld leer lassen = unverändert, nur nicht-leere Eingabe überschreibt

5. **Provider löschen**
   - Nur Custom-Provider: Löschen-Button öffnet einen Bestätigungsdialog (`DELETE /llm-providers/{id}`)

6. **Modell wählen**
   - Pro Provider per Single-Select; die Modellliste wird live vom Provider geladen (`GET /llm-providers/{id}/models`, Felder `id`/`name` je Modell, Quellangabe live/fallback; für Mistral existiert ein Fallback-Katalog)
   - Die Wahl persistiert über `PUT /llm-providers/{id}`

7. **Provider testen**
   - Je Provider ein Button „Testen" (unabhängig von dessen Aktivierung): `POST /llm-providers/{id}/test` schickt einen minimalen Test-Prompt mit den echten Aufrufparametern (Endpoint, Key, Modell) und meldet Erfolg (inkl. Latenz und Antwort-Auszug) oder die konkrete Fehlerursache
   - Ohne API-Key oder ohne gewähltes Modell antwortet der Test sofort mit einer entsprechenden Fehlermeldung, ohne den Provider anzufragen
   - Das Ergebnis erscheint als Alert direkt unter der Provider-Zeile; während ein Test läuft, sind alle „Testen"-Buttons deaktiviert
   - Ein frisches Testergebnis gilt kurzzeitig als aktuell (serverseitiger Cooldown); Bearbeiten oder Löschen eines Providers verwirft dessen Testergebnis sofort

8. **LLM-Aufruf mit aktivem Provider**
   - Alle LLM-Endpunkte (`/tasks/parse-text`, `/tasks/suggest-pillars`, `/pillars/advisor`, `/lektorat`) führen genau EINEN Call am aufgelösten aktiven Provider aus — keine Kaskade, kein Provider-Fallback zur Laufzeit
   - Fehlt der API-Key des aufgelösten Providers, antwortet der Server mit HTTP 503 (`MissingApiKeyError`)
   - Optionaler Query-Parameter `provider=<Name>` pinnt den Provider für den einzelnen Request (serverseitig validiert, ungültiger Wert → HTTP 400); das Frontend sendet den Parameter nicht

### Erwartetes Ergebnis

- **Genau ein aktiver Provider:** Radio-Auswahl stellt sicher, dass immer höchstens ein Provider aktiv ist (Server-Fallback, wenn keiner gewählt)
- **Keine Kaskade:** LLM-Anfragen gehen einzeln an den aktiven Provider
- **Write-only-Keys:** API-Keys erscheinen nie in API-Antworten
- **Diagnose je Provider:** Der „Testen"-Button liefert unabhängig von der Aktivierung ein Live-Ergebnis (Latenz/Antwort oder Fehlerursache) für jeden Provider

---

## Hinweise zur Nutzung

- **Implementierung:** implementierungsagnostisch — beschreibt das beobachtbare Verhalten
- **Test-Strategie:** E2E-/Unit-Tests prüfen Radio-Auswahl, Aktivierung, CRUD-Dialoge, Modell-Select und den Testen-Button
