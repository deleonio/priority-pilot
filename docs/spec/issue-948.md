# User Journey – Session-401 korrekt von KI-401 unterscheiden

**Stand:** 2026-08-27  
**Issue:** #948 (Folge von #620)

---

## Journey: Task mit abgelaufener Session löschen

### Ziel

Löscht ein Nutzer:in einen Task, während die Session abgelaufen ist, zeigt der
Lösch-Dialog eine **Session-Meldung** („Nicht eingeloggt. Bitte melde dich erneut an.") statt
der irreführenden KI-Meldung „Die KI-Konfiguration ist ungültig. Bitte prüfe die Einstellungen.".

### Vorbedingung

- Auth ist aktiv (`requireAuth` greift).
- Die Session des Nutzers ist abgelaufen.
- Der Lösch-Dialog für einen Task ist geöffnet.

### Schritte

1. **Löschen auslösen**
   - Klick auf **„Endgültig löschen"** im Task-Lösch-Dialog (`DELETE /tasks/{id}`).
2. **Server antwortet mit Session-401**
   - Die Session-Auth lehnt den Request ab: HTTP 401 mit Body `{ "message": "Nicht eingeloggt." }`.
3. **Fehlerbeobachtung**
   - Die Fehlertextauflösung (`toApiError`) übersetzt den 401 in eine Session-Meldung.
   - Der Dialog zeigt die Meldung im bestehenden Fehler-Alert (KolAlert „Löschen fehlgeschlagen").

### Erwartetes Ergebnis

- **Primär:** Alert zeigt „Nicht eingeloggt. Bitte melde dich erneut an." — keine Erwähnung von
  KI/Konfiguration.
- **Struktur:** Dialog unverändert (gleiche Buttons, gleiches Alert-Element; nur der Fehlertext ändert sich).
- `DELETE /tasks/:id` berührt serverseitig kein LLM; das Mapping ist frontend-lokal.

---

## Mapping-Spezifikation für `toApiError` (führender Vertrag)

Grundlage ist der **Serververtrag**: Ein 401 kann im Server-API-Vertrag ausschließlich aus der
Session-Auth stammen — `requireAuth` („Nicht eingeloggt.") bzw. den Auth-Routen
(„Ungültige Zugangsdaten."). LLM-Dienst-Fehler werden serverseitig auf 502/503 gemappt und
erreichen den Client **nie** als 401. Um das #620-Verhalten (KI-Konfigurations-Meldung bei
ungültigem API-Key) konservativ zu erhalten, gilt folgende Unterscheidungslogik:

| Situation (ResponseError)                                   | Meldung                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------- |
| 401, lesbarer Body mit bekannter Session-Message (s. u.)    | „Nicht eingeloggt. Bitte melde dich erneut an."                     |
| 401, Body nicht lesbar (kein JSON / leer, catch-Zweig)      | „Nicht eingeloggt. Bitte melde dich erneut an."                     |
| 401, lesbarer Body mit **anderer** Message (LLM-/Proxy-401) | „Die KI-Konfiguration ist ungültig. Bitte prüfe die Einstellungen." |
| 502 / 503 / 504                                             | „Der KI-Dienst ist gerade nicht erreichbar. …" (unverändert, #620)  |
| alle übrigen Statuscodes                                    | Server-Message-Durchreiche (unverändert)                            |

**Bekannte Session-401-Messages** (aus dem Serververtrag): „Nicht eingeloggt." und
„Ungültige Zugangsdaten." — nur diese beiden stammen ausnahmslos von der Session-Auth.

**Nicht-Session-401:** Jede andere lesbare Message unter 401 (z. B. ein Provider-Text wie
„Invalid API key") fällt weiterhin unter die KI-Konfigurations-Meldung; das hält #620 intakt,
falls ein LLM-Endpoint heute oder künftig doch mit 401 antwortet.


## Randfälle & Fehler

| Situation                                          | Erwartetes Verhalten                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| 401 mit `{ "message": "Nicht eingeloggt." }`       | Session-Meldung, kein KI-Text (AK1)                                        |
| 401 ohne lesbaren JSON-Body                        | Session-Fallback-Meldung, kein KI-Text (AK1)                               |
| 401 mit `{ "message": "Ungültige Zugangsdaten." }` | Session-Meldung (gleiche Kategorie Session-Auth)                           |
| 401 mit fremder Message (z. B. „Invalid API key")  | KI-Konfigurations-Meldung                |
| 503 (Mistral-Ausfall)                              | „KI-Dienst … nicht erreichbar" unverändert (AK3)                           |
| 409 / 400 (Zyklus / Validierung)                   | Server-Message wird durchgereicht (AK3)                                    |
| DeleteTaskDialog bei Session-401                   | Session-Meldung im bestehenden KolAlert, Dialog-Struktur unverändert (AK4) |
