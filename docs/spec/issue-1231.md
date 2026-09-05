# Session abgelaufen: Dialog zum Neuladen der App anbieten

**Stand:** 2026-09-05 · **Issue:** #1231 (AK1–AK5 aus dem KI-ANALYSE-Block)

## Ziel

Läuft die Session im Hintergrund ab, erscheint bei der nächsten fehlschlagenden API-Aktion **zusätzlich** zur bestehenden Fehlermeldung ein globaler Dialog „Session abgelaufen" mit Reload-Angebot. Nach Bestätigung lädt die App neu, der stille Google-Login meldet erneut an, und der Nutzer landet auf derselben Route wie zuvor.

## Ereignis-Vertrag (Frontend, `frontend/src/lib/apiError.ts`)

Erkennt `toApiError` einen Session-401 (Server-Message „Nicht eingeloggt." / „Ungültige Zugangsdaten." **oder** 401 ohne lesbaren Body — genau die Fälle, die auf `SESSION_TEXT` mappen, #948), feuert es **genau ein** DOM-Event auf `window`:

- Name (Vertrag, konstant): `pp:session-expired`
- Empfohlene Umsetzung: exportierte Konstante `SESSION_EXPIRED_EVENT = 'pp:session-expired'`

| Fehlerlage                                              | Event                          |
| ------------------------------------------------------- | ------------------------------ |
| 401 + Session-Message (lesbarer Body)                   | feuert 1×                      |
| 401 ohne lesbaren Body (Session-Fallback #948)          | feuert 1×                      |
| 401 mit fremder Message (LLM/Proxy, „Invalid API key")  | feuert **nicht**               |
| 403 / CSRF / Netzwerkfehler / andere Statuscodes        | feuert **nicht**               |

## Dialog-Vertrag (Frontend, neu `frontend/src/components/SessionExpiredDialog.tsx`)

Global montiert in `App.tsx` neben `InstallPrompt`/`UpdatePrompt` (`App.tsx:954`). Lauscht auf `pp:session-expired`:

- Ohne Event: rendert nichts.
- Event: öffnet **genau einen** Dialog (Wiederverwendung `Modal.tsx`/KolDialog: Fokus-Falle, Escape, Backdrop = Abbrechen). Weitere Events, solange der Dialog offen ist, werden ignoriert (Dedup — parallele 401s stapeln nicht).
- Nach „Abbrechen" ist der Zustand zurückgesetzt; das nächste Session-401-Event öffnet erneut.
- Dialogtitel: „Session abgelaufen". Text benennt den Datenverlust (KI-UX-Entscheidung 1): Hinweis, dass ungespeicherte Änderungen beim Neuladen verloren gehen.
- Buttons (KI-UX-Entscheidung 2: Modal-in-Modal — der Session-Dialog läuft als eigene Ebene **auf** einem ggf. offenen Fach-Dialog; der darunterliegende Dialog bleibt unangetastet):
  - „Neu laden" (primär), native Klick-Naht `data-testid="session-reload"` (UpdatePrompt-Muster) → **genau ein** `window.location.reload()`.
  - „Abbrechen" (sekundär), `data-testid="session-cancel"` → schließt den Dialog ohne Reload.
- Kein Auto-Reload, kein Timeout.

## Silent-Login-Retry & Return-Path (AK3/AK4)

- `Root.tsx`: Bei **erfolgreichem** `checkAuth()` wird `sessionStorage['pp_silent_attempted']` entfernt (analog dem bestehenden `pp_just_logged_out`-Reset). Damit kann ein späterer Ablauf nach Reload erneut still anmeldeversuchen — die Loop-Guards (`?silent=unavailable`, `?error=…`, `pp_just_logged_out`) bleiben unverändert wirksam.
- `Root.tsx`: Der Silent-Redirect `window.location.href = '/auth/google/silent'` wird um den aktuellen Pfad erweitert: `?returnTo=` + `encodeURIComponent(pathname + search)`.
- Server (`server/src/express/routes/auth.ts` + neue reine Logik `server/src/logics/silentReturnPath.ts`):

`sanitizeReturnPath(raw: unknown): string | null`

| Eingabe                      | Ausgabe             |
| ---------------------------- | ------------------- |
| `undefined`, `''`, Non-String| `null`              |
| `/aufgaben`                  | `/aufgaben`         |
| `/settings/general`          | `/settings/general` |
| `/tasks?view=done&x=1`       | unverändert         |
| `aufgaben` (ohne `/`)        | `null`              |
| `https://evil.example`       | `null`              |
| `//evil.example`             | `null`              |
| `/\evil.example` (Backslash) | `null`              |

- `GET /auth/google/silent?returnTo=X`: `X` wird sanitisiert in der Session (`silentReturnTo`) abgelegt; ungültig/fehlend → kein Return-Path.
- Erfolgs-Callback: Redirect auf `sanitizeReturnPath(session.silentReturnTo) ?? '/'` (statt fix `/`).
- Interaktionsfehler/Failure: weiterhin `/?silent=unavailable` bzw. `/?error=…` (unverändert, #396/#1136).

## Erwartetes Ergebnis (Journey)

Session läuft ab → Nutzer löst Aktion aus (z. B. KI-Verarbeitung im Schnell-Dialog) → KolAlert mit Session-Meldung **plus** Dialog „Session abgelaufen" → Klick „Neu laden" → Reload → `/auth/me` 401 → stiller Login mit `?returnTo=<aktuelle Route>` → Erfolg → Landung auf derselben Route. Scheitert der stille Login, bleibt der bestehende `?silent=unavailable`-Pfad mit LoginPage.

## Test-Pflege-Bedarf / bewusste Lücken

- Der Erfolgs-Callback-Redirect ist HTTP-seitig nicht erreichbar (echter Google-Token-Austausch); der Server-Vertrag ist deshalb als reine Logik (`silentReturnPath.ts`) eingeklagt, die Frontend-Hälfte von AK4 in der E2E (Silent-Request-URL enthält `returnTo`).
