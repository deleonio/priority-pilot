# Pakete & Abo als ein Einstellungs-Tab (#1902)

**Stand:** 2026-09-30

## Ziel

Die Reiter „Pakete“ und „Abo“ werden zu einem Reiter „Pakete & Abo“ mit zwei Karten (Regel 1, `.ai-knowledge/ux-design.md`). Keine Verschachtelung gleicher Strukturelemente.

## Vorbedingung

Angemeldeter Nutzer, Einstellungen geöffnet.

## Schritte / erwartetes Ergebnis

1. **Tab-Leiste:** enthält „Pakete & Abo“, nicht mehr „Pakete“/„Abo“ (AK1). Rollen-Tabs rücken um einen Index: Nutzerverwaltung = 7, Zugriff = 8 (Admin: 8 bzw. 9 → 7 bzw. 8; Member: 7).
2. **Karte 1 (Abo)**, `KolCard`: mit Abo Paketname/Status/Periode sichtbar; Rechnungen und „Abo kündigen“ in genau einem `KolDetails` in der Karte (AK2). Ohne Abo nur ein Hinweis, keine Rechnungs-/Kündigungselemente, kein Button „Pakete ansehen“ (AK3).
3. **Karte 2 (Pakete)**, `KolCard`: alle buchbaren Pakete mit Preis und Buchen/Wechseln-Aktion (AK4). _Nachtrag 2026-10-07: wieder als Matrix (ADR 0014 Entscheidung 6), Funktionen höherer Pakete zuletzt._
4. Buchen/Wechseln/Kündigen rufen dieselben API-Routen wie bisher (AK5).
5. `/settings/pakete` und `/settings/abo` öffnen „Pakete & Abo“; `/settings/nutzer` und `/settings/zugriff` öffnen weiter ihren Tab (AK6).
6. Keine `kol-card` in `kol-card`, kein `kol-accordion` in `kol-card`/`kol-accordion` (AK7).
7. 375 px: die Seite scrollt nicht horizontal, die Matrix seitlich in sich; Paket-Aktionen erreichbar (AK8).
