# Spec: Issue 1284 — Dashboard-Herz: Verteilungsbänder stimmen nicht mit der Legende überein

## Ziel

Die Farbbänder im Glas-Herz (WebGL) zeigen dieselbe Ist-Verteilung wie die Legende und wie der
SVG-Rückfallpfad. Ursache (Analyse, am Code verifiziert): Der Shader liest `u_band_edges[i]` als
**linke** Kante von Farbe i (`bandColorAt` startet mit Farbe 0 und wechselt an Kante i),
`toSlotBands` liefert aber die **rechte** Kante (`band.x1`) — jedes Band wird um eine Position
verschoben gemalt. Zusätzlich liegt das letzte Band (bei 6 Säulen z. B. 2 %) mit x ≥ 98 außerhalb
der sichtbaren Herzbreite (Kontur spannt x 4–96) und wäre auch bei korrekter Kanten-Semantik
unsichtbar.

## Vertrag

### Banddaten (geteilt von SVG und Glas, `HeartBalance.tsx` `bands`-useMemo)

- Die Bänder spannen die **sichtbare** Gefäßbreite ab: erstes `x0 = 4`, letzte Kante `x1 = 96`
  (Bounding-Box der Herzkontur); dazwischen kumulierte Ist-Anteile proportional.
- Jedes Band mit Ist-Anteil > 0 hat positive Breite — auch das größte und das kleinste.
- Ohne Punkte gilt weiter die Soll-Verteilung (bestehendes Verhalten, ungetestet geändert).

### Slot-Mapping (`toSlotBands`, HeartGlass.tsx)

- Kanten haben **Links-Kanten-Semantik**: Slot i beginnt an der linken Kante (`x0`) seines Bandes,
  normiert auf die sichtbare Breite: `edge = clamp((x0 - 4) / 92, 0, 1)`.
- Farbe 0 endet damit an der rechten Kante von Band 0 (= linke Kante von Band 1); das letzte Band
  behält seine Fläche bis 1.0 (kein weiterer Kantenwechsel im Shader).
- Bis 8 Bänder: ein Slot je Band, Farbe aus `colors.pillars[colorIndex]` (bzw. neutral ab Rang 7).
- Mehr als 8 Bänder: die ersten 7 behalten Farbe und linke Kante; der restliche Overflow läuft im 8. Slot **neutral** zusammen und beginnt an der linken Kante des ersten nicht mehr einzeln
  geführten Bandes (`bands[7].x0`) — startete er erst bei `bands[8].x0`, färbte Farbe 6 das 8. Band in dessen Farbe (dieselbe Fehlerklasse wie der Ticket-Fehler).
- Der Shader (`heart-glass.frag`) bleibt inhaltlich unverändert: `t = (xr - 4) / 92` passt exakt
  zur normierten Kante, Preview-Konstanten (5 gleichbreite Bänder) bleiben unberührt.

### Fugen (AK3)

- Die Glas-Fugen liegen an denselben Kanten wie im SVG: für jedes Band ab dem 2. gilt
  `edge_i = (rect_i.x - 4) / 92` mit `rect_i.x` = linke Kante des SVG-Clip-Rects.

## Akzeptanzkriterien → Tests

| AK               | Test                                                                                                                                                                                                     | Erwartung                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AK1 (Kanten)     | NEU `HeartGlass.test.tsx`: 6 Bänder 49/14/14/11/10/2 % → Slot-Kanten = linke Kanten (0 / .49 / .63 / .77 / .88 / .98)                                                                                    | rot heute (x1-Semantik + fehlender Export), grün nach Fix |
| AK1 (Overflow)   | NEU `HeartGlass.test.tsx`: 9 gleiche Bänder → 8 Slots, Slot 8 neutral ab linker Kante des 8. Bandes                                                                                                      | rot heute                                                 |
| AK2 (je Band)    | NEU `HeartGlass.test.tsx`: je Band ein eigener Slot in eigener Rampenfarbe — auch größtes und kleinstes Band; letzter Slot behält Fläche (Kante < 1)                                                     | rot heute                                                 |
| AK2 (Datenseite) | NEU in `HeartBalance.test.tsx`: SVG-Clip-Rects spannen [4, 96], Breiten proportional, alle > 0                                                                                                           | rot heute (x ab 0, Ende 100)                              |
| AK3 (Spiegel)    | NEU `HeartGlass.test.tsx`: `toSlotBands` über die SVG-Rect-Daten → Kanten exakt an `(rect.x - 4) / 92`                                                                                                   | rot heute                                                 |
| TF3 (Regression) | bestehende `HeartBalance.test.tsx` + `heartBalance.test.ts` bleiben grün                                                                                                                                 | —                                                         |
| TF4 (e2e)        | **kein roter Test**: Pixel-Sampling am WebGL-Canvas ohne `preserveDrawingBuffer` ist im Runner laut Analyse selbst „nicht stabil reproduzierbar"; visuelle Verifikation mit Begründung in der Impl-Phase | —                                                         |

## Struktur (Implementierungsphase)

- `HeartGlass.tsx`: `toSlotBands` exportieren und auf `x0`-Kanten drehen (Formel oben); ggf.
  Auslagerung nach `lib/` — dann Import im Test anpassen.
- `HeartBalance.tsx` `bands`-useMemo: Start `x = 4`, letzte Kante `96` setzen (Bandbreiten
  proportional zum Ist-Anteil der sichtbaren Breite; kein Spalt durch Float-Reste an 96).
- Keine Änderung an `heart-glass.frag`, kein Änderung an der SVG-Zeichnung selbst (Clip, Wellen,
  Fugen-Linien bleiben).
