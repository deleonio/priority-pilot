# Design-Optimierungsplan

Stand: 2026-09-06 · Basis: Impeccable **Frontend-Audit** (16/20, Gut) und **Dashboard-Critique**
(29/40, Gut). Critique-Snapshot:
[`frontend/.impeccable/critique/2026-09-06T09-29-33Z__src-components-dashboard-tsx.md`](../frontend/.impeccable/critique/2026-09-06T09-29-33Z__src-components-dashboard-tsx.md).
Vorgänger-Dokument: [UX-Audit 2026-08](ux-audit-2026-08.md).

Diese Datei ist die Arbeitsliste — abhaken, weitermachen. Jeder Punkt nennt das passende
`/impeccable`-Kommando. Nach Fix-Runden: `/impeccable audit` und `/impeccable critique dashboard`
erneut ausführen, um den Score-Fortschritt zu sehen.

## Arbeitsliste

### P1

- [ ] **LoginPage: falscher Token `--pp-text`** — existiert nicht (echter Token: `--pp-ink`), Fallback
      `#1a1a1a` macht den Text im Dark Mode unlesbar (≈1,3:1 auf `--pp-bg`-dunkel; Anti-FOUC-Bootstrap in
      `index.html` setzt `data-theme` schon vor dem Login). Gleichzeitig die Hartcodierungen in
      `LoginPage.tsx:69-91` (Fehler-Box `#fef3f2/#fda29b/#b42318`, Button `#1570ef`) tokenisieren.
      → `/impeccable polish`
- [ ] **Dashboard: Handlungsmächtigkeit** — Einträge in „Was ist jetzt dran?", „Wichtigste Tasks",
      „Anstehende Deadlines" und „In der Nähe" sind reiner Text; die Schleife „sehen → entscheiden → tun"
      bricht. Mindestens Vorschläge und Deadlines antippbar machen (Aufgabe öffnen oder Direkt-Aktion).
      → `/impeccable polish`
- [ ] **Dashboard: Falz bei 375×812** — Herz (≈600px inkl. Legende) schiebt „Nächste Aufgabe" samt
      Primäraktion „Erledigt" unter den Falz; kollidiert mit der Daumen-Zonen-Regel aus den
      [Mobile-UI-Regeln](mobile-ui-rules.md). Fix ohne den committed Herz-ersten Eindruck zu brechen:
      Legende standardmäßig eingeklappt oder Herz-Höhe deckeln — Ziel: Nächste-Aufgabe-Karte im ersten
      Viewport. → `/impeccable layout`

### P2

- [ ] **Skip-Link „Zum Inhalt"** — Header mit 5 Icon-Aktionen wiederholt sich auf jeder Ansicht
      (WCAG 2.4.1). → `/impeccable polish`
- [ ] **Badge-Warnkontrast messen** — `#c66a00` mit weißem Auto-Text = 3,84:1 (< 4,5); wählt KoliBri
      Schwarz, sind es ≈5,5:1. Im Browser/e2e messen statt raten:
      `dark-mode-contrast.spec.ts` um Badge-Case erweitern. Betroffen: `TaskTable.tsx:54`,
      `TaskTree.tsx:103`, `ForestPanel.tsx:37`. → `/impeccable audit` (Verifikation), dann Fix
- [ ] **BahnPage-Hardcode-Insel** — komplette Eigenfarben (`#1a4fd8`, `#b00020`, `#0a7d28`,
      `#e8eefa`) ohne Theme-Anbindung; Kontraste einzeln ok (6,41/5,26/7,33:1). Entscheidung:
      bewusstes eigenes öffentliches Universum (dokumentieren) oder `--pp-*`-Tokens.
      → `/impeccable document` bzw. `polish`
- [ ] **Dashboard-Redundanz** — „Gesamt"-Kachel = Offen + Erledigt (rechenbar); zwei ähnliche
      Ranglisten („Was ist jetzt dran?" vs. „Wichtigste Tasks"); drei Sichten der Säulen-Wahrheit
      (Herz-Legende, „Meine Themen", „Gesamtguthaben"). Kacheln zu Statuszeile verdichten, eine
      Rangliste behalten, Säulen-Sichten zusammenführen. → `/impeccable distill`
