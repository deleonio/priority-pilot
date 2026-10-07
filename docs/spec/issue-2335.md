# Spec #2335 — Bahn-Planer entfernen

## Ziel

Der öffentliche Bahn-Routenplaner (Seite `/bahn`, Server-Proxy `/api/transit/*`) existiert nicht mehr.
Gemeinsam genutzter Code (Adresssuche, Aufgaben-Orte, Ortsfavoriten) bleibt unverändert.

## Frontend-Weiche (AK1, AK2)

- Vorbedingung: Pfad `/bahn` (in der App `/app/bahn`).
- Schritte: `Root` wird gerendert.
- Erwartet: kein Routenplaner (Überschrift „Bahn-Routenplaner“); stattdessen der reguläre
  authentifizierte Einstieg (Auth-Gate, eingeloggt das Dashboard).

## Server (AK3)

- Vorbedingung: Server läuft, kein Upstream erreichbar nötig.
- Schritte: `GET /api/transit/geocode`, `GET /api/transit/plan`.
- Erwartet: Status 404 (keine Route registriert).

## Nicht per Test abgesichert (AK4–AK6)

Regression über Bestandstests (AK4); knip und grep-Nachweis im PR-Body (AK5); Doku und
Datenschutzerklärung (AK6) sind kein Anwendungscode.
