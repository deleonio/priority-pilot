# Issue 619 – Startup-Error-Handling

**Stand:** 2026-08-19
**Ziel:** Prozess bei Startup-Fehlern sauber beenden statt im defs Uhrbelzustand weiterzulaufen

---

## Ziel

Der Prozess soll bei kritischen Startup-Fehlern sofort mit `process.exit(1)` beenden werden, nicht im Zombie-Zustand weiterlaufen (ohne `app.listen()` aufzurufen). PM2 soll den Prozess dann sauber neu starten können.

---

## Vorbedingung

- Server-Start wird initiiert (`node server/src/index.ts`)
- Mindestens einer der folgenden Fehler tritt im Startup auf:
  - Konfigurationsfehler (ungültige `.env`, fehlende Required-Env-Vars)
  - Port bereits belegt
  - Database-Connection-Error
  - Unhandled Rejection/Uncaught Exception während des Startup

---

## Schritte

### 1. Startup-Catch-all-Error-Handler

**Situation:** In `server/src/index.ts` umschließt ein `try/catch`-Block den gesamten Startup-Code (Zeilen 173-175 aktuell).

**Erwartetes Verhalten:**
Bei Fehler im `catch`-Block:

- Fehler wird geloggt (mit Stack-Trace)
- `process.exit(1)` wird aufgerufen

**Verboten:** Prozess darf ohne `process.exit(1)` weiterlaufen.

---

### 2. Unhandled Rejection Handler

**Situation:** Während des Startup wird ein Promise rejected, ohne dass ein `.catch()`-Handler existiert.

**Erwartetes Verhalten:**
Ein globaler `process.on('unhandledRejection')`-Handler:

- Loggt den Rejection-Grund (Error + Stack)
- Ruft `process.exit(1)` auf

---

### 3. Uncaught Exception Handler

**Situation:** Während des Startup wird ein synchroner Exception geworfen, der nicht gefangen wird.

**Erwartetes Verhalten:**
Ein globaler `process.on('uncaughtException')`-Handler:

- Loggt den Exception-Grund (Error + Stack)
- Ruft `process.exit(1)` auf

---

### 4. App.listen Error-Callback

**Situation:** `app.listen()` in `server/src/express/index.ts:236` wird ohne Error-Callback aufgerufen. Der Port kann bereits belegt sein.

**Erwartetes Verhalten:**
`app.listen()` erhält einen Error-Callback als zweiten Parameter:

- Bei Fehler: Loggen + `process.exit(1)`
- Bei Erfolg: Server läuft normal

---

## Erwartetes Ergebnis

- Bei jedem kritischen Startup-Fehler beendet der Prozess sich sofort mit Exit-Code 1
- PM2 erkennt den Exit-Code und startet den Prozess neu
- Kein Zombie-Zustand (Prozess läuft weiter ohne `app.listen()`)
- Alle Fehler werden vor dem Exit geloggt

---

## Test-Szenarien (für rote Tests)

1. **Invalid .env:** Startup mit ungültiger `DATABASE_URL` → Exit 1
2. **Port belegt:** Startup mit belegtem Port → Exit 1
3. **Unhandled Rejection:** Simulierter rejected Promise im Startup → Exit 1
4. **Uncaught Exception:** Simulierter geworfener Error im Startup → Exit 1
5. **Normaler Startup:** Keine Fehler → Server läuft, kein Exit

---

## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, alle Handler implementiert
- **v1.0** (2026-08-13): Initialefassung für Issue #619