- [ ] **Null-Zustand-Choreografie** — neues Konto oder Gruppen-Neuling sieht bis zu sieben leere
      Widgets statt einer Einladung; nach dem Gruppen-Beitritt (#1226) ist die Gruppe auf dem Dashboard
      unsichtbar; „Hallo {Name}!" bleibt ohne gepflegten Anzeigenamen leer. Leere Widgets kollabieren,
      eine Primär-Einladung, langfristig Gruppen-Präsenz. → `/impeccable onboard`

### P3

- [ ] **Badge-Hex-Maps auf Tokens** — vier Komponenten definieren Priority-/Urgency-Farben als Hex
      (`Dashboard.tsx:21`, `TaskTable.tsx:53`, `TaskTree.tsx:102`, `ForestPanel.tsx:36`); `--pp-danger`
      ist exakt `#b42318`. Zentrales Muster statt Kopien. → `/impeccable polish`
- [ ] **Schriftgrößen-Drift** — 15× rohes `0.875rem` statt `--pp-font-size-sm`; ~7 distinct Größen
      gegen die Fünf-Größen-Regel (Regel 6 der [Mobile-UI-Regeln](mobile-ui-rules.md)).
      → `/impeccable polish`
- [ ] **Regions-Semantik vereinheitlichen** — `role="region"` + `aria-label` nur auf 3 von 8
      Dashboard-Karten; `_label` + `aria-label` doppeln sich auf denselben Karten (Screenreader-Risiko).
      → `/impeccable polish`
- [ ] **Logo-Dimensionen** — `<img src="/logo/logo.png">` ohne width/height (CLS im Header).
      → `/impeccable polish`
- [ ] **Font-Awesome-Subset** — `main.tsx:17-18` lädt fontawesome.min.css + Solid-Font komplett für
      ~10 Icons; KoliBri-sanctioniertes Muster, Subsetting/SVGs würden Gewicht sparen.
      → `/impeccable optimize`

## Messwerte (Audit, berechnet aus `app.css`)

| Paar                       | Light                        | Dark    |
| -------------------------- | ---------------------------- | ------- |
| ink/bg                     | 17,21:1                      | 14,76:1 |
| muted/bg                   | 7,14:1                       | 7,90:1  |
| muted/surface-1            | 7,53:1                       | 6,93:1  |
| signal-ink/signal-wash     | 6,19:1                       | 8,35:1  |
| Badge info/danger auf weiß | 7,10 / 6,57:1                | —       |
| Badge warning auf weiß     | **3,84:1** (⚠, Schwarz ≈5,5) | —       |

Score-Verlauf: Audit **16/20** (A11y 3 · Perf 3 · Responsive 4 · Theming 3 · Integrity 3),
Critique Dashboard **29/40**.

## Bewahren (Positive Findings)

- Token-Kern AA-**berechnet** in beiden Themes (Tabelle oben), nicht nur behauptet.
- Reduced-Motion dreifach abgesichert: globales CSS, `confetti.ts`, Herz-Hooks (OS-Präferenz gewinnt).
- WebGL-Disziplin im Herz: Loop nur bei Sichtbarkeit (IntersectionObserver), Stillstand bei Idle,
  Kontextverlust mit SVG-Fallback; kein `will-change`, Animationen nur transform/opacity.
- `--a11y-min-size` an `--pp-toolbar-height` gekoppelt, Sollbruchstelle dokumentiert (app.css:357).
- Landmarks vollständig (banner/main/contentinfo), Fokus-Fallback auf `<main>`.
- Detector über `src/components`: 0 Findings.
- Die Signalfarbe gehört allein der „Nächsten Aufgabe" — Farbdisziplin laut
  [.ai-knowledge/ux-design.md](../.ai-knowledge/ux-design.md) konsequent durchgehalten.

## Infrastruktur-Hinweis

`/impeccable critique` läuft derzeit **degraded** (einzelner Kontext): Die Standalone-pi-Binary
kann keine Subagent-Child-Sessions starten — dafür muss pi als npm-Paket
(`@earendil-works/pi-coding-agent` mit `pi-server`-Abhängigkeiten) installiert sein. Vor der
nächsten Critique-Wiederholung fixieren, dann vergleichen sich Dual-Agent-Scores sauber.
