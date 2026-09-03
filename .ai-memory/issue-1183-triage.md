# Issue 1183 — Triage (Phase 1), Stand 2026-09-02T23:28:48Z

**ERGEBNIS: VERDICT analyzed, Ampel 🟢.** Initial-Triage (kein Harness-Kommentar; einziger Kommentar = github-actions-Qualitätscheck 2026-09-02T23:16:56Z, keine Entscheidung). Harness-Kommentar erstellt (final: issuecomment-5517934815, nach 1169-E2E-Ergänzung neu angelegt; erster Versuch 5517914858 gelöscht) mit KI-ANALYSE + Routing-Tabelle, Labels: `ai:needs-analyse` entfernt, `ai:analysed` + `ai:needs-spec` gesetzt (verifiziert). Kein Ping, kein Titel-/Body-Edit (Titel „Animationen zentral in den Einstellungen schaltbar (Konfetti-Default: aus)" — treffend), kein Split (ein Frontend-PR), kein Auto-Close (`pp-animations-enabled`/`animationsEnabled` existiert nicht in frontend/src, grep leer).

## Erledigt
- Issue geladen (`.ai-memory/issue-1183-input.json`), Trigger = Initial-Triage bestimmt.
- Code-Recherche via recherche-Subagent: confetti.ts, SettingsPage-Tabs, localStorage-Muster, reduced-motion, Testlandschaft, docs/spec-Konvention.
- Harness-Kommentar als Create (HID leer) via `gh issue comment --body-file .ai-memory/issue-1183-harness.md`.

## Relevante Stellen
- `frontend/src/lib/confetti.ts:74` — `launchConfetti(): boolean`, baut Canvas-Overlay `data-testid="confetti-overlay"` (:80); hier kommt das Animationen-Gate rein.
- `frontend/src/lib/confetti.ts:19,75-77` — `REDUCED_MOTION_QUERY`-Frühcheck in `launchConfetti` (return false) — bleibt, AK4.
- `frontend/src/App.tsx:403-404` — Aufrufer in `handleDoneToggle` (`shouldCelebrateDone` → `launchConfetti()`); bleibt unverändert, Gate in launchConfetti selbst.
- `frontend/src/lib/voiceAutostart.ts:13,19-54` — VORBILD für neues `frontend/src/lib/animations.ts`: localStorage-Key, read/store + Hook; Switch in SettingsPage.tsx:101.
- `frontend/src/components/SettingsPage.tsx:32-37,235-242` — `SETTINGS_TABS`, „Allgemein" = Index 0 / `slot="tab-0"`; dort der neue Schalter.
- Tests: `frontend/src/lib/confetti.test.ts` (AK6-reduce-Matrix erweitern), `frontend/src/components/SettingsPage.test.tsx` (tab-0-Reihenfolge-Test nicht brechen), neu `frontend/e2e/issue-1183-animations.spec.ts` (Muster `voice-autostart.spec.ts`).

## Annahmen
- Speicherung pro GERÄT via localStorage (Issue-Wortlaut „Geräte ohne gespeicherte Wahl", „neues Profil", „keine Migration") — nicht serverseitig, obwohl Geo-Config-Präzedenz (#1098) serverseitig ist; im Analyse-Block als Randbedingung verankert.
- Default aus = Key absent → false (natürlich, keine Migration nötig).
- UX-Lauf übersprungen (ux=nein): UI vom Issue vollständig vorgegeben, Standard-Switch nach Voice-Autostart-Muster — Begründung im Analyse-Block.
- Master-Schalter-Helper generisch (`animations.ts`), Konfetti = erster Konsument — Issue will künftige Animationen am selben Schalter.

## Verworfen
- UX-Phase — kein offener UX-Aspekt (Label, Ort, Semantik, Default alle vom Autor vorgegeben).
- Serverseitige Speicherung — Issue textet ausdrücklich gerätebezogen; would contradict Autor.
- Titeländerung/Split — nicht veranlasst.

## Offen
- `.ai-memory/issue-1183-input.json` + `.ai-memory/issue-1183-harness.md` sind Wegwerf-Artefakte — NICHT committen; nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase (Label `ai:needs-spec` gesetzt): rote Tests für AK1–AK5 — `animations.test.ts` (neu), `confetti.test.ts`-Erweiterung, `SettingsPage.test.tsx`-Erweiterung, E2E-Entwurf `issue-1183-animations.spec.ts`.

## Fallstricke
- CompleteTaskDialog-Pfad bleibt bewusst OHNE Konfetti (docs/spec/issue-1169.md:88) — nicht „vereinfachen".
- `data-testid="confetti-overlay"` ist der einzige Koppel-Punkt (issue-1169.md:92) — Tests nur darauf matchen.
- SettingsPage.test.tsx:306 (tab-0-Reihenfolge Darstellung/Voice/Push) — neuen Switch so einfügen, dass der Test erweitert, nicht gebrochen wird.
- jsdom: localStorage im Vitest verfügbar, aber Key-Vorbelegung pro Test zurücksetzen; matchMedia muss gestubbt bleiben (confetti.test.ts:16-22 Muster).
- E2E issue-1169-confetti.spec.ts AK-Verhalten muss grün bleiben: dessen Tests laufen ohne pp-animations-enabled-Key → Default aus = KEIN Overlay → alte E2E-Konfetti-Assertions (AK1/AK2/AK5) brechen, wenn impl nicht den Key in diesen Specs setzt! Spec-Phase muss anpassen (Setup: Key auf 'true' setzen oder Specs migrieren). Steht jetzt auch in Randbedingungen des Analyse-Blocks.
- Kommentar-Update: `gh api graphql -f query='mutation(...)'` wird von der Sandbox-Staticanalyse blockiert („Brace expansion"), `-f query=@datei` schickt das @ literal — Workaround dieses Laufs: REST-DELETE des Kommentars (`gh api -X DELETE repos/<repo>/issues/comments/<rest-id>`) + Neuanlage via `gh issue comment --body-file`. Nur anwenden, wenn der Kommentar eh frisch von mir stammt.
