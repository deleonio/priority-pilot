# Layout Assessment — Priority Pilot Frontend

**Generated via** `/impeccable layout` — dual assessment (source + mechanical scan)

---

## Design Health Score: Layout-Specific

| Dimension            | Score | Status                                                                            |
| -------------------- | ----- | --------------------------------------------------------------------------------- |
| Reading Order        | 3/5   | Desktop gut, Mobile schwach (alle Sektionen gleich gewichtet)                     |
| Grouping             | 2/5   | 6+ Header-Elemente ungruppiert; Dashboard 3 Panel-Typen, 2 Stile                  |
| Rhythm               | 2/5   | Monoton: nur 1.5rem für alles; Spacing-Scale definiert aber ungenutzt             |
| Structure vs Content | 2/5   | Framework-Defaults (KolTabs, KolDialog, KolToolbar) dominieren                    |
| Density              | 2/5   | Mobile: zu viel Whitespace (Dashboard) / zu hoch (Task-Liste) / Modals fest 640px |
| Adaptation           | 2/5   | Modals nicht responsive; Model-Selector versteckt statt adaptiert                 |
| Extremes             | 2/5   | Empty States unvollständig; Zoom 200% → 14px Hints; Modals keine Safe-Area        |

**Layout-Score: 15/35** — Strukturiert, aber nicht designed

---

## Spatial Thesis

> **Primärer Lesepfad:** Header → Aktiver Tab → Primäres Widget → Sekundäre Widgets
> **Gruppierung:** Handlungs-Widgets (Card) | Listen-Widgets (List) | Säulen-Widgets (Meter/Badge)
> **Führendes Element:** Dashboard-Karten / Task-Liste / Aktiver Modal-CTA
> **Rhythmus:** Tight (0.5rem) intra-group · Base (1rem) inter-group · Generous (1.5-2rem) section
> **Responsive:** Mobile Stack → Tablet 2-col → Desktop 2-col + Side-by-Side

---

## Priority Issues (P0-P4)

### P0 — Rhythm & Spacing Scale aktivieren

**Problem:** `--pp-space-1` bis `--pp-space-8` definiert, aber nur `--pp-space-4` (1rem) und `--pp-space-6` (2rem) genutzt.
**Fix:** Semantische Gap-Tokens definieren und alle Magic Numbers ersetzen.

```css
--pp-gap-tight: var(--pp-space-2); /* 0.5rem */
--pp-gap-base: var(--pp-space-4); /* 1rem */
--pp-gap-generous: var(--pp-space-6); /* 1.5rem */
--pp-gap-major: var(--pp-space-7); /* 2rem */
```

**Betroffene Stellen:** `.dashboard > *`, `.modal-body section`, `.form-grid`, `.task-filter-bar`, `.series-actions`, `.pillar-editor`

---

### P1 — Header semantisch gruppieren

**Problem:** 6+ Elemente (Logo, Name, Model-Selector, 5 Actions, Avatar) in einer Zeile, nur `gap: 0.5rem`.
**Fix:** 3 Container-Gruppen mit eigenem Gap.

```css
.app-header__brand {
	/* Logo + Name */
}
.app-header__primary {
	/* Model-Selector + Create + Advisor */
}
.app-header__user {
	/* Settings + Help + Logout + Avatar */
}
```

**Bonus:** Model-Selector bei <48rem nicht verstecken, sondern in Overflow-Menü oder 2. Zeile.

---

### P2 — Modals responsive machen

**Problem:** Fixed `width: 40rem` / `44rem` → horizontales Scrollen bei 375px, zu breit bei 768px.
**Fix:** Responsive Width Tokens + `max-width: 100%`.

```css
--pp-modal-width-mobile: 100%;
--pp-modal-width-tablet: 90vw;
--pp-modal-width-desktop: 40rem;
```

**Safe-Area:** Modals benötigen `padding-bottom: env(safe-area-inset-bottom)`.

---

### P3 — TaskForm in Sections gliedern

**Problem:** 6 Sektionen (Titel, Prio/Aufwand, Deadline/Start+Rhythmus, Auto-Delete, Säulen, Checkliste) flach im `form-grid`, alles gleich gewichtet.
**Fix:** 4 Sections mit visueller Trennung, Related Fields eng gruppiert.

| Section                | Felder                               | Interner Gap      |
| ---------------------- | ------------------------------------ | ----------------- |
| 1. Basics              | Titel, Prio, Aufwand                 | tight (0.5rem)    |
| 2. Zeit & Wiederholung | Deadline/Start+Rhythmus, Auto-Delete | base (1rem)       |
| 3. Säulen              | Pillar-Grid + Suggestion             | generous (1.5rem) |
| 4. Checkliste          | Checklist-Editor                     | generous (1.5rem) |

---

### P4 — Dashboard Panel-Typen differenzieren

**Problem:** 3 Panel-Kategorien, nur 2 visuelle Stile (Card vs. List). "Gesamtguthaben" + "Meine Themen" fallen optisch ab.
**Fix:** 3 Panel-Klassen mit eigenem Rhythmus.

```css
.dashboard-action-panel {
	/* next-task, suggestions */
}
.dashboard-list-panel {
	/* top-tasks, deadlines */
}
.dashboard-pillar-panel {
	/* pillars, balance */
}
```

---

## Mechanical Scan Findings

`detect.mjs --scope layout` → **keine Findings** (Detector deckt Layout-Struktur nicht ab).

Manuelle Prüfung ergab:

- Inconsistente `gap` Werte: Header 0.5rem, Task-Zeile 0.5rem, Series 0.75rem, Form 1rem, Modal 1.5rem
- `--a11y-min-size` nur im Header auf Toolbar gesetzt → Task-Zeilen Buttons haben andere Höhe
- `kol-heading` Textfarbe über `--kol-a11y-font-color` gefixt, aber andere KoliBri-Komps haben harte Defaults

---

## Verification Checklist (nach Umsetzung)

- [ ] Squint Test Mobile: 3 Dashboard-Gruppen erkennbar
- [ ] Header Mobile: 3 Gruppen, Model-Selector zugänglich
- [ ] Modals: Kein H-Scroll bei 375px, Touch-Targets ≥44px, Safe-Area
- [ ] TaskForm: 4 Sections, Related Fields eng, Unrelated großzügig
- [ ] Alle Abstände aus `--pp-gap-*` Tokens, keine Magic Numbers
- [ ] Keyboard/Touch Order = Visual Order bei 375px / 768px / 1280px

---

## Recommended Implementation Order

```bash
# Batch 1: Foundation (P0 + P1)
# - Tokens definieren & Magic Numbers ersetzen
# - Header in 3 Gruppen refactorn

# Batch 2: High-Impact User Flows (P2 + P3)
# - Modals responsive + Safe-Area
# - TaskForm Sections

# Batch 3: Polish (P4)
# - Dashboard Panel-Typen
# - Dann: /impeccable polish
```

---

_Related:_ `.impeccable/critique/report.md` (Full Critique), `docs/plans/critique-report.md` (Condensed)
