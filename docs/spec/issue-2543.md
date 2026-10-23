# Issue 2543 — Geocode-Rate-Limit nicht per Header umgehbar

Spezifikation (rote Tests): `server/src/express/geocode-search.test.ts`.
Basis: Issue #2543 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-10-14T08:03:52Z).

## Ziel

Der geteilte `geocodeRateLimiter` (`/reverse-geocode`, `/geocode-search`) lässt sich nicht mehr
durch wechselnde `x-session-token`-Header umgehen; das Nominatim-Limit (1 req/s) gilt für den
Server insgesamt.

## Voraussetzungen

- Schlüssel des Limiters: `ipKeyGenerator(req.ip)` + `getUserId(req)`; der Header hat keinen Einfluss.
- Fallback-Vertrag aus #1280 bleibt: gedrosselt → 200 mit `[]` bzw. `{ address: '' }`, kein 429.
- Photon ist nicht Teil der globalen Drossel.

## Akzeptanzkriterien

### AK1/AK2 — Header-Wechsel erneuert das Kontingent nicht

- Ablauf: zwei Anfragen binnen 1 s von derselben IP (gleicher Nutzer) mit `x-session-token` A und B.
- Erwartet: zweite Antwort ist die Fallback-Antwort, der Upstream wird nicht aufgerufen (Suche und Reverse).

### AK3 — Globale Nominatim-Drossel

- Ablauf: zwei verschiedene Nutzer lösen binnen 1 s je einen Nominatim-Aufruf aus (Reverse oder Such-Fallback).
- Erwartet: genau ein Nominatim-Aufruf, die zweite Antwort ist die Fallback-Antwort. Photon-Anfragen bleiben unberührt.

### AK4 — Bestehende Tests

- Die Isolation der bestehenden Geocode-Tests läuft über getrennte Nutzer (`server.login`) statt Header;
  Nominatim-nahe Tests warten das 1-s-Fenster ab (Test-Pflege, siehe PR-Body).
