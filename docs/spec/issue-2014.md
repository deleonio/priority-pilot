# Spec #2014 — Kategorie-Verwaltung: Kennzeichen inline statt einer Kartenzeile je Kategorie

**Issue:** #2014 · **Stand:** 2026-10-04 (Spec-Phase) · **Vertragstyp:** Anzeige-Vertrag (`CategoryList`) + E2E

## Ziel

Die Kategorie-Verwaltung (Einstellungen → Kategorien) rendert je Kategorie eine eigene Kartenzeile
(`li.pillar-item.category-item`, `CategoryList.tsx:119-133`). Künftig stehen alle Kategorien als
Chips (Kennzeichen-`CategoryBadge` + kompakte Bearbeiten-/Löschen-Aktionen) in **einer**
umbrechenden Flex-Zeile — Layout-Muster `.task-tree-badges` (`app.css:1994-2002`). Die Semantik
bleibt eine Liste (`ul.category-items`, je Kategorie ein `li[data-category-id]`); die geteilte
Kartenklasse `.pillar-item` fällt bei Kategorien weg und bleibt unangetasteter Vertrag der Säulen-
und Gruppenkarten (`app.css:2338-2366`, `li.pillar-item`-Locators der Säulen-Specs).

## Feste Annahmen

1. Chip-Layout bekommt eigene `.category-items`-Regeln (Randbedingung der Analyse); `.pillar-item`/
   `.pillar-items`-Styles dürfen sich nicht ändern.
2. Je Chip sind genau die zwei Aktionen interaktiv — nicht der ganze Chip (KI-UX: kein doppeltes
   Klickziel, keine verschachtelten interaktiven Elemente). Zugängliche Namen dürfen den
   Kategorienamen tragen („Kategorie „Steuern“ bearbeiten“, Icon-Variante) oder kompakte
   Text-Buttons bleiben — beides zulässig; Tests lokalisieren die Aktionen deshalb per
   Rollen-Regex **innerhalb** des konkreten `li`, nicht über den exakten Labeltext.
3. Dialoge (`CategoryFormDialog` vorbelegt, `CategoryDeleteDialog` mit `fallbackFocusRef`),
   Toolbar „Neue Kategorie anlegen“ sowie Leer-, Lade- und Fehlerzustand bleiben unverändert.
4. Reines Layout-Ticket: API/DTO, `onCategoryChanged`, Speicher-/Löschverhalten unverändert.

## Verhalten je Akzeptanzkriterium

### AK1 — Chips in einer umbrechenden Zeile statt Kartenzeilen

**Voraussetzung:** ≥ 3 Kategorien vorhanden.
**Schritte:** Einstellungen → Kategorien öffnen; Desktop-Chips vermessen, gesondert bei 375 px.
**Erwartetes Ergebnis:** Alle Kategorien hängen in derselben Liste (`ul.category-items`), je
Kategorie genau ein `li[data-category-id]` ohne Karten-DOM (keine `.pillar-item`-Klasse). Die
Liste ist am Desktop eine **umbrechende Flex-Zeile** (computed `display:flex` +
`flex-wrap:wrap`) — nicht das Säulen-Karten-Grid, das `.pillar-items` heute ab 48rem aktiv
schaltet (`app.css:2399`); mindestens zwei Chips überlappen vertikal (dieselbe Zeile). Bei 375 px
bricht die Zeile um: kein Chip ragt über den Viewport (Bounding-Box, Muster #1098 —
`scrollWidth` der App-Shell ist strukturell grün), und innerhalb der Liste gibt es keinen echten
horizontalen Scroll-Container (`measureHorizontalScroll`, Muster #1258).

### AK2 — Bearbeiten und Löschen bleiben je Chip erreichbar

**Voraussetzung:** ≥ 2 Kategorien.
**Schritte:** In einem per `data-category-id` adressierten Chip „Bearbeiten“ klicken, Dialog
wieder schließen; dann im selben Chip „Löschen“ klicken und bestätigen.
**Erwartetes Ergebnis:** Bearbeiten öffnet `CategoryFormDialog` mit den Werten genau dieser
Kategorie (Name und Farbe vorbelegt). Löschen öffnet `CategoryDeleteDialog`, der genau diese
Kategorie nennt; „Endgültig löschen“ nimmt den Chip aus der Liste (Neuladen, `onCategoryChanged` —
unit-seitig durch den Bestandstest zum Löschen gespiegelt).

### AK3 — Touch-Targets der Chip-Aktionen ≥ 44×44 px

**Voraussetzung:** Kategorie-Liste bei 375 px gerendert.
**Erwartetes Ergebnis:** Bounding-Box jedes Aktions-Schalters (Bearbeiten, Löschen) mindestens
44×44 CSS-px (KoliBri `--a11y-min-size` 2.75rem, `app.css:1015`).

### AK4 — Leer-, Lade- und Fehlerzustand sowie Toolbar bleiben unverändert

**Erwartetes Ergebnis:** Leerzustand (genau eine Anlege-Aktion), Fehlerzustand (Alert mit
„Erneut versuchen“) und Toolbar sind durch Bestandstests gespiegelt — kein Duplikat. Ergänzt wird
nur der bisher ungespiegelte Ladezustand: Spinner, keine Anlege-Aktion.

## Test-Pflege / Dedup

- Bereits gedeckt, kein Duplikat: Leerzustand, Fehlerzustand, Anlegen inkl. `onCategoryChanged`,
  Lösch-Dialog-Text, Badge-Darstellung (`CategoryList.test.tsx`) sowie Kategorie-Anlegen/-Löschen
  per E2E (`categories.spec.ts` AK1/AK4).
- Neue Tests: Chip-Struktur ohne Karten-DOM (TF1-A), je-Chip-Dialog-Adressierung (TF1-B/C),
  Ladezustand (TF1-D), Flex-Zeile statt Säulen-Grid + 375-px-Umbruch + Touch-Targets (TF2).
- **Zahnlosigkeit korrigiert (erste Rot-Verifizierung):** eine reine y-Überlappungs-Assertion war
  am Desktop heute schon grün — `.pillar-items` wird ab 48rem zum Grid (`app.css:2399`), Karten
  stehen dort bereits nebeneinander. Der E2E-Kern ist deshalb der Computed-Style-Vergleich
  (`flex`+`wrap` statt `grid`) plus der y-Überlappung als semantischer Zweitbeleg.
- Widerspruch zu Bestandstesten: keiner (`li[data-category-id]` bleibt, `categories.spec.ts`
  AK1 lokalisiert darüber).
