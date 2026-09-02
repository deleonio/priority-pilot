# Spec #1169 — Konfetti beim Erledigungs-Switch („Erledigt"-Toggle)

Status: rot spezifiziert (Spec-Phase, rote Tests als ausführbarer Vertrag).
Quellen: Issue #1169, KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-02T19:33:06Z),
KI-UX-Block (derselbe Kommentar).

## Ziel

Klick auf „Erledigt" (Offen→Erledigt) im TaskTree-„…"-Popover startet genau einen
Konfetti-Regen über den gesamten Viewport — selbst-beendend, nicht-blockierend und
respektierend `prefers-reduced-motion`. Beide Stellen (Dashboard-Liste und Aufgaben-Route)
laufen durch den gemeinsamen Choke-Point `handleDoneToggle` (`frontend/src/App.tsx:382`,
Richtungs-Flag `markingDone` :385) und sind damit automatisch abgedeckt.

## Modul-Vertrag `frontend/src/lib/confetti.ts` (neu)

- `shouldCelebrateDone(from: TaskStatus, to: TaskStatus): boolean` — reine Richtungsentcheidung,
  unabhängig von `matchMedia`: `true` nur für Übergänge **auf** `Done` von einem nicht-Done-Status
  (`Open→Done` → `true`; `Done→Open`, `Done→Done`, `Open→InProcess` → `false`).
- `launchConfetti(): boolean` — erzeugt ein fixed Full-Viewport-Overlay
  (`data-testid="confetti-overlay"`) und startet die Partikel-Animation.
  - `aria-hidden="true"` (rein dekorativ, KI-UX A11y) und `pointer-events: none`
    (Bedienung bleibt möglich, Vorbild `app.css:1765-1781`).
  - Läuft `matchMedia('(prefers-reduced-motion: reduce)')`, wird **nichts** erzeugt und
    `false` zurückgegeben (die globale CSS-Regel `app.css:187` stoppt keine rAF-Animation —
    deshalb JS-Abfrage, KI-UX A11y). Sonst `true`.
  - Teardown per Timeout spätestens nach 6 000 ms: Das Overlay-Element wird aus dem DOM
    entfernt (keine DOM-/Canvas-Reste, AK2-Toleranzfenster 4–6 s).

## Akzeptanzkriterien & Abläufe

### AK1 — Konfetti über den gesamten Viewport

- Voraussetzung: offene Aufgabe in der Aufgaben-Liste, „…"-Popover geöffnet.
- Ablauf: Klick auf „Erledigt".
- Erwartetes Ergebnis: Ein Konfetti-Overlay (`data-testid="confetti-overlay"`) ist sichtbar
  und bedeckt den Viewport vollständig (Position 0/0, Breite/Höhe ≥ Viewport).

### AK2 — selbst-beendend, ohne Reste

- Ablauf: wie AK1, danach keine Nutzer-Interaktion.
- Erwartetes Ergebnis: Das Overlay verschwindet von selbst innerhalb von 4–6 s und ist danach
  **vom DOM entfernt** (nicht nur unsichtbar).

### AK3 — Wieder-Öffnen ohne Effekt

- Voraussetzung: erledigte Aufgabe (per API auf `Done` gesetzt, damit kein Konfetti vorab läuft).
- Ablauf: Klick auf „Wieder öffnen" im Popover.
- Erwartetes Ergebnis: Status wechselt auf `Open`, es erscheint kein Konfetti-Overlay.
- Einheitlich (Unit): `shouldCelebrateDone` liefert für `Done→Open` (und jede nicht-auf-Done
  gerichtete Änderung) `false` — `matchMedia`-unabhängig.

### AK4 — Mobil (375px) ohne Ruckeln

- Ablauf: wie AK1 bei Viewport 375×667.
- Erwartetes Ergebnis: Effekt läuft durch, die UI bleibt bedienbar.
- Ruckel-Freiheit ist architektonisch gesichert (rAF + feste, moderate Partikelzahl ~120,
  Canvas auf Viewportgröße — keine layout-aufwändigen DOM-Partikelmassen); eine objektive
  Frame-Metrik ist in der CI-Umgebung nicht zuverlässig messbar (Begründung im Test).

### AK5 — keine Blockierung der Bedienung

- Ablauf: Konfetti läuft (AK1-Klick), danach wird das „…"-Popover einer anderen Aufgabe
  geöffnet und deren Toggle betätigt.
- Erwartetes Ergebnis: Popover öffnet, Klick geht durch, PATCH persistiert
  (`pointer-events: none` auf dem Overlay).

### AK6 — `prefers-reduced-motion: reduce`

- Ablauf: `page.emulateMedia({ reducedMotion: 'reduce' })`, dann AK1-Klick.
- Erwartetes Ergebnis: Statuswechsel funktioniert, es wird kein Konfetti-Overlay erzeugt.
- Einheitlich (Unit): `launchConfetti()` gibt bei reduce `false` zurück und hängt kein
  Overlay-Element ins DOM.

## Test-Abdeckung

| AK  | Test                                                                                               |
| --- | -------------------------------------------------------------------------------------------------- |
| AK1 | `frontend/e2e/issue-1169-confetti.spec.ts` (Full-Viewport-Box)                                     |
| AK2 | e2e (Verschwinden ≤ 6 s + DOM-Entfernung) + `frontend/src/lib/confetti.test.ts` (Timeout-Teardown) |
| AK3 | e2e (Wieder-Öffnen ohne Overlay) + Unit (`shouldCelebrateDone`-Richtung)                           |
| AK4 | e2e (375×667, eigener Testfall, Architektur-Kommentar)                                             |
| AK5 | e2e (Klick auf zweite Aufgabe während der Animation) + Unit (`pointer-events: none`)               |
| AK6 | e2e (`emulateMedia`) + Unit (reduce → `false`, kein Overlay)                                       |

## Abgrenzungen

- Signal-Panel/CompleteTaskDialog-Pfad (`completeTask`, `App.tsx:431`) löst **kein** Konfetti aus
  (Issue nennt nur die „…"-Popover-Stellen).
- Sticky-Entfernung der Zeile nach `DONE_REMOVAL_DELAY_MS = 5000` (`App.tsx:66`) bleibt unberührt.
- Technik (Canvas vs. DOM, Eigenbau vs. Bibliothek) ist Umsetzungsentscheidung; die Tests prüfen
  nur den Overlay-Vertrag (`data-testid="confetti-overlay"`), nicht die Render-Technik.
