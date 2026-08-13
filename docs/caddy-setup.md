# Caddy-Konfiguration für Priority Pilot

Das Frontend wird als statischer Build von Caddy ausgeliefert. Das Backend (Express, Port 3000)
ist **nicht** direkt erreichbar — Caddy reicht Anfragen unter `/api/v1/*` (API-Daten) und
`/auth/*` (OAuth-Login-Flow) ans Backend weiter. Ersteres streift das `/api/v1`-Präfix ab,
Letzteres nicht.

## Caddyfile

```caddyfile
:80 {
    root * /var/www/gh-deploy/priority-pilot/frontend/

    # API: Präfix abstreifen und zum Express-Backend weiterleiten.
    # MUSS vor dem SPA-Fallback stehen und in einem eigenen handle-Block:
    # handle-Blöcke sind gegenseitig exklusiv (erster Treffer gewinnt).
    handle /api/v1/* {
        uri strip_prefix /api/v1
        reverse_proxy localhost:3000
    }

    # Auth-Routen: ohne Präfix-Strip ans Backend weiterleiten (OAuth-Login-Flow).
    handle /auth/* {
        reverse_proxy localhost:3000
    }

    # SPA-Fallback: alle übrigen Pfade liefern statische Dateien bzw. index.html.
    # try_files MUSS in einem eigenen handle-Block stehen. Auf Top-Level würde
    # es sonst – wegen Caddys fester Direktiven-Reihenfolge (try_files vor handle/
    # reverse_proxy) – ZUERST laufen und /api/v1/* intern auf /index.html
    # umschreiben, bevor der API-Block greift. Der reverse_proxy feuert dann nie.
    handle {
        try_files {path} /index.html
        file_server
    }
}
```

## Pfade

| Eingehende URL                 | Backend-Pfad                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| `GET :80/api/v1/tasks`         | `GET localhost:3000/tasks`                                   |
| `POST :80/api/v1/tasks`        | `POST localhost:3000/tasks`                                  |
| `GET :80/api/v1/pillars`       | `GET localhost:3000/pillars`                                 |
| `GET :80/auth/google`          | `GET localhost:3000/auth/google` (OAuth-Start)               |
| `GET :80/auth/google/callback` | `GET localhost:3000/auth/google/callback` (OAuth-Callback)   |
| `GET :80/`                     | statische `index.html` aus dem Web-Verzeichnis (`root` oben) |

## Abgleich mit dem Vite-Dev-Proxy

Lokal übernimmt `vite.config.ts` denselben Rewrite:

```ts
'/api/v1': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/v1/, ''),
}
```

Damit ist das API-Verhalten in Entwicklung und Produktion identisch. Die `/auth/*`-Routen werden im Dev-Modus ebenfalls per Vite-Proxy (ohne Präfix-Strip) an `http://localhost:3000` durchgereicht — analog zum `handle /auth/*`-Block oben. Der OAuth-Start (`/auth/google`) geht vom Frontend durch den Proxy ans Backend. Der OAuth-Callback von Google trifft **direkt** auf `http://localhost:3000/auth/google/callback` (Backend-Port), da Google die Callback-URL direkt aufruft und der Vite-Proxy nur ausgehende Requests bedient.

## Deployment-Hinweise

Detaillierter Serveraufbau (Verzeichnisse, PM2, TLS): [server-setup.md](server-setup.md).
Deploy-Ablauf (Merge → Build → `rsync` → PM2-Reload): [deployment.md](deployment.md).
