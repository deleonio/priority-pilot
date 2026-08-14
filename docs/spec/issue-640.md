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
- Body: `{ hasMistralApiKey: false, hasOpenrouterApiKey: false, openrouterModel: 'openrouter/free' }`
  (Booleans signalisieren, ob ein Key **persistiert** ist — nie den Wert selbst; `openrouterModel`
  fällt auf den Kaskaden-Default `DEFAULT_OPENROUTER_MODEL` zurück, siehe `server/src/llm/llm.ts`).

## Journey 2: Konfiguration speichern; Status lesen (ohne Key-Werte)

### Ziel

Gespeicherte Werte werden persistiert und bei einem späteren `GET` als **Status** bestätigt — die
Key-Werte selbst werden bewusst nie zurückgeliefert (Write-Only, siehe „Hinweise zur Nutzung").

### Vorbedingung

- Nutzer ist eingeloggt.

### Schritte

1. `PUT /llm-config` mit `{ mistralApiKey: 'm-key-123', openrouterApiKey: 'or-key-456', openrouterModel: 'custom/model' }`.
2. `GET /llm-config` erneut aufrufen.

### Erwartetes Ergebnis

- `PUT` liefert 200 mit dem Status `{ hasMistralApiKey: true, hasOpenrouterApiKey: true, openrouterModel: 'custom/model' }`
  — **ohne** die Key-Werte (`m-key-123`/`or-key-456` dürfen in keiner Antwort auftauchen).
- Der nachfolgende `GET` liefert denselben Status zurück (nicht die Defaults aus Journey 1) — die
  Werte müssen also tatsächlich in SQLite persistiert werden, nicht nur im Prozess-Speicher.

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

Der neue Tab „LLM" zeigt den Status der Konfiguration an; die Key-Eingabefelder sind Passwort-Felder
(maskiert beim Tippen) und starten bewusst **leer** — gespeicherte Keys werden nie ins Feld geladen.

### Vorbedingung

- Nutzer ist auf `/settings/...` eingeloggt.
- Eine `llm-config` ist bereits persistiert.

### Schritte

1. Settings-Seite öffnen, Tab „LLM" aktivieren.

### Erwartetes Ergebnis

- Tab „LLM" ist in der Tab-Leiste sichtbar (neben „Allgemein"/„Säulen").
- Die Eingabefelder für `mistralApiKey`/`openrouterApiKey` sind maskiert (`input[type="password"]`,
  z. B. via `KolInputPassword`) und **leer** (Write-Only).
- Pro Key signalisiert die UI den Status „gespeichert"/„nicht gesetzt" — nicht den Wert.

## Journey 7: SettingsPage – Speichern mit Feedback und Reload-Persistenz

### Ziel

Speichern zeigt Erfolgs-/Fehler-Feedback; nach einem Reload bleibt der Status „gespeichert"
sichtbar, die Key-Felder jedoch **leer** (die Werte werden nicht zurückgelesen).

### Schritte

1. Im LLM-Tab neue Keys eingeben/ändern und „Speichern" klicken.
2. Seite neu laden.

### Erwartetes Ergebnis

- Nach dem Speichern erscheint eine sichtbare Erfolgsmeldung.
- Nach dem Reload sind die Key-Eingabefelder leer, aber der Status zeigt „gespeichert" (Persistenz
  über die Backend-API aus Journey 2, nicht nur lokaler State).

## Randfälle & Fehler

| Situation                               | Erwartetes Verhalten                            |
| --------------------------------------- | ----------------------------------------------- |
| `GET`/`PUT` ohne Session                | 401                                             |
| `PUT` mit nur-Whitespace-Key            | 400, keine Persistenz                           |
| `PUT` mit falschem Feldtyp (z. B. Zahl) | 400, keine Persistenz                           |
| Keine DB-Konfiguration vorhanden        | Kaskade nutzt Env-Werte (Abwärtskompatibilität) |
| DB-Konfiguration vorhanden              | Kaskade nutzt DB-Werte, ignoriert Env           |
| `PUT` mit leerem String (`''`)          | löscht den DB-Wert → Kaskade nutzt wieder Env   |
| Feld im `PUT`-Body abwesend             | bleibt unverändert, keine Persistenz-Änderung   |

## Hinweise zur Nutzung

- **Sicherheit — API-Keys sind Write-Only:** `GET /llm-config` liefert bewusst keine Key-Werte,
  sondern nur, ob jeweils ein Key persistiert ist (`hasMistralApiKey`/`hasOpenrouterApiKey`), plus
  das nicht-geheime `openrouterModel`. Die gespeicherten Secrets verlassen so nie den Server
  (weder über die Settings-UI noch über Netzwerk/Memory/XSS). Die Key-Eingabefelder starten daher
  immer leer; ein leeres Feld bedeutet „unverändert", ein getippter Wert überschreibt. Auch die
  bloße Anwesenheit der Umgebungsvariablen wird nicht signalisiert (nur der DB-Stand).
- **Rückweg zum Env-Fallback:** Weil ein leeres Feld „unverändert" bedeutet, kann es nichts löschen.
  Dafür bietet die UI je Provider eine explizite Aktion — „Key löschen" (sichtbar nur bei
  `hasXApiKey === true`) bzw. „Modell zurücksetzen" (sichtbar nur bei einem vom Default abweichenden
  Modell). Sie senden gezielt `''` und entfernen den DB-Wert, womit die Kaskade wieder auf
  `MISTRAL_API_KEY`/`OPENROUTER_API_KEY`/`OPENROUTER_MODEL` zurückfällt.
- **Modell nur bei Änderung senden:** `GET` liefert ohne DB-Zeile den reinen Anzeige-Default
  `openrouter/free`. Das Frontend schickt `openrouterModel` nur, wenn der Wert vom geladenen Status
  abweicht — sonst würde der Anzeige-Default beim ersten Speichern als echter DB-Wert persistiert und
  ein gesetztes `OPENROUTER_MODEL` still aushebeln.
- **Ladefehler:** Schlägt `GET /llm-config` fehl, zeigt der Tab ausschließlich eine Fehlermeldung —
  kein Formular. Ein angenommener Status („nicht gesetzt") würde dazu verleiten, einen vorhandenen,
  write-only gespeicherten Key zu überschreiben.
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
