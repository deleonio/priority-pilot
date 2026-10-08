# Zifferblatt-Konzept — die Bilder der Lebensbalance

Wie die Startseite die Lebensbalance zeigt, und nach welchen Regeln ein neues Bild dazukommt.

Die App bietet dafür mehrere **Zifferblätter** an, wie eine Uhr: austauschbare Darstellungen
derselben Auskunft. Der Nutzer wählt eines in den Einstellungen; gerechnet wird für alle dasselbe.

Schwesterdokumente: [.ai-knowledge/ux-design.md](../.ai-knowledge/ux-design.md) (Farbrollen,
Skalen), [docs/mobile-ui-rules.md](mobile-ui-rules.md) (Bedienung).

## 1. Die Trennung, auf der alles steht

```
heartBalance.ts        → die Auskunft: Gesamt-Balance (0–1) und je Säule Ist, Soll, Erfüllungsgrad
      ↓
balanceMetric.ts       → die Kennzahl fürs Bild: je Säule Ist ÷ Soll, ungedeckelt, gemeinsam normiert
      ↓
balanceFigure.ts       → die Geometrie: wo Radien, Winkel, Phasen im 100×100-Feld landen
      ↓
BalanceFigure(.tsx/GL) → zwei Fassungen desselben Bildes: SVG und WebGL
```

**Ein Bild rechnet nie selbst.** Es bekommt fertige Zahlen und entscheidet nur über die Form. Wer
ein neues Zifferblatt baut, fasst die oberen zwei Ebenen nicht an — und kann deshalb auch nichts an
der Aussage verändern.

## 2. Die Kennzahl

Je Säule das **Verhältnis Ist zu Soll**, ungedeckelt:

| Ist-Anteil | Soll-Anteil | Verhältnis | Lesart                 |
| ---------- | ----------- | ---------- | ---------------------- |
| 10 %       | 20 %        | 0,5        | halb so viel wie nötig |
| 20 %       | 20 %        | 1,0        | genau auf Ziel         |
| 30 %       | 20 %        | 1,5        | zieht davon            |
| beliebig   | 0 %         | 0          | Säule ohne Ziel        |

**Die größte Zahl ergibt immer die größte Form.** Das ist die eine Regel, die jede Figur einhalten
muss — bei den Strahlen und Zeigern die Länge, bei Blüte und Kristall die Reichweite des Lappens.

**Normierung:** Die Skala endet beim größten vorkommenden Verhältnis, mindestens aber bei 1. So
nutzt das Bild seinen Platz aus, und die Soll-Marke (`targetMark`) bleibt im Bild, auch wenn alle
Säulen unter ihrem Ziel liegen.

**Warum nicht `level`:** `level` ist dasselbe Verhältnis, bei 1 gedeckelt. Der Deckel gehört zur
Balance-Rechnung (mehr als sein Soll zu erfüllen macht die Verteilung nicht besser) und steht
zahlengleich auch auf dem Server (`server/src/logics/heartBalance.ts`). Das Bild braucht die
ungedeckelte Schwester: „schießt über das Ziel hinaus" ist genauso eine Aussage wie „bleibt zurück".

