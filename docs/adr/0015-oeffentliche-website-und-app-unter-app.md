# ADR 0015 — Öffentliche Website an der Wurzel, App unter /app/

- **Status:** Accepted (2026-09-23)
- **Datum:** 2026-09-23
- **Kontext:** [Gesamtkonzept Monetarisierung](../gesamtkonzept-monetarisierung.md) (T8: „Paketmatrix und Preise sind öffentlich einsehbar“), `frontend/PRODUCT.md` (Öffnung für eine breitere Nutzerschaft), [Server-Setup § 7](../server-setup.md)

## Kontext

Balamentum hatte keinen öffentlichen Auftritt. Unter `/` lag direkt die SPA; wer nicht angemeldet war, sah die Login-Seite, und anmelden konnten sich nur Adressen aus `GOOGLE_ALLOWED_EMAILS`. Gewünscht ist eine kompakte Marketingseite in Deutsch und Englisch, deren einziges Ziel der Start ist: „Mit Google starten“, anmelden, loslegen. Dazu gehören die wichtigsten Argumente und die Pakete.

Eine Route in der SPA hätte gereicht, um die Seite anzuzeigen. Sie wäre aber ohne JavaScript leer, bringt das KoliBri-Bundle mit und ist für Suchmaschinen schwach. Die SPA wird außerdem vom Service Worker mit `navigateFallback` ausgeliefert; jede Seite im selben Scope landet ohnehin in der App.

## Entscheidung

**1. Eigenes Paket `website/`, statisch vorgerendert.** Ein Build-Skript (`website/scripts/build.ts`) erzeugt pro Sprache fertiges HTML: `/` (de), `/en/`, dazu `/impressum/` und `/en/imprint/`, `robots.txt` und mit gesetztem `SITE_URL` eine `sitemap.xml`. Es gibt kein Framework und kein Client-JS. Das Markup nutzt die Klassennamen von KERN UX, das Stylesheet bildet die Marken-Tokens aus `frontend/src/app.css` nach. KoliBri-Komponenten sind Web Components und brauchen JavaScript, deshalb kommen sie hier nicht zum Einsatz.

**2. Keine Kopie von Preisen und Anbieterdaten.** Der Build importiert Katalog, Preise und KI-Kontingente aus `server/src/logics/plans.ts` und die Impressumsdaten aus `frontend/src/lib/operator.ts`. Beide Stellen bleiben die einzige Quelle. Nur die Marketing-Namen der Feature-IDs stehen in `website/src/i18n/*.json`; ein Unit-Test schlägt fehl, wenn eine Feature-ID oder ein Paket ohne Text ist.

**3. Die App zieht nach `/app/`.** Vite baut mit `base: '/app/'`, der Router bekommt `basename`, Manifest-`scope` und `start_url` zeigen auf `/app/`. API (`/api/v1`) und Login (`/auth`) bleiben an der Wurzel. Der Login leitet nach Erfolg und Fehler auf `/app/` zurück. Alte Pfade (`/settings…`, `/gruppen/…`, `/bahn` usw.) leitet Caddy per 308 nach `/app{uri}` um, damit Lesezeichen, Einladungslinks und die PayPal-Rückkehr weiter funktionieren.

**4. Die installierte PWA öffnet die App, nie die Website.** Neue Installationen starten über `start_url: /app/`. Die Manifest-`id` bleibt `/`, damit bestehende Installationen dieselbe App bleiben. Ältere Installationen starten weiter auf `/`, weil iOS das Manifest nicht aktualisiert und Android nur verzögert. Ein automatischer Sprung per `display-mode: standalone` war vorgesehen und wurde zurückgenommen: Er ließ die Website nur aufblitzen und konnte mit einem Server-Fallback, der unter `/app/…` die Website ausliefert, eine Redirect-Schleife bilden. Stattdessen setzt der Server bei jedem erfolgreichen `GET /auth/me` das lesbare Merk-Cookie `bm_signed_in=1` (Laufzeit wie die Session) und löscht es bei 401 und Logout. Ein Inline-Skript im `<head>` von `/` und `/en/` springt bei gesetztem Cookie vor dem ersten Rendern nach `/app/`; das gilt für ältere Installationen wie für Lesezeichen. Es läuft nur auf den Startseiten der Website, `/app/*` liefert immer die SPA aus, eine Schleife ist damit ausgeschlossen. Ein abgelaufenes Cookie führt einmal auf die Login-Seite der App, deren 401 es löscht. `/?web` zeigt die Website auch angemeldet.

**5. Kill-Switch für den alten Service Worker.** Unter `/sw.js` liefert die Website einen Service Worker aus, der sich beim nächsten Update-Check des alten App-Workers installiert, dessen Caches löscht, sich abmeldet und offene Fenster neu lädt. Die App registriert ihren Worker danach unter `/app/`.

**6. Offene Registrierung per Schalter.** `OPEN_SIGNUP=true` lässt jedes Google-Konto zu (`server/src/logics/allowedEmails.ts`). Die Allowlist bleibt als Alternative erhalten; der Produktions-Startcheck akzeptiert beides.

## Konsequenzen

- Suchmaschinen und Menschen ohne JavaScript bekommen eine vollständige Seite. Die Seite ist wenige Kilobyte groß und hat keine Laufzeitabhängigkeit zum Backend.
- Push-Abos hängen an der Service-Worker-Registrierung. Mit dem Umzug nach `/app/` verlieren bestehende Geräte ihr Abo und müssen Push in den Einstellungen einmal neu aktivieren.
- Die Server-Payload für Push-Nachrichten adressiert weiter App-Routen ab `/`; `push-sw.js` löst sie gegen den eigenen Scope auf. Der Server muss vom Präfix nichts wissen.
- Der Deploy spielt zwei Builds ins Web-Verzeichnis: `website/dist` an die Wurzel (ohne `app/` zu löschen) und `frontend/dist` nach `app/`. Der Caddy-Block auf dem Server muss einmal von Hand ersetzt werden (`docs/server-setup.md` § 7).
- Für die offene Registrierung muss der Google-OAuth-Zustimmungsbildschirm auf „In Produktion“ stehen. Die Datenschutzerklärung liegt unter `/datenschutz/` und ist im Footer aller Sprachversionen verlinkt (#1672).
- Neue Sprachen brauchen nur eine weitere JSON-Datei und einen Eintrag in `LOCALES`. Die Website führt dieselben zehn Sprachen wie die App; die Sprachwahl im Kopf ist ein `details`-Menü ohne JavaScript.
