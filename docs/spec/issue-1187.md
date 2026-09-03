# Issue 1187 — OS-Einstellung „Bewegung reduzieren" in den Einstellungen transparent machen

Spezifikation (Stufe 1 TDD, rote Tests): `docs/spec/issue-1187.md`.
Basis: Issue #1187 + KI-ANALYSE-Block (Harness-Kommentar, stand 2026-09-03T01:02:30Z).
Voraussetzung #1183 (Master-Schalter „Animationen") ist gemergt (PR #1188, Commit aa5adf64).

## Ziel

Ist auf Betriebssystem-Ebene „Bewegung reduzieren" (`prefers-reduced-motion: reduce`) aktiv,
macht die App das im Tab „Allgemein" der Einstellungen durch eine Info-Meldung transparent
(Stil wie die bestehenden `KolAlert _type="info"`-Banner, z. B. „Push-Nachrichten nicht
verfügbar", `SettingsPage.tsx:308`). Die Meldung reagiert live auf Systemwechsel, ohne
Neuladen. Der Master-Schalter „Animationen" aus #1183 bleibt dabei vollständig unberührt:
Er zeigt weiterhin den gespeicherten Gerätewert (`pp-animations-enabled`) und bleibt
bedienbar — die Systemeinstellung hat Vorrang, sie deaktiviert den Schalter nicht.

## Voraussetzungen

- Neues Modul `frontend/src/lib/reducedMotion.ts` nach dem Listener-Muster von
  `frontend/src/lib/theme.ts:92-103`: Hook `usePrefersReducedMotion(): boolean` — liest
  initial `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, abonniert
  `change` am MediaQueryList und übernimmt Wechsel in den State (inkl. Cleanup beim
  Unmount). jsdom liefert dazu keine Präferenz → Stub-Muster `confetti.test.ts:17-31`.
- Konfetti bleibt über den bestehenden Frühcheck in `launchConfetti`
  (`frontend/src/lib/confetti.ts:78`) unterdrückt — er prüft `matchMedia` bei jedem Aufruf
  und ist damit ohne Neuladen live wirksam (deckt #1187 AK3/AK5 auf Konfetti-Seite ab).
- Die CSS-Klemme `frontend/src/app.css:187-192` (Motion-Token auf 1 ms) und der Schalter
  aus #1183 (`animations.ts`, localStorage `pp-animations-enabled`, Default aus) bleiben
  unverändert.

## Akzeptanzkriterien

### AK1 — Info-Meldung nur bei aktiver Systemeinstellung

- Ablauf: Tab „Allgemein" (`slot="tab-0"`) öffnen — einmal mit, einmal ohne
  `prefers-reduced-motion: reduce`.
- Erwartetes Ergebnis: Mit reduce erscheint im Panel „Allgemein" eine `KolAlert`-Info-
  Meldung (`_type="info"`), deren Label/Text „Bewegung reduzieren" thematisiert. Ohne die
  Systemeinstellung erscheint sie nicht.

### AK2 — Live-Reaktion auf Systemwechsel

- Ablauf: App (bzw. Hook) ist geöffnet, die Systemeinstellung wird gewechselt —
  ohne Neuladen.
- Erwartetes Ergebnis: Der Hook-Zustand flippt mit dem `change`-Event; die Info-Meldung
  blendet sich ein bzw. aus. Der Listener wird beim Unmount abgemeldet.

### AK3 — Reduce unterdrückt Konfetti app-weit, auch mit Schalter an

- Ablauf: Schalter „Animationen" an (Key `true`) UND reduce aktiv; Task auf Erledigt
  stellen.
- Erwartetes Ergebnis: Kein `confetti-overlay`. Bereits erschlagend getestet — Unit:
  `frontend/src/lib/confetti.test.ts:120` („AK4: Key true + reduced-motion → kein Overlay",
  aus #1183); E2E: `frontend/e2e/issue-1169-confetti.spec.ts` AK6 (`emulateMedia` reduce
  und beforeEach-Key `true` → kein Overlay). Keine neuen Tests (Dedup), kein Widerspruch.

### AK4 — Schalter zeigt weiterhin den Gerätewert und bleibt bedienbar

- Ablauf: Reduce aktiv, gespeicherter Key `true`; Schalter umschalten.
- Erwartetes Ergebnis: Der Schalter „Animationen" zeigt den gespeicherten Wert, trägt
  kein `_disabled` (das Banner deaktiviert ihn nicht) und ein Toggle schreibt weiterhin
  `pp-animations-enabled`.
- Addendum: Update 2026-09-03, PR #1201 — AK4 ersetzt: Der Schalter zeigt weiterhin den
  gespeicherten Wert, ist aber bei aktivem reduce deaktiviert (`_disabled`); ohne reduce
  bleibt er unverändert bedienbar und ein Toggle schreibt `pp-animations-enabled`.

### AK5 — Systemwechsel bei offener App: nächste Erledigt-Fete bleibt aus

- Ablauf: App laden (ohne reduce, Schalter an), dann reduce NACH dem App-Load aktivieren
  (kein `page.reload()`), Task auf Erledigt stellen.
- Erwartetes Ergebnis: Kein `confetti-overlay` — der Frühcheck wirkt live, Statuswechsel
  auf `Done` funktioniert trotzdem.

### AK6 — Mobil (375 px) sichtbar und lesbar

- Ablauf: Viewport 375 px, Tab „Allgemein" öffnen, reduce aktiv.
- Erwartetes Ergebnis: Die Info-Meldung ist im Panel sichtbar (nicht geclippt:
  Bounding-Box innerhalb des Viewports).

## Test-Abdeckung

| AK  | Test                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | `frontend/src/components/SettingsPage.test.tsx` (#1187-Block) + E2E `frontend/e2e/issue-1187-reduced-motion.spec.ts` (Banner bei reduce) |
| AK2 | `frontend/src/lib/reducedMotion.test.ts` (Hook: Initial/Flip/Cleanup) + E2E (emulateMedia-Wechsel bei offener App, ohne Reload)          |
| AK3 | bereits gedeckt durch `confetti.test.ts:120` + `issue-1169-confetti.spec.ts` AK6 (Dedup, s. o.)                                          |
| AK4 | `frontend/src/components/SettingsPage.test.tsx` (#1187-Block: Wert-Anzeige + Toggle + nicht deaktiviert)                                 |
| AK5 | E2E `frontend/e2e/issue-1187-reduced-motion.spec.ts` (emulateMedia NACH App-Load, kein Reload)                                           |
| AK6 | E2E `frontend/e2e/issue-1187-reduced-motion.spec.ts` (Viewport 375 px, Banner sichtbar)                                                  |

## Abgrenzungen

- `data-testid="confetti-overlay"` bleibt einziger Koppel-Punkt zu #1169/#1183.
- Das Banner ist rein informierend — es triggert keine Migration des Schalters und keine
  Server-Anbindung („Datenbank" im Issue-Text meint den gerätelokalen Key aus #1183,
  KI-ANALYSE-Begründung).
- Aussehen/Wortlaut des Banners ist weitgehend freigegeben; verbindlich sind nur
  `_type="info"`, Platzierung im Panel „Allgemein" und das Thema „Bewegung reduzieren"
  im zugänglichen Text.