**Die Gesamt-Balance misst zweifach (Strengste-Prinzip, #1474):** Der Füllstand ist das Minimum aus
zwei normierten quadratischen Abweichungen über die Säulen mit Ziel — einer soll-gewichteten und
einer ungewichteten, die jede Ziel-Säule einzeln zählt. Die Gewichtung allein dämpfte eine leere,
niedrig gewichtete Säule mehrfach (kleines Soll quadriert, Normierung gekappt): 60/0/10/10/10 bei
Gewichten 60/10/10/10/10 kam auf 0,6667 und damit durch die „Gut in Balance"-Schwelle; die
ungewichtete Komponente zieht den Fall auf 0,5528 („Leichte Schieflage"). Bei Ist = Soll stehen
beide Komponenten auf 1 — ausgewogene Verteilungen verlieren dadurch nichts. Der `level`-Deckel
trägt weiterhin in beide Komponenten dieselbe Unterdeckung bei und widerspricht dem Prinzip nicht.

## 3. Was jedes Zifferblatt mitbringen muss

1. **Die Kennzahl je Säule als Größe.** Größer heißt mehr. Keine Ausnahme.
2. **Eine Soll-Marke.** Die Stelle, an der ein Verhältnis von 1 läge — sonst ist eine Form ohne
   Bezugsgröße bloß Dekoration (ux-design.md §1).
3. **Die Ordnung „stärkste Säule zuerst"** (`byStrength`), mit der Säulen-`id` als Tie-Break. Eine
   Umsortierung der Säulen-Anzeige darf das Bild nicht neu würfeln.
4. **Farbe aus der Neon-Rampe** `--pp-pillar-neon-1…7`, Rang über `colorIndex` (folgt der Säulen-`id`,
   nicht der Position). Ab dem 8. Rang neutral — nie zyklisch neu einfärben.
5. **Das gemeinsame Zifferblatt**: 100 Striche ab 12 Uhr im Uhrzeigersinn, einer je Prozentpunkt
   Gesamt-Balance, dunkelrot → orange → dunkelgrün. Striche bis zum Wert leuchten, der Rest bleibt
   abgedunkelt stehen. Das Zifferblatt **bewegt sich nie** — es ist die Skala.
6. **Zwei Fassungen**: WebGL fürs Material, SVG als vollwertiger Rückfall. Dasselbe Bild, nur ohne
   Leuchten. Beide lesen dieselbe Geometrie aus `balanceFigure.ts`.
7. **Bewegung ist abbestellbar.** Master „Animationen", Feinschalter „Balance animieren" und
   `prefers-reduced-motion` schalten sie ab; das Bild bleibt dann **vollständig**, nur still.
8. **Die Legende bleibt.** Farbe trägt nie allein Bedeutung: Der Säulenname steht als Text daneben
   (Relief-Regel, ux-design.md §2, Regel 4).

## 4. Der gemeinsame Rahmen

| Größe               | Wert                            | Warum                                                                |
| ------------------- | ------------------------------- | -------------------------------------------------------------------- |
| Zeichenfläche       | `100×100`, Mitte `(50, 50)`     | quadratisch, weil alle Figuren um einen Mittelpunkt liegen           |
| Zifferblatt innen   | `RING_INNER = 40`               | Strichlängen 5 bzw. 7,5 (Zehner-Marke)                               |
| Figurenfeld außen   | `FIGURE_MAX = 33`               | plus Atmen (6 %) und Puls (3 %) → 36 < 40, nichts läuft in die Skala |
| Kleinste Form       | `R_MIN = 8`                     | eine Säule ohne Ziel darf nicht verschwinden                         |
| Auftakt             | `RISE_DURATION = 1,4 s`         | einmalig, `easeOutCubic`                                             |
| Ruhepuls            | `1,5–2,6 s` je nach Balance     | `--pp-heart-beat`; ruhiger, je ausgewogener                          |
| Schwingung je Säule | `6,5–9,9 s`, Phase golden       | damit gleich große Formen unterscheidbar bleiben                     |
| Drehung je Säule    | `19–26,5 s`, Richtung wechselnd | dasselbe                                                             |

**Die Bewegung hängt am Farbrang, nicht an der Figur.** Dieselbe Säule schwingt in jedem
Zifferblatt gleich — wer das Bild wechselt, erkennt sie wieder.

## 5. Zwei Fallen, die schon zugeschnappt sind

**Gleichstand macht Formen gleichförmig.** Liegen alle Säulen auf ihrem Ziel, sind alle Werte
gleich — ohne unterschiedliche Phase und Periode atmeten alle Formen im Gleichschritt und der
Bestzustand wirkte starr. Deshalb bekommt jede Säule eine eigene Phase (goldener
Winkel) und eine eigene Periode. `balanceFigure.test.ts` nagelt das fest.

**Der Auftakt darf nicht an der Shader-Uhr hängen.** Die Render-Loop läuft nur, wenn das Bild
sichtbar und der Tab im Vordergrund ist. Ein aus `u_time` abgeleiteter Auftakt steht bei einem
Standbild auf 0 — und das Bild ist leer statt fertig (genau der Fall „Dashboard im Hintergrund-Tab
geöffnet"). Der Fortschritt kommt deshalb als Uniform `u_rise` aus der Komponente, und ein Standbild
setzt ihn auf 1.

## 6. Die Zifferblätter heute

| Schlüssel  | Bild     | Größe ist …                        | Material                          |
| ---------- | -------- | ---------------------------------- | --------------------------------- |
| `strahlen` | Strahlen | Länge, längster auf 12 Uhr         | Lichtkeil mit auslaufendem Puls   |
| `bluete`   | Blüte    | Lappenlänge, weitester auf 12 Uhr  | weiche Neon-Kontur, irisierend    |
| `kristall` | Kristall | Lappenlänge (Stützpunkte wie oben) | Facetten, helle Kanten und Knoten |
| `zeiger`   | Zeiger   | Länge, längster auf 12 Uhr         | schlanker Lichtkeil, helle Spitze |

**„Blüte" und „Kristall" sind dieselbe Silhouette in zwei Materialien**: Alle Säulen bilden
**eine** Silhouette — je Säule ein Stützpunkt auf ihrem Winkel (`buildPetals`), so weit außen wie
ihr Wert, stärkste Säule auf 12 Uhr. Zwischen den Stützpunkten mischt die Kontur Radien **und**
Farben der Nachbarn (Partition der Eins, `petalRadiusAt`): Die Blüte glättet die Mischung zu weichen
Lappen mit irisierendem Saum, der Kristall lässt sie kantig — Fächerflächen aus der Mitte, deren
Facetten das Licht je nach Lage anders fangen, dazu helle Knoten auf den Spitzen. Auch sie teilen
sich einen Shader-Zweig (`bool soft`) — die eine Stelle, an der ein neues Zifferblatt allein durch
Material entstehen darf.

**„Zeiger“** folgt dem Muster der Strahlen mit
schlankerer Geometrie — dieselben Winkel- und Längen-Slots, nur schmaler: Das Zifferblatt ist
bei ihr Teil der Figur, ein breiter Keil würde die Skala unter sich begraben.

**Die Soll-Marke** ist in allen Zifferblättern ein gestrichelter Kreis.

Gewählt wird in **Einstellungen → Darstellung und Eingabe → „Bild der Lebensbalance"**, gespeichert
am Konto (`GET`/`PUT /balance-variant`, #2009) mit `localStorage` (`pp-balance-variant`) als
Gerätespiegel. Default ist `bluete`; ein am Konto gespeichertes, inzwischen entferntes Bild fällt
ebenfalls auf den Default zurück. Alle Zifferblätter teilen sich Programm, Zifferblatt und Rahmen.

## 7. Bilder zum Anschauen erzeugen

`frontend/e2e/zifferblatt-shots.spec.ts` fährt das Dashboard mit echter Session hoch, schaltet alle
Zifferblätter durch und legt je einen Screenshot in `frontend/e2e/__shots__/` ab:

```bash
SHOTS=1 pnpm --filter frontend exec playwright test e2e/zifferblatt-shots.spec.ts
```

Ohne `SHOTS` überspringt er sich — er nagelt nichts fest und hat im normalen Lauf nichts verloren.
Die Bilder selbst sind nicht versioniert (`.gitignore`): Sie veralten mit jeder Farb- oder
Geometrieänderung.

## 8. Ein neues Zifferblatt bauen

1. **Geometrie** in `lib/balanceFigure.ts` ergänzen: eine `buildX(metrics)`-Funktion, die
   `FigureMotion` mitführt und `byStrength` benutzt.
2. **Shader-Zweig** in `balance-figure.frag` unter `u_figure` ergänzen, plus die nötigen Uniforms.
   Zifferblatt, Auftakt und Ruhepuls stehen schon da.
3. **SVG-Zweig** in `BalanceFigure.tsx` ergänzen — dasselbe Bild ohne Material.
4. **Slots** in `BalanceFigureGL.tsx` (`toSlots`) um die neuen Felder erweitern.
5. **Schlüssel** in `lib/balanceVariant.ts` eintragen (Typ, Label, Reihenfolge).
6. **Tests**: Ordnung, Soll-Marke, Feldgrenzen in `balanceFigure.test.ts`; Slot-Abbildung in
   `BalanceFigureGL.test.tsx`; je Säule genau ein `heart-column` in `HeartBalance.test.tsx`.
7. **Diesen Abschnitt und die Tabelle in §6 nachziehen.**

Was **nicht** dazugehört: eine eigene Rechnung, eine eigene Farbrampe, ein eigenes Zifferblatt, eine
eigene Prozentzahl. Wer davon etwas braucht, baut kein Zifferblatt mehr, sondern ein zweites Widget.
