# Issue 727: Range-Inputs bei schmalen Bildschirmen übereinander anzeigen

## Ziel

Range-Inputs (Schieberegler für Priorität 1–5 und Aufwand 0,1–1 Tage) werden bei schmalen Bildschirmen (≤768px) vertikal gestapelt statt nebeneinander, um die Usability auf Mobile/Tablet zu verbessern.

## Vorbedingung

- App ist geöffnet (Dashboard oder Aufgaben-Dialog)
- Range-Inputs sind sichtbar (z.B. im Schnellerfassungs-Dialog oder im Aufgaben-Bearbeitungs-Dialog)

## Schritte

### 1. Mobile-Ansicht (≤768px)

1. Browser-Fenster auf ≤768px Breite skalieren (z.B. 375px für Mobile, 768px für Tablet)
2. Schnellerfassungs-Dialog öffnen („Neuen Task anlegen")
3. Bereich mit Priorität- und Aufwand-Regler prüfen

**Erwartetes Layout:**

- Prioritäts-Regler **über** Aufwands-Regler (vertikal gestapelt)
- Jeder Regler nimmt die volle Breite ein
- Kein horizontaler Scroll notwendig
- Labels und Inputs sind gut lesbar (kein Text-Overflow)

### 2. Desktop-Ansicht (>768px)

1. Browser-Fenster auf >768px Breite skalieren (z.B. 1024px oder 1920px)
2. Schnellerfassungs-Dialog öffnen
3. Bereich mit Priorität- und Aufwand-Regler prüfen

**Erwartetes Layout:**

- Prioritäts- und Aufwands-Regler **nebeneinander** (horizontal)
- Beide Regler passen nebeneinander in den Dialog

### 3. Breakpoint-Übergänge

1. Fenster langsam von 375px auf 1024px ziehen (und zurück)
2. Bei jedem Breakpoint (768px) das Layout prüfen

**Erwartetes Verhalten:**

- Keine Layout-Breaks (Elemente rutschen nicht versehentlich übereinander)
- Kein horizontaler Scroll bei schmalen Viewports
- Keine Overlaps oder Verdeckungen
- Flüssiger Übergang ohne „Springen"

## Erwartetes Ergebnis

- **≤768px**: Range-Inputs sind vertikal gestapelt, voll responsive
- **>768px**: Range-Inputs sind nebeneinander (aktuelles Verhalten beibehalten)
- **Übergänge**: Keine Layout-Breaks, kein Scroll-Overflow, kein Overlay-Konflikt

---
## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, Range-Inputs responsive
- **v1.0** (Initialefassung für Issue #727)