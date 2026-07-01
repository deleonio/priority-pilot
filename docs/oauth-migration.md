# OAuth-Migration: Callback-URL anpassen

## Problem

Nach einem Deploy bricht der Google OAuth-Flow ab, weil die Callback-URL in der Google Cloud Console noch auf den **alten Pfad** zeigt:

```
Alte (falsche) Callback-URL:
https://example.de/api/v1/auth/google/callback

Neue (korrekte) Callback-URL:
https://example.de/auth/google/callback
```

Die Callback-URL ist **case-sensitive** und muss **exakt** mit der URI übereinstimmen, die Google aufruft. Ein fehlendes `/v1` im Pfad führt zum Abbruch des OAuth-Flows.

## Ursache

Der Pfad des Auth-Endpoints wurde im Code von `/api/v1/auth/*` auf `/auth/*` geändert (siehe `server/src/express/routes/auth.ts`), aber die Konfiguration in der Google Cloud Console wurde nicht entsprechend angepasst.

## Lösung

### Schritt 1: Callback-URL in der Google Cloud Console anpassen

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/)
2. Navigiere zu **APIs & Services → Credentials**
3. Wähle den OAuth 2.0-Client aus, der für Priority Pilot verwendet wird
4. Unter **Authorized redirect URIs** die alte URL entfernen und die neue hinzufügen:
   - **Entfernen:** `https://example.de/api/v1/auth/google/callback`
   - **Hinzufügen:** `https://example.de/auth/google/callback`
5. Speichern (Save)

### Schritt 2: Environment-Variable anpassen

Auf dem Server die Environment-Variable `GOOGLE_CALLBACK_URL` in der Env-Datei aktualisieren:

```bash
# /etc/gh-deploy/priority-pilot.env (oder server/.env lokal)
GOOGLE_CALLBACK_URL=https://example.de/auth/google/callback
```

**Wichtig:** Die URL muss exakt mit der URI in der Google Cloud Console übereinstimmen (Schema, Host, Pfad).

### Schritt 3: Backend neu starten

Nach dem Anpassen der Environment-Variable den Dienst neu starten:

```bash
sudo systemctl restart app@priority-pilot
# oder bei PM2:
pm2 reload priority-pilot --update-env
```

## Verifikation

Nach der Migration prüfen, ob der OAuth-Flow wieder funktioniert:

1. **Google-Login im Frontend auslösen** → Nutzer wird zu Google weitergeleitet
2. **Nach erfolgreichem Login** → Google leitet zurück zur Callback-URL
3. **Frontend zeigt "Erfolgreich eingeloggt"** an

Falls der Flow trotzdem abbricht, die Logs prüfen:

```bash
journalctl -u app@priority-pilot -n 50 --no-pager
# oder bei PM2:
pm2 logs priority-pilot --lines 50
```

## Häufige Fehler

| Symptom | Ursache | Lösung |
|---------|---------|--------|
| `redirect_uri_mismatch` Fehler von Google | Callback-URL in Google Console falsch | URL exakt wie in `GOOGLE_CALLBACK_URL` eintragen |
| OAuth-Flow bricht nach Redirect ab | `GOOGLE_CALLBACK_URL` Environment-Variable falsch | Variable korrigieren und Dienst neu starten |
| CORS-Fehler im Browser | Origin nicht in Google Console erlaubt | `Authorized JavaScript origins` prüfen |

## Prüfskript (Optional)

Um die aktuelle Konfiguration zu prüfen, kann man folgendes Skript verwenden:

```bash
#!/usr/bin/env bash
# check-oauth-config.sh

echo "Prüfe OAuth-Konfiguration..."

# Environment-Variable lesen
if [ -f "/etc/gh-deploy/priority-pilot.env" ]; then
  CALLBACK_URL=$(grep "^GOOGLE_CALLBACK_URL=" /etc/gh-deploy/priority-pilot.env | cut -d'=' -f2)
  echo "GOOGLE_CALLBACK_URL: $CALLBACK_URL"
else
  echo "Env-Datei nicht gefunden: /etc/gh-deploy/priority-pilot.env"
fi

# Prüfen, ob die URL das korrekte Format hat
if [[ "$CALLBACK_URL" =~ ^https?://.*/auth/google/callback$ ]]; then
  echo "✓ Callback-URL hat das korrekte Format"
else
  echo "✗ Callback-URL hat das falsche Format (sollte auf /auth/google/callback enden)"
fi

echo ""
echo "Bitte sicherstellen, dass diese URL exakt in der Google Cloud Console als 'Authorized redirect URIs' konfiguriert ist."
```

## Referenzen

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Environment-Variablen-Referenz](../server/.env.example)
- [Deployment-Doku](deployment.md)
