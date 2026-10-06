# Spec #2275 — Monatskarte: Logo oben, Domain `balamentum.modevel.de`, keine Dashboard-Fußzeile

Ergänzt/ersetzt Teile von `issue-2255.md` (Test-Pflege: alte Domain `balamentum.app`, Dashboard-Fußzeile).

## Ziel

Das geteilte Monatsbild zeigt das echte Balamentum-Logo oben, unten Domain sowie Play- und PWA-Logo.
Die Dashboard-Karte hat keine Marken-Fußzeile mehr. Alle Share-Bilder (Woche, Monat, Jahr, Challenge)
nennen `balamentum.modevel.de` statt `balamentum.app`.

## Verhalten

1. `erzeugeMonatsKarteSvg`: Gruppe `id="brand-balamentum"` enthält das eingebettete Logo (kein Kreis-Platzhalter)
   und liegt oberhalb der Balken (kleinere y-Position) (AK1).
2. Domain `balamentum.modevel.de` als sichtbarer Text; Play- und PWA-Logo bleiben (AK2).
3. Keine externen Referenzen: Bild-Referenzen sind `data:`-URIs, einzige http(s)-URL ist `https://balamentum.modevel.de` (AK3).
4. `MonthlyBalanceCard` rendert keine Logos, keinen Balamentum-Link, kein `play.google.com` (AK4).
5. Wochen-, Jahres-, Challenge-Karte: Link-Ziel und Text `balamentum.modevel.de`, `balamentum.app` kommt nicht vor (AK5).
6. Balkendiagramm gestalterisch überarbeitet (AK6) — visuelle Prüfung per Screenshot im PR, kein Test.
7. 375 px: Karte ohne horizontalen Überlauf, per Bounding-Box (AK7; bestehender e2e `AK5: Mobile 375px`).
