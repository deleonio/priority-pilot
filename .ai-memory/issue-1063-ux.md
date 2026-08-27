# Issue 1063 — UX (Geo-Badge in Listen)

## Erledigt
- Issue-Body geladen (gh issue view 1063) — Analyse-Block gelesen, Entscheidung (Option B) liegt bindend vor.
- Design-System-Quellen lokal gelesen: ux-design.md (Farbrollen, Skalen-Tokens, Komponenten-Wahl), mobile-ui-rules.md (Touch-Targets, 375px-Viewport, Reflow-Regel), MEMORY.md (Lernings aus vorherigen Läufen).
- KoliBri-Badge-Dokumentation via MCP gelesen (mcp__kolibri-mcp__search/fetch, spec/badge) — `KolBadge` mit `_label` (Pflicht), `_icons`, `_color`; `_label` kann für Icon-Only mit `_hide-label` oder leerem String gesetzt werden, wenn Bedeutung über `aria-label` transportiert wird.
- UX-Review in den Issue-Body geschrieben (KI-UX:START bis KI-UX:END) — 6 Abschnitte (Interaktion, Mobile-First, A11y/BITV, KoliBri, Design-Sprache, Offene UX-Fragen) plus Empfehlungen zu Tokens, Kontrast, aria-label, Position, Farbe (`--pp-ink` statt Signal-Farbe).

## Relevante Stellen
- `frontend/src/components/SeriesTab.tsx:146` — series-tree-badge--rhythm = Styling-Vorbild für Geo-Badge in Serienliste.
- `frontend/src/components/CompletedTasksTable.tsx` — Ziel für Geo-Badge in Erledigt-Liste (Badge in Tabellenzelle, z. B. Titel-Zelle ergänzen).
- `frontend/src/app.css` — Design-Tokens `--pp-*` (Farbrollen, Space-Skala) — Quelle für Badge-Farben/Abstände, keine Hex-Werte im Code.
- KoliBri `KolBadge` — Marker-Komponente mit `_label` (Pflicht), `_icons` (Font Awesome), `_color` (Token).
- `docs/mobile-ui-rules.md#regel-3` — Eine Spalte, kein horizontales Scrollen (375px-Reflow, AK6).
- `.ai-knowledge/ux-design.md#7-craft-floor` — Refuse-Liste: Emoji/Unicode als Icon-System Ersatz verboten (Entscheidung Font Awesome statt 🌍-Emoji korrekt).

## Annahmen
- Badge-Position in beiden Listen integrierbar ohne Layout-Bruch (bestehende Zeilen-Struktur ist flexibel genug für Icon+Padding).
- KoliBri-Icon-Size ist ausreichend für Lesbarkeit (≥16px Height), kein explizites Setzen nötig.
- Screenreader lesen Tabellenzellen korrekt, Badge mit aria-label wird als Teil des Zellinhalts wahrgenommen.

## Verworfen
- Browser-basierte Prüfung (Playwright, 375px-Viewport) — nicht statisch, für UX-Phase nicht zulässig (nur Rule-Check gegen Design-System).
- Alternative Badge-Komponenten — `KolBadge` ist design-systemverpflichtend für Marker.

## Offen
- keine.

## Nächster Schritt
- UX-Review ist fertig, Issue bereit für Spec-Phase (ai:needs-spec Label wird vom Workflow gesetzt).

## Fallstricke
- Badge in `CompletedTasksTable`: Tabellenzellen sind `KolTableStateful`-Strukturen, Badge ggf. im `expert`-Slot oder in einer自定义 Zelle unterbringen (nicht in der Icon-Spalte kollidieren).
- `_label` Property bei `KolBadge` ist technisch required — für Icon-Only entweder `_hide-label` oder leerer String mit aria-label verwenden, nicht Property weglassen.
- Farbwahl: `--pp-ink` (dezenter Primärtext) statt `--pp-signal`/`--pp-brand` (Signal-Farbe wäre hier falsch, Geolocation ist keine Primäraktion).
