# Single LLM-Provider-System – Issue 951

**Stand:** 2026-08-21  
**Ziel:** Flexible Auswahl eines aktiven LLM-Providers per Radio-Button, statt fester Kaskade aus Mistral + OpenRouter

Diese Spezifikation beschreibt das neue Verhalten für das Single-Provider-System. Sie ersetzt die bisherige Kaskaden-Logik und ermöglicht die Konfiguration beliebiger LLM-Provider über die Einstellungen-UI.

---

## Journey: LLM-Provider verwalten

### Ziel

Nutzer können mehrere LLM-Provider (z.B. Mistral, OpenRouter, Ollama, OpenAI, Anthropic) konfigurieren und per Radio-Button einen aktiven Provider auswählen.

### Vorbedingung

- Nutzer ist angemeldet
- Einstellungen sind geöffnet
- Mindestens ein Provider ist konfiguriert

### Schritte

#### 1. Provider-Liste anzeigen

- **API-Aufruf**: `GET /llm-providers`
- **Frontend**: Komponente `LlmProviderList.tsx` zeigt alle konfigurierten Provider an
- **Darstellung**: Radio-Button für aktive Auswahl, Bearbeiten- und Löschen-Button pro Provider
- **Sicherheit**: API-Keys werden nie in der Antwort zurückgegeben (write-only)

#### 2. Neuen Provider anlegen

- **Aktion**: Klick auf "Neuer Provider"-Button
- **Dialog**: Formular mit Feldern:
  - Name (z.B. "Mistral")
  - Endpoint (URL, z.B. `https://api.mistral.ai/v1/chat/completions`)
  - API-Key (Eingabefeld, startet leer)
  - Modell (z.B. "mistral-medium-latest")
- **API-Aufruf**: `POST /llm-providers` mit Provider-Daten
- **Validierung**: Endpoint muss gültiges URL-Format haben

#### 3. Provider aktivieren

- **Aktion**: Radio-Button für gewünschten Provider auswählen
- **API-Aufruf**: `POST /llm-providers/{id}/activate`
- **System-Logik**: Alle anderen Provider werden automatisch deaktiviert (`isActive = false`)
- **Toast-Feedback**: Erfolgsmeldung bei Provider-Wechsel

#### 4. Provider bearbeiten

- **Aktion**: Klick auf Bearbeiten-Button neben Provider
- **Dialog**: Vorausgefülltes Formular (API-Key-Feld bleibt leer)
- **API-Aufruf**: `PUT /llm-providers/{id}` mit aktualisierten Daten
- **Sicherheit**: API-Key wird nur bei Änderung gesendet (optionales Feld)

#### 5. Provider löschen

- **Aktion**: Klick auf Löschen-Button neben Provider
- **Bestätigung**: Dialog mit Bestätigungsfrage
- **API-Aufruf**: `DELETE /llm-providers/{id}`
- **Validierung**: Aktiver Provider kann nicht gelöscht werden (oder muss vorher deaktiviert werden)

#### 6. LLM-Aufruf mit aktivem Provider

- **System-Logik**: Alle LLM-Endpunkte (`/suggest-pillars`, `/parse-tasks`, `/lektorat`, etc.) nutzen nur den aktiven Provider
- **Fehlerbehandlung**: Wenn kein aktiver Provider konfiguriert ist → `MissingApiKeyError` (HTTP 503)
- **Legacy**: Alte API-Endpunkte (`/llm-config`) bleiben für Kompatibilität erhalten

### Erwartetes Ergebnis

- **Flexible Provider-Auswahl**: Nutzer können beliebig viele Provider konfigurieren
- **Genau ein aktiver Provider**: Radio-Button-System stellt sicher, dass immer genau ein Provider aktiv ist
- **Keine Kaskade**: Keine feste Mistral → OpenRouter Kaskade mehr
- **Migration**: Bestehende Mistral- und OpenRouter-Keys werden in neue Provider-Einträge migriert
- **Default**: Mistral wird als erster Provider angelegt und aktiv gesetzt

---

## Akzeptanzkriterien (Referenz)

### Backend

- Neue Tabelle `llm_providers` mit Migration
- `GET /llm-providers` liefert alle Provider (ohne API-Keys!)
- `POST /llm-providers` legt neuen Provider an
- `PUT /llm-providers/{id}` aktualisiert Provider-Daten
- `DELETE /llm-providers/{id}` löscht Provider
- `POST /llm-providers/{id}/activate` setzt Provider als aktiv (deaktiviert alle anderen)
- LLM-Aufrufe nutzen nur den aktiven Provider
- Keine Kaskaden-Logik mehr
- Default: Mistral ist aktiv, wenn vorhanden
- Altes `llm_configs`-System bleibt für Migration erhalten

### Frontend

- Dynamische Radio-Group mit allen Providern aus `GET /llm-providers`
- Aktiver Provider ist vorselektiert
- "Neuer Provider"-Dialog mit Formular (Name, Endpoint, API-Key, Modell)
- Bearbeiten-Link pro Provider
- Löschen-Button pro Provider mit Bestätigung
- API-Keys werden write-only behandelt (nie im UI angezeigt)
- Toast-Feedback bei Provider-Wechsel
- Responsive Layout (Mobile: vertikale Stackung)

### Migration

- Bestehende LlmConfig-Daten (Mistral + OpenRouter Keys) werden in neue `llm_providers`-Einträge migriert
- Mistral wird als erster Provider angelegt und aktiv gesetzt
- OpenRouter wird als zweiter Provider angelegt (inaktiv)
- Alte API-Endpunkte (`/llm-config`) bleiben für Kompatibilität erhalten

---

## Test-Pflege (verbindlich für die Implementierungsphase)

Die neue Architektur (Single-Provider statt Kaskade) macht folgende bestehende Tests überflüssig bzw. erfordert deren Anpassung. Die Implementierungsphase setzt diese Liste um, ohne sie neu zu entscheiden:

1. **`server/src/llm/cascade.test.ts`** – testet die Kaskaden-Logik Mistral → OpenRouter, die entfernt wird. Anpassen oder entfernen.
2. **`frontend/src/lib/llm-provider.test.ts`** – testet Provider-State mit festen Strings (`'mistral' | 'openrouter'`). Auf dynamische Provider-Objekte umstellen.
3. **`frontend/e2e/llm-provider-toggle.spec.ts`** – testet UI-Toggle für feste Provider. Auf dynamische Radio-Group umstellen.
4. **`frontend/e2e/llm-settings-button-layout.spec.ts`** – testet Settings-Button-Layout. Prüfen, ob er mit der neuen UI weiterhin gültig ist.

Die alten API-Endpunkte (`/llm-config`) bleiben für Migration erhalten, daher bleiben `server/src/express/llm-config.test.ts` und `server/src/llm/llmConfig.test.ts` vorerst gültig.

---

## Technische Hinweise

### Provider-Templates

Vorgefertigte Templates für häufige Dienste:

- Mistral: `https://api.mistral.ai/v1/chat/completions`
- OpenRouter: `https://openrouter.ai/api/v1/chat/completions`
- Ollama (lokal): `http://localhost:11434/api/chat`
- OpenAI: `https://api.openai.com/v1/chat/completions`
- Anthropic: `https://api.anthropic.com/v1/messages`

### Sicherheit

- API-Keys werden **nie** in API-Antworten zurückgegeben
- API-Keys werden **nie** in Logs geschrieben
- API-Keys werden im Frontend **write-only** behandelt (Eingabefeld startet immer leer)
