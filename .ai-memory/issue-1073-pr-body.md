Rote Spec-Tests; die Umsetzung folgt in Phase 4.

## Abgedeckte Akzeptanzkriterien
- **AK1** – Adresse aus `useGeolocation().address` wird angezeigt, Roh-Koordinaten entfallen:
  Unit (`Footer.test.tsx` AK1) + e2e (`issue-1073-footer-address.spec.ts`, `/reverse-geocode`-Mock).
- **AK2** – `address` null/leer → Koordinaten als stiller Fallback (KI-UX: kein Alert):
  Unit AK2a/AK2b + e2e (429-Antwort).
- **AK3** – Separator `" | "` zwischen Adresse bzw. Fallback und Version: Unit AK3a/AK3b + e2e.
- **AK6** – Mobile-First 375px: e2e Bounding-Box-Prüfung mit langer Adresse (inkl. langer Adresse
  aus dem KI-UX-Block). Bewusst keine `scrollWidth`-Assertion: die App-Shell clippt mit
  `overflow-x: hidden`, der Check wäre mutationstest-geprüft zahnlos.

## Dedup
- **AK4** (Versionsnummer) und **AK5** (`role="contentinfo"`) sind durch die bestehenden
  `#290`-Tests in `frontend/src/components/Footer.test.tsx` bereits abgedeckt — keine Duplikate.

## Test-Pflege-Bedarf
- Keiner. Bestehende `#290`-Tests bleiben unverändert gültig.

## Offene Fragen
- Keine.

Hinweis: die roten Tests scheitern erwartungsgemäß, bis `Footer.tsx` `address` konsumiert
und den Separator `" | "` setzt.

Closes #1073
