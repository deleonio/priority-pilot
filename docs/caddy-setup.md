# Caddy-Konfiguration für Priority Pilot

Das Frontend wird als statischer Build von Caddy ausgeliefert. Das Backend (Express, Port 3000)
ist **nicht** direkt erreichbar — Caddy reicht alle Anfragen unter `/api/v1/*` dorthin weiter
und streift das Präfix ab, bevor der Request ankommt.

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

| Eingehende URL           | Backend-Pfad                                                   |
| ------------------------ | -------------------------------------------------------------- |
| `GET :80/api/v1/tasks`   | `GET localhost:3000/tasks`                                     |
| `POST :80/api/v1/tasks`  | `POST localhost:3000/tasks`                                    |
| `GET :80/api/v1/pillars` | `GET localhost:3000/pillars`                                   |
| `GET :80/`               | statische `index.html` aus `/srv/priority-pilot/frontend/dist` |

## Abgleich mit dem Vite-Dev-Proxy

Lokal übernimmt `vite.config.ts` denselben Rewrite:

```ts
'/api/v1': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/v1/, ''),
}
```

Damit ist das Verhalten in Entwicklung und Produktion identisch — kein Sonderfall je Umgebung.

## Deployment-Hinweise

Detaillierter Serveraufbau (systemd-Unit, Verzeichnisstruktur, TLS): [server-setup.md](server-setup.md).
Release-Build und Tarball-Erstellung: [deployment.md](deployment.md).
