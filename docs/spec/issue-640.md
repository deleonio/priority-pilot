# Issue 640: LLM-Provider-Konfiguration – Backend-Config-API + Frontend-Settings-UI

**Stand:** 2026-08-14
**Issue:** #640 (Teil von #637)
**Ziel:** Die Mistral/OpenRouter-Kaskade (`server/src/llm/llm.ts`) ist bisher nur über
Umgebungsvariablen (`MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) konfigurierbar.
Dieses Ticket ergänzt eine persistierte Konfiguration (SQLite) inkl. Backend-API und einem
„LLM"-Tab in der bestehenden `SettingsPage`.

## Vorbedingung

- `SettingsPage.tsx` existiert mit `KolTabs` (Tabs „Allgemein"/„Säulen").
- LLM-Kaskade in `server/src/llm/llm.ts` liest Konfiguration bisher ausschließlich aus `process.env`.
- `/llm-config` (bzw. proxied `/api/llm-config`) existiert noch nicht.

## Journey 1: Konfiguration ohne vorherige Speicherung lesen

### Ziel

Beim ersten Aufruf ohne persistierte Werte liefert die API sinnvolle Defaults.

### Vorbedingung

- Keine `llm-config`-Zeile in der DB vorhanden.
- Nutzer ist eingeloggt (gültige Session).

### Schritte

1. `GET /llm-config` aufrufen.

### Erwartetes Ergebnis

- Status 200.
- Body: `{ mistralApiKey: '', openrouterApiKey: '', openrouterModel: 'openrouter/free' }`
  (leere Strings für nicht gesetzte Keys; `openrouterModel` fällt auf den Kaskaden-Default
  `DEFAULT_OPENROUTER_MODEL` zurück, siehe `server/src/llm/llm.ts`).

## Journey 2: Konfiguration speichern und wieder lesen

### Ziel

Gespeicherte Werte werden bei einem späteren `GET` zurückgeliefert (Persistenz, nicht nur Echo).

### Vorbedingung

- Nutzer ist eingeloggt.

### Schritte

1. `PUT /llm-config` mit `{ mistralApiKey: 'm-key-123', openrouterApiKey: 'or-key-456', openrouterModel: 'custom/model' }`.
2. `GET /llm-config` erneut aufrufen.

### Erwartetes Ergebnis

- `PUT` liefert 200 mit den gespeicherten Werten.
- Der nachfolgende `GET` liefert exakt diese Werte zurück (nicht die Defaults aus Journey 1) —
  die Werte müssen also tatsächlich in SQLite persistiert werden, nicht nur im Prozess-Speicher.

## Journey 3: Validierung bei ungültigem Payload

### Ziel

Fehlerhafte Eingaben werden abgelehnt, bevor sie persistiert werden.

### Vorbedingung

- Nutzer ist eingeloggt.

### Schritte

1. `PUT /llm-config` mit einem Key, der nur aus Whitespace besteht (z. B. `mistralApiKey: '   '`).
2. `PUT /llm-config` mit einem strukturell ungültigen Payload (z. B. `openrouterModel` als Zahl statt String).

### Erwartetes Ergebnis

- Beide Aufrufe liefern 400, ohne die DB zu verändern.

## Journey 4: Zugriffsschutz

### Ziel

Ohne gültige Session ist die Konfiguration weder lesbar noch schreibbar.

### Schritte

1. `GET /llm-config` ohne Session-Cookie.
2. `PUT /llm-config` ohne Session-Cookie.

### Erwartetes Ergebnis

- Beide Aufrufe liefern 401.

## Journey 5: Kaskade bevorzugt persistierte Config vor Env

### Ziel

Ist eine Konfiguration in der DB gespeichert, nutzt die LLM-Kaskade diese statt der
Umgebungsvariablen; ohne DB-Werte bleibt Env der Fallback (Abwärtskompatibilität).

### Vorbedingung

- `MISTRAL_API_KEY`/`OPENROUTER_API_KEY`/`OPENROUTER_MODEL` sind über Env gesetzt.

### Schritte

1. Effektive Konfiguration ohne persistierte DB-Zeile ermitteln.
2. Eine `llm-config`-Zeile mit abweichenden Werten persistieren.
3. Effektive Konfiguration erneut ermitteln.

### Erwartetes Ergebnis

- Schritt 1: Env-Werte werden verwendet (Fallback).
- Schritt 3: Die persistierten DB-Werte werden verwendet, nicht die Env-Werte.

## Journey 6: SettingsPage – LLM-Tab

### Ziel

Der neue Tab „LLM" zeigt die persistierte Konfiguration an; API-Keys sind als Passwort-Feld
(maskiert) dargestellt.

### Vorbedingung

- Nutzer ist auf `/settings/...` eingeloggt.
- Eine `llm-config` ist bereits persistiert.

### Schritte

1. Settings-Seite öffnen, Tab „LLM" aktivieren.

### Erwartetes Ergebnis

- Tab „LLM" ist in der Tab-Leiste sichtbar (neben „Allgemein"/„Säulen").
- Die Eingabefelder für `mistralApiKey`/`openrouterApiKey` sind maskiert (`input[type="password"]`,
  z. B. via `KolInputPassword`).
- Die Felder zeigen die zuvor gespeicherten Werte.

## Journey 7: SettingsPage – Speichern mit Feedback und Reload-Persistenz

### Ziel

Speichern zeigt Erfolgs-/Fehler-Feedback; nach einem Reload sind die Werte weiterhin vorhanden.

### Schritte

1. Im LLM-Tab Werte eingeben/ändern und „Speichern" klicken.
2. Seite neu laden.

### Erwartetes Ergebnis

- Nach dem Speichern erscheint eine sichtbare Erfolgsmeldung.
- Nach dem Reload zeigt der LLM-Tab die zuvor gespeicherten Werte (Persistenz über die Backend-API
  aus Journey 2, nicht nur lokaler State).

## Randfälle & Fehler

| Situation                               | Erwartetes Verhalten                            |
| --------------------------------------- | ----------------------------------------------- |
| `GET`/`PUT` ohne Session                | 401                                             |
| `PUT` mit nur-Whitespace-Key            | 400, keine Persistenz                           |
| `PUT` mit falschem Feldtyp (z. B. Zahl) | 400, keine Persistenz                           |
| Keine DB-Konfiguration vorhanden        | Kaskade nutzt Env-Werte (Abwärtskompatibilität) |
| DB-Konfiguration vorhanden              | Kaskade nutzt DB-Werte, ignoriert Env           |

## Hinweise zur Nutzung

- Defaultwert für `openrouterModel` ist konsistent mit dem bestehenden Kaskaden-Default
  `DEFAULT_OPENROUTER_MODEL = 'openrouter/free'` aus `server/src/llm/llm.ts` — keine Abweichung
  einführen.
- Backend-Routen werden ohne `/api`-Prefix registriert (Konvention in `server/src/express/routes/*`,
  siehe `pillarsRouter`); der `/api`-Pfad aus dem Issue-Text ist der Frontend-/Proxy-Pfad
  (`/api/v1/*` → Vite-Proxy strippt das Präfix).
- Kein Multi-User-Scoping (keine `userId`-Isolation): Die Akzeptanzkriterien und Testfälle im Issue
  fordern ausschließlich Auth-Schutz (401), keine Datenisolation zwischen Nutzern — die Konfiguration
  ist eine Singleton-Zeile.
- Die Kaskaden-Vorrang-Logik aus Journey 5 wird als `loadEffectiveLlmConfig` in der bestehenden
  Datei `server/src/llm/llm.ts` erwartet (nicht als neue Datei) — `getMistralConfig`/
  `getOpenRouterConfig` dort lesen aktuell nur `process.env` und sollen diese Funktion nutzen.
