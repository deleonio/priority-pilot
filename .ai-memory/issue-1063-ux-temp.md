## UX-Beratung

### Interaktion

**Badge ist rein informativ, kein Interaktions-Element.** Das Geo-Badge zeigt nur an, dass eine Adresse vorhanden ist — es ist **nicht** klickbar, kein Filter, kein Tooltip. Das ist korrekt: ein Marker-Badge trägt Information, keine Aktion (vgl. Rhythmus-Badge in Serienliste).

**Keine additional UI-Flächen durch Badge-Positionierung.** In beiden Listen (Serienliste, Erledigt-Tabelle) muss das Badge in den bereits vorhandenen Zeilen-Layout platziert werden:
- `SeriesTab`: Innerhalb der `series-tree-row`, analog dem Rhythmus-Badge (Zeile ~146)
- `CompletedTasksTable`: Innerhalb der Tabellenzelle (z. B. neben dem Titel)

Die Vermeidung von Extra-Rows oder Expansions ist ein bewusster Anti-Pattern-Check: Modal für Info ohne Interruption-Grund wäre hier falsch (siehe Craft Floor Refuse-Liste).

### Mobile-First

**375px-Viewport (AK6)**: Das Badge darf **keinen horizontalen Überlauf** auslösen. Maßstab:
- Die Tabellen-/Zeilen-Layouts der beiden Listen sind bereits responsive und nutzen keine horizontale Scroll-Container.
- Das Badge hat eine feste Breite (Icon + Padding) und wächst nicht mit Inhalt (kein Text-Label, nur Icon).
- **Empfehlung**: Badge-Größe an bestehenden Rhythmus-Badge orientieren (`series-tree-badge` — bereits auf 375px geprüft im Repo).

**Touch-Zonen (Regel 2)**: Da das Badge nicht interaktiv ist, gelten keine 44px/48dp-Touch-Target-Anforderungen. Die Mindestgröße ergibt sich aus der Icon-Visualisierung und der Lesbarkeit (≥16px Height, siehe Typo-Skala).

**Eine Spalte (Regel 3)**: Beide Listen sind bereits single-column. Das Badge fügt sich in die bestehende Zeilenstruktur ein, kein zusätzliches Grid, kein zweispaltiger Layout-Wechsel.

### A11y/BITV

**Icon alleine reicht nicht (BITV 1.4.1)**: Das Badge muss **immer** aus Icon **und** erkennbarer Bedeutung bestehen. Optionen:
- `aria-label` am Icon-Element (z. B. `aria-label="Mit Standort"`)
- Alternativ: `title`-Attribut als Fallback für Mouse-User (zusätzlich, nicht allein)

**Kontrast (WCAG 1.4.3/1.4.11)**:
- Icon-Fläche ≥3:1 gegen Hintergrund (Badge-Hintergrund gegen Listenhintergrund)
- Wenn Badge Text enhalten würde: ≥4.5:1
- Farbwahl aus Design-Tokens (siehe Design-Sprache unten) stellt sicher, dass beide Schemata (hell/dunkel) kontrastieren.

**Screenreader-Integration**:
- Decorative Icons (`aria-hidden="true"`) würden die Information verbergen → **nicht** verwenden.
- Stattdessen: `aria-label` mit beschreibendem Text („Mit Standort" oder „Ort hinterlegt").
- Wenn das Badge in einer Tabellenzelle steht: Screenreader lesen den Zellinhalt; das Badge ist Teil davon.

**Tastatur-Navigation**: Nicht erforderlich (Badge nicht interaktiv, kein Fokus-Element).

### KoliBri

**Komponenten-Wahl**: `KolBadge` ist die korrekte KoliBri-Komponente für Marker (siehe ux-design.md, Abschnitt 4).
- `_label` (Pflicht-Property): Technisch required, kann aber für Icon-Only-Badges mit `_hide-label` oder leeren String gesetzt werden, wenn die Bedeutung über `aria-label` transportiert wird.
- `_icons`: Font Awesome-Icon-Name (z. B. `fa-solid fa-globe` — bereits in Entscheidung festgelegt).
- `_color`: Farbe aus Design-Tokens (siehe unten).

**Icon statt Emoji**: Die Entscheidung für Font Awesome (`fa-solid fa-globe`) korrigiert das ursprüngliche 🌍-Emoji und folgt damit der Craft Floor Refuse-Liste („Emoji/Unicode als Icon-System Ersatz"). Font Awesome ist im Projekt bereits etabliert (siehe SeriesTab-Toolbar mit `fa-solid fa-pen`).

**Integration in bestehende Komponenten**:
- `SeriesTab.tsx`: `KolBadge` mit `_icons="fa-solid fa-globe"` + `_color` + `_label` (aria-label). Styling analog `series-tree-badge--rhythm`.
- `CompletedTasksTable.tsx`: `KolBadge` in der Tabellenzelle (z. B. Titel-Zelle ergänzen). Achtung: Tabellenzellen sind `KolTableStateful`-Strukturen; Badge ggf. im `expert`-Slot oder in einer自定义 Zelle unterbringen.

### Design-Sprache

**Farb-Rolle für Geo-Badge**: Standort ist eine **Eigenschaft** der Aufgabe/Serie, kein Status (open/inprocess/done) und kein Prioritätssignal. Empfohlene Token-Wahl:
- `--pp-ink` (Primärtext-Color) für Icon auf neutralem Badge-Hintergrund — dezente Integration, keine Ablenkung.
- Alternativ: `--pp-border-subtle` für Badge-Rahmen, wenn Badge nur Icon zeigt (kein gefüllter Hintergrund).

**Vermeidung von Signal-Farbe**: `--pp-signal` oder `--pp-brand` wären hier falsch, da Geolocation **nicht** die nächste Aufgabe oder Primäraktion ist (siehe Haltung, Abschnitt 1: „Ruhe vor Reichtum").

**Skalen-Tokens (Regel 6)**:
- Badge-Abstand zu Nachbarelementen: `--pp-space-2` (8px) oder `--pp-space-3` (12px) — analog Rhythmus-Badge.
- Badge-Icon-Größe: Standard KoliBri-Icon-Size (nicht explizit gesetzt, folgt Komponente).
- Badge-Hintergrund: Wenn gefüllt: `--pp-surface-1` (Karten-Hintergrund) oder dezenter `--pp-surface-0` (Seitenfläche) mit Rahmen.

**Keine neuen Hardcoded-Werte**: Alle Farben/Abstände aus `frontend/src/app.css` Tokens, keine Hex-Werte im Komponenten-Code (siehe ux-design.md, Abschnitt 2).

### Offene UX-Fragen

Keine. Die Entscheidung bindend (Option B), Komponenten-Wahl (`KolBadge`), Icon (Font Awesome), Position (beide Listen) und Mobile-Anforderung (AK6) sind klar definiert.
