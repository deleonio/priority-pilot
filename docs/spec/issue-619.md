# Startup-Fehlerbehandlung – Priority Pilot

**Stand:** 2026-08-28

## Journey: Kritischen Startup-Fehler sauber beenden

### Ziel

Bei kritischen Startup-Fehlern beendet sich der Server-Prozess sofort mit Exit-Code 1 statt im unbenutzbaren Zustand weiterzulaufen. Der Prozessbetreiber (z. B. PM2) erkennt den Exit-Code und startet den Prozess neu.

### Vorbedingung

- Server-Start wird initiiert
- Mindestens einer der folgenden Fehler tritt beim Start auf:
  - Konfigurationsfehler (ungültige `.env`, fehlende Pflicht-Umgebungsvariablen)
  - Port bereits belegt
  - Database-Connection-Error
  - Unhandled Rejection / Uncaught Exception während des Starts

### Schritte

1. **Fehler im Startup-Block**
   - Ein Fehler innerhalb des Startup-Ablaufs (`try/catch` um den gesamten Startup-Code) wird geloggt (inklusive Stack-Trace)
   - Der Prozess endet mit `process.exit(1)`; `app.listen()` wird nicht aufgerufen

2. **Unhandled Rejection während des Starts**
   - Ein Promise rejected, ohne dass ein `.catch()`-Handler existiert
   - Der globale `unhandledRejection`-Handler loggt Grund und Stack und ruft `process.exit(1)` auf

3. **Uncaught Exception während des Starts**
   - Eine nicht gefangene synchrone Exception wird geworfen
   - Der globale `uncaughtException`-Handler loggt Grund und Stack und ruft `process.exit(1)` auf

4. **Port bereits belegt**
   - `app.listen()` meldet einen Fehler über einen registrierten Error-Handler am zurückgegebenen Server
   - Insbesondere bei `EADDRINUSE` wird der Fehler geloggt und `process.exit(1)` aufgerufen

### Erwartetes Ergebnis

- Bei jedem kritischen Startup-Fehler beendet sich der Prozess sofort mit Exit-Code 1
- Alle Fehler werden vor dem Beenden geloggt
- Kein weiterlaufender Prozess ohne lauschenden HTTP-Server

---

## Randfälle & Fehler

| Situation                          | Erwartetes Verhalten       |
| ---------------------------------- | -------------------------- |
| Ungültige/leere `DATABASE_STORAGE` | Log + Exit-Code 1          |
| Port belegt                        | Log + Exit-Code 1          |
| Rejected Promise beim Start        | Log + Exit-Code 1          |
| Nicht gefangene Exception          | Log + Exit-Code 1          |
| Normaler Start ohne Fehler         | Server läuft, kein Beenden |
