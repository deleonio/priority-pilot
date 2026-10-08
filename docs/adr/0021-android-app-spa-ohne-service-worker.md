# ADR 0021 — Android-App bringt die Web-App als SPA ohne Service Worker mit

- **Status:** Accepted (2026-10-07)
- **Datum:** 2026-10-07
- **Kontext:** [Epic #2375](https://github.com/deleonio/priority-pilot/issues/2375), Issue #2376, ersetzt Entscheidung 1 von [ADR 0016](0016-nativer-wrapper-capacitor-remote-modus.md), [ADR 0015](0015-oeffentliche-website-und-app-unter-app.md) (App unter `/app/`)

## Kontext

ADR 0016 legt die Android-App auf den Remote-Modus fest: Der WebView lädt `/app/` vom Server. Ein dort einmal registrierter Service Worker liefert alte Web-Stände aus. AAB 0.18.7 zeigte die Web-App 0.18.4, obwohl auf dem Server 0.18.10 lief. App-Version und angezeigte Web-Version laufen auseinander.

## Entscheidung

**1. Die Android-App enthält die Web-App als SPA ohne Service Worker.** Das Frontend wird in die App gebündelt und lokal ausgeliefert.

**2. Die Website unter `/app/` bleibt eine PWA** mit Service Worker.

**3. Die Sitzung läuft in der App über ein App-Token** statt über das Session-Cookie.

**4. Der Server gibt CORS nur für den Ursprung der App frei.**

## Verworfene Alternativen

- **Remote-Modus beibehalten (ADR 0016, Entscheidung 1):** Der registrierte Service Worker liefert alte Web-Stände aus, App-Version und Web-Version driften auseinander.
- **CapacitorHttp mit nativen Cookies:** Das Cookie-Modell (`SameSite=lax`, CSRF-Token) bleibt an die Web-Herkunft gebunden und wäre ein Sonderweg im Transport; das App-Token ist einfacher und eindeutig.

## Konsequenzen

- Frontend-Änderungen erreichen die Store-App nur noch über ein Release.
- Der Server muss ältere App-Stände eine Weile bedienen (abwärtskompatible API).
- Die Umsetzung (Bündelung, App-Token, CORS) folgt in den Geschwister-Tickets von #2375; diese ADR ändert keinen Code.
