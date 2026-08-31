# Issue 1136 — Triage (Re-Triage nach needs-human), Stand 2026-08-31T02:45Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Menschliche Entscheidung eingetroffen (deleonio 2026-08-31T02:41:11Z: „Mach bitte 1, O1") → Scope = **O1 Bugfix** bindend. Analyse-Block + Routing-Tabelle als neuer Harness-Kommentar erstellt (https://github.com/deleonio/priority-pilot/issues/1136#issuecomment-5473060220, HID war leer → create via `gh issue comment --body-file`). Labels `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (Endstand verifiziert; `ai:needs-human` war bereits vom Menschen entfernt). Kein Ping-Kommentar, kein Titel-/Body-Edit, kein Auto-Close.

## Erledigt
- Trigger: kein `<!-- ai-harness -->`-Kommentar, aber `<!-- ai-triage-decision -->` (2026-08-31T02:37:51Z) + Antworten danach → Re-Triage-nach-needs-human-Pfad; Entscheidungs-Kommentar + alle danach gelesen (genau 1 Antwort).
- Entscheidung interpretiert: „1, O1" = Entscheidung 1, Option O1 (Bugfix). Entscheidung 2 (Säulen-Parität) NICHT beantwortet → nicht im O1-Scope, als separates Folge-Ticket dem Menschen vorbehalten (Präzedenz #1090: wörtliche Wahl bindend, nichts draufschrauben). Entscheidung 3 (Timeout-Semantik) = technische Empfehlung, in O1 eingebettet und nicht widersprochen → übernommen und in Randbedingungen verankert.
- Code-Behauptungen gegen AKTUELLES main re-verifiziert (main hatte sich seit Phase 1 weiterbewegt): `checkAuth()` weiterhin ohne Timeout (`frontend/src/lib/auth.ts:8-20`); `/auth/error` liefert weiterhin rohes JSON 400 (`server/src/express/routes/auth.ts:135-138`); **NEU seit Phase 1:** failureRedirect ist jetzt `silentPending ? '/?silent=unavailable' : '/auth/error'` (`auth.ts:179`, 2. Stelle `:192`) — nur der MANUELLE Login-Pfad trifft noch auf rohes JSON; Root-Fehler-Branch existiert (`Root.tsx:96`, `role="alert"` + „Bitte Seite neu laden").
- Harness-Kommentar erstellt via `.ai-memory/issue-1136-harness.md` (Write + `gh issue comment 1136 --body-file`), Landing verifiziert (marker=1, Routing-Tabelle am Ende, Labels korrekt).

## Relevante Stellen
- `frontend/src/lib/auth.ts:8-20` — `checkAuth()`: fetch ohne AbortSignal; hier kommt `AbortSignal.timeout(30000)` rein (AK1).
- `frontend/src/Root.tsx:52-88` — Auth-Gate: Spinner solange `authState==='loading' || silentPending`; `.catch` → error-State; `Root.tsx:96` Fehler-UI (role=alert) existiert bereits.
- `frontend/src/Root.tsx:24-31` — `shouldAttemptSilentLogin`: Guards auf `silent=unavailable` + `?error=` — dürfen nicht ausgehebelt werden (AK3).
- `server/src/express/routes/auth.ts:179,192` — failureRedirect/regenerate-Fehler: manuellen Pfad auf `/?error=<code>` umstellen, Silent-Pfad (`/?silent=unavailable`) unangetastet (AK2); `/auth/error`-Route (`:135-138`) als API-Fallback behalten (Tests referenzieren sie).
- `frontend/src/components/LoginPage.tsx:10-16,63-77` — ERROR_MESSAGES + `?error=`-Rendering existieren; nur Erreichbarkeit neu verdrahten.
- `server/src/express/routes/auth.ts` — `/auth/test-login` (NODE_ENV=test) als E2E-Präzedenz für Session-Erzeugung ohne echten Google-Zyklus (AK4).
- `frontend/e2e/login.spec.ts`, `silent-login.spec.ts` — AK2/AK3-Erweiterung bzw. Regression; neu `frontend/e2e/google-signup.spec.ts` (AK4).

## Annahmen
- „Mach bitte 1, O1" deckt NUR Entscheidung 1 ab; 2 und 3 gelten als nicht blockend: 2 ist out-of-scope per O1-Wortlaut, 3 ist technische Notwendigkeit (Google-Top-Level-Navigation ist clientseitig nicht abbrechbar) und wurde im O1-Text der Entscheidung mit abgegeben.
- Root-error-Branch („Bitte Seite neu laden") genügt als manueller Retry für AK3 — ob ein echter Retry-Button dazukommt, ist Spec-Phase-Freiheit.
- Routing-Tabelle (ux nein/-/-, spec ja/sonnet/medium, impl ja/sonnet/high, review ja/sonnet/high) für Folgephasen bindend; Muster wie #1083/#1095.

## Verworfen
- O2 (Profil-Erstellungs-Flow) und SÄULEN-PARITÄT im Ticket-Umfang — Mensch hat nur O1 gewählt; beides wäre Scope-Verletzung (Säulen-Folgeticket im Analyse-Block dem Menschen vorbehalten).
- Erneute needs-human-Runde wegen unbenannter Entscheidungen 2/3 — 2 ist per O1-Wortlaut out-of-scope, 3 technische Semantik; keine Produktfrage mehr offen.
- UX-Lauf — Fehler-UI existiert und bleibt unverändert, Änderung ist Verdrahtung/Verhalten (Begründung im Analyse-Block).
- Titel-/Body-Änderung — Titel „Profile-Erstellung hängt nach Google-Authentifizierung" trifft auf O1 zu (der Hang ist das Thema); Body-Edit per ADR 0009 verboten.
- MEMORY.md-Eintrag — kein neuer Fehler/Experience-Kriterium erfüllt.

## Offen
- `.ai-memory/issue-1136-harness.md` ist Wegwerf-Artefakt (Kommentar-Quelle), NICHT committen; nur diese Datei ist die Phasen-Notiz. `rm` bräuchte Freigabe (Muster #1083/#1095).
- Säulen-Parität als Folge-Ticket bleibt dem Menschen vorbehalten (bewusst nicht selbst angelegt).

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK4 — AK1 Vitest `frontend/src/lib/auth.test.ts` (Fake-Timer, nie resolvendor fetch-Mock) + `Root.test.tsx`; AK2 API-Test `server/src/express/auth.test.ts` (failureRedirect `/?error=`); AK3 Regression `silent-login.spec.ts`; AK4 neu `frontend/e2e/google-signup.spec.ts` via `/auth/test-login`.

## Fallstricke
- FailureRedirect hat ZWEI Stellen (`auth.ts:179` UND `:192` im session.regenerate-Fehlerfall) — beide umstellen, sonst bleibt ein JSON-Pfad.
- `AbortSignal.timeout` + jsdom/Vitest: Fake-Timer allein steuern keinen echten Abort (native API) — Timeout-Logik ggf. so injizieren/parametrisieren, dass der Test den Abort deterministisch auslösen kann.
- `/auth/error`-Route nicht einfach löschen — Server-Tests/E2E referenzieren sie; als API-Fallback behalten oder alle Referenzen mitändern.
- Silent-Pfad (`/?silent=unavailable`) bewusst NICHT auf `?error=` umleiten — sonst brechen Loop-Guards/Silent-UX (#396).
- E2E ohne echten Google-Zyklus: `/auth/test-login` nur unter NODE_ENV=test verfügbar.
- `gh issue edit --body` bleibt verboten (ADR 0009) — alles läuft über den Harness-Kommentar (jetzt vorhanden: issuecomment-5473060220).
- Compound-Bash mit `$(...)`-Zuweisung + if wird vom statischen Sandbox-Parser abgelehnt → Schritte als einzelne simple Calls fahren (HID-Lookup und Comment-Create diesmal getrennt).
