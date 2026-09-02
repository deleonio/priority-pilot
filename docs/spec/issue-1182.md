# Spec #1182 — Konfetti auch über den Dashboard-Pfad (Signal-Panel → CompleteTaskDialog)

Status: rot spezifiziert (Spec-Phase, rote Tests als ausführbarer Vertrag).
Quellen: Issue #1182, KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-02T23:28:00Z).

## Ziel

Das in #1169 eingeführte Konfetti-Overlay (`data-testid="confetti-overlay"`,
`frontend/src/lib/confetti.ts`) feuert auch beim zweiten Erledigt-Pfad: Bestätigt man eine
offene Aufgabe über das Dashboard-Signal-Panel („Nächste Aufgabe", Button „Erledigt" →
Bestätigungsdialog „Aufgabe erledigen" → „Als erledigt markieren"), erscheint genau ein
Konfetti-Overlay — dieselbe Regel wie beim Umschalter in der Aufgabenliste.

## Vertragspunkt

- Der fehlende Aufrufort ist `completeTask` (`frontend/src/App.tsx`, Callback hinter
  `openComplete`): nach erfolgreichem `api.updateTask` auf `Done` wird
  `shouldCelebrateDone(task.status, TaskStatus.Done)` geprüft und im positiven Fall
  `launchConfetti()` aufgerufen — identisch zum Muster `handleDoneToggle`
  (App.tsx:403-405, #1169).
- `prefers-reduced-motion` bleibt allein in `launchConfetti` geprüft (confetti.ts) — der
  Dashboard-Pfad braucht keinen eigenen Check.
- Der Aufgabenliste-Pfad (#1169) und die Dialog-Reihenfolge (`await onConfirm` →
  `onCompleted`) bleiben unberührt.

## Akzeptanzkriterien & Abläufe

### AK1 — Konfetti über den Dashboard-Pfad

- Voraussetzung: offene Aufgabe als „Nächste Aufgabe" im Dashboard-Signal-Panel
  (höchste Priorität, unblockiert).
- Ablauf: Button „Erledigt" → Dialog „Aufgabe erledigen" → „Als erledigt markieren".
- Erwartetes Ergebnis: Genau ein Konfetti-Overlay (`data-testid="confetti-overlay"`)
  ist sichtbar.

### AK2 — Wieder-Öffnen ohne Effekt (Regressionsschutz)

- Bereits vollständig abgedeckt durch `frontend/e2e/issue-1169-confetti.spec.ts` AK3
  (Wieder-Öffnen über den Umschalter löst kein neues Overlay aus). Das Dashboard hat
  keinen Reopen-Pfad; eine neue Testdatei würde den bestehenden Test duplizieren
  (Dedup-Regel der Spec-Phase). Der bestehende Test bleibt unverändert grün.

### AK3 — `prefers-reduced-motion: reduce`

- Ablauf: `page.emulateMedia({ reducedMotion: 'reduce' })`, dann AK1-Ablauf.
- Erwartetes Ergebnis: Statuswechsel auf `Done` funktioniert, es wird kein
  Konfetti-Overlay erzeugt (JS-Abfrage in `launchConfetti`, s. Spec #1169 AK6).

### AK4 — Mobil (375×667) vollständig sichtbar

- Ablauf: AK1-Ablauf bei Viewport 375×667.
- Erwartetes Ergebnis: Overlay erscheint und bleibt vollständig im Viewport
  (kein horizontaler Überlauf; Bounding-Box-Prüfung, da die App-Shell mit
  `overflow-x: hidden` clippt und `scrollWidth` nichts aussagt).

## Test-Abdeckung

| AK  | Test                                                                         |
| --- | ---------------------------------------------------------------------------- |
| AK1 | `frontend/e2e/issue-1182-dashboard-confetti.spec.ts` (Overlay sichtbar, 1×)  |
| AK2 | `frontend/e2e/issue-1169-confetti.spec.ts` AK3 (bestehend, Dedup)            |
| AK3 | `frontend/e2e/issue-1182-dashboard-confetti.spec.ts` (`emulateMedia`)        |
| AK4 | `frontend/e2e/issue-1182-dashboard-confetti.spec.ts` (375×667, Bounding-Box) |

## Abgrenzungen

- Kein Konfetti beim Wieder-Öffnen (Done→Open) und bei gleichem Status — Regel bleibt
  zentral in `shouldCelebrateDone`.
- Sticky-Verhalten (`DONE_REMOVAL_DELAY_MS`) greift bewusst nicht für den
  Dashboard-Pfad (Kommentar in App.tsx, #1168) — unverändert.
- Selbst-Abbau/Teardown des Overlays ist in #1169 (AK2 dort) vertraglich gesichert
  und wird hier nicht erneut geprüft.
