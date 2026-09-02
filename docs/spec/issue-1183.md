# Issue 1183 — Animationen zentral in den Einstellungen schaltbar (Konfetti-Default: aus)

Spezifikation (Stufe 1 TDD, rote Tests): `docs/spec/issue-1183.md`.
Basis: Issue #1183 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-02T23:28:48Z).

## Ziel

Ein Master-Schalter „Animationen" im Tab „Allgemein" der Einstellungen steuert zentral alle
dekorativen Animationen der App. Erster und bisher einziger Konsument ist das Konfetti aus
#1169 (`frontend/src/lib/confetti.ts`). Speicherung erfolgt pro Gerät über `localStorage`
(Schlüssel `pp-animations-enabled`); **ohne gespeicherten Key gilt aus (Default: aus)** —
eine Migration alter Geräte findet bewusst nicht statt.

## Voraussetzungen

- Neues Setting-Modul `frontend/src/lib/animations.ts` nach dem Muster
  `frontend/src/lib/voiceAutostart.ts`: reine `readAnimationsEnabled()` /
  `storeAnimationsEnabled()`-Funktionen (Best-Effort, geworfener `localStorage`-Zugriff gilt
  als aus) plus Hook `useAnimationsEnabled()` für die SettingsPage.
- Das Gate sitzt in `launchConfetti()` selbst (`confetti.ts`); der Aufrufer
  `App.tsx handleDoneToggle` bleibt unverändert.
- Der bestehende `prefers-reduced-motion`-Frühcheck in `launchConfetti` bleibt unabhängig
  vom Schalterzustand wirksam.

## Akzeptanzkriterien

### AK1 — Schalter „Animationen" mit Reload-Persistenz

- Ablauf: Tab „Allgemein" öffnen, Schalter „Animationen" umschalten, Seite neu laden.
- Erwartetes Ergebnis: Der Schalter existiert im Panel „Allgemein" (`slot="tab-0"`); er zeigt
  nach dem Neuladen den zuletzt gespeicherten Zustand (localStorage `pp-animations-enabled`).

### AK2 — Konfetti nur bei eingeschaltetem Schalter

- Ablauf: Task über den Erledigt-Umschalter des „…"-Popovers auf „Erledigt" stellen — einmal
  mit Schalter aus (bzw. ohne Key), einmal mit Schalter an.
- Erwartetes Ergebnis: Aus → kein `confetti-overlay`; an → Overlay wie bisher
  (#1169-Verhalten unverändert, inkl. Selbst-Abbau und Bedienbarkeit).

### AK3 — Default aus

- Ablauf: Frischer Kontext ohne gespeicherten Key (neues Gerät/Profil).
- Erwartetes Ergebnis: Der Schalter ist aus; `readAnimationsEnabled()` liefert `false`;
  es erscheint kein Konfetti.

### AK4 — reduced-motion bleibt unabhängig wirksam

- Ablauf: Schalter an (Key `true`) UND System-`prefers-reduced-motion: reduce`.
- Erwartetes Ergebnis: `launchConfetti()` liefert `false`, kein Overlay — der
  reduced-motion-Frühcheck hat Vorrang vor dem Schalter.

### AK5 — Mobil (375 px) sichtbar und bedienbar

- Ablauf: Viewport 375×667, Tab „Allgemein" öffnen.
- Erwartetes Ergebnis: Der Schalter ist sichtbar und lässt sich umschalten.

## Test-Abdeckung

| AK  | Test                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ |
| AK1 | `frontend/src/components/SettingsPage.test.tsx` (#1183-Block: Rendering + Key-Sync) + E2E Reload |
| AK2 | `frontend/src/lib/confetti.test.ts` (#1183-Block: Key aus/an) + E2E Toggle+Erledigt              |
| AK3 | `frontend/src/lib/animations.test.ts` (Key absent → false) + E2E frischer Kontext                |
| AK4 | `frontend/src/lib/confetti.test.ts` (Key `true` + reduce → kein Overlay)                         |
| AK5 | E2E `frontend/e2e/issue-1183-animations.spec.ts` (Viewport 375×667)                              |

## Abgrenzungen

- `data-testid="confetti-overlay"` bleibt einziger Koppel-Punkt zu #1169 (issue-1169.md:92).
- Der CompleteTaskDialog-Pfad bleibt bewusst ohne Konfetti (issue-1169.md:88).
- Der Schalter ist bewusst generisch („Animationen"), Konfetti ist nur der erste Konsument.
- Server-Settings (Geo-Config) bleiben unberührt; Speicherung ausschließlich gerätelokal.

## Test-Pflege (bestehende Tests)

- `frontend/src/lib/confetti.test.ts`: Die #1169-Tests setzen jetzt `pp-animations-enabled`
  vor jedem Test auf `true` — sie testen das Konfetti-Verhalten unter eingeschaltetem
  Master-Schalter (ohne das Gate würden sie mit dem neuen Default brechen).
- `frontend/e2e/issue-1169-confetti.spec.ts`: analog `test.beforeEach` mit Init-Script, das
  den Key setzt. AK6 (reduce) bleibt ohne Ausnahme — reduce gilt auch bei angeschaltetem
  Schalter (hier AK4).
