# Caddy-Konfiguration für Priority Pilot

Das Frontend wird als statischer Build von Caddy ausgeliefert. Das Backend (Express, Port 3000)
ist **nicht** direkt erreichbar — Caddy reicht alle Anfragen unter `/api/v1/*` dorthin weiter
und streift das Präfix ab, bevor der Request ankommt.

## Caddyfile

```caddyfile
:80 {
    root * /srv/priority-pilot/frontend/dist
    file_server

    # API: Präfix abstreifen und zum Express-Backend weiterleiten.
    handle /api/v1/* {
        uri strip_prefix /api/v1
        reverse_proxy localhost:3000
    }

    # SPA-Fallback: alle anderen Pfade liefern index.html.
    try_files {path} /index.html
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
