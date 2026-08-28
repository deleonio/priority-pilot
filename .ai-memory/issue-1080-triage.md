# Issue 1080 — Triage-Notizen (abgeschlossen 2026-08-28)

## Erledigt
- Initiale Triage durchgeführt: KI-ANALYSE-Block + ai-phase-routing in den Issue-Body geschrieben
  (stand=2026-08-28T03:39:49Z), Labels `ai:needs-analyse` → `ai:analysed` + `ai:needs-ux-ui` gesetzt.
- Body-Datei für den Write: `.ai-memory/issue-1080-body.md` (kompletter neuer Body inkl. Analyseblock).
- Body selbst nicht koprimiert (war bereits sauberes Template-Deutsch), Titel unverändert („Settings KI deaktivierbar“ passt).

## Relevante Stellen
- `frontend/src/App.tsx:432` — Toolbar-Item „Säulen-Berater“ (bei KI aus: nicht rendern); `App.tsx:652` —
  `dialog.kind === 'create'` rendert `QuickCaptureModal` (bei deaktivierter Schnellerfassung stattdessen
  `TaskFormModal` mit `initialValues={{ description: dialog.initialText }}`); `App.tsx:685` — Advisor-Dialog.
- `frontend/src/components/TaskForm.tsx:775,983` — Lektorat-Buttons „Titel lektorieren“/„Beschreibung lektorieren“ (bei KI aus: nicht rendern).
- `frontend/src/components/SettingsPage.tsx:303` — Tab 2 „KI-Provider“ (`<LlmSettings />`): Hier Hauptschalter + Schnellerfassungs-Option platzieren; Switch-Zeilen-Muster `.settings-switch-row` (#971).
- `frontend/src/lib/voiceAutostart.ts` — Vorbild für neue `frontend/src/lib/aiPreferences.ts` (reine Funktionen + Hook, localStorage, Best-Effort, Default aus).
- `frontend/src/components/TaskFormModal.tsx:18-21` — unterstützt `task: null` + `initialValues` bereits; kein neuer Dialog nötig.
- e2e-Vorbilder: `frontend/e2e/lektorat-button.spec.ts` (page.route-Mocks), `quick-capture.spec.ts`, `pillar-advisor*.spec.ts`; neu: `frontend/e2e/ai-disable.spec.ts`.

## Annahmen
- Persistenz clientseitig per localStorage (wie Theme/Voice-Autostart) — AK „Neuladen überlebt“ reicht, kein Server-Setting; Endpunkte bleiben erreichbar, reine UI-Ausblendung.
- Defaults = Status quo (KI aktiv, Schnellerfassung aktiv), damit bestehende e2e nicht brechen.
- „LMKI“ im Issue-Text = „die KI“ (im Repo nicht definierter Begriff); gelesen als: Schnellerfassungs-Option ist unabhängig vom KI-Hauptschalter.
- „Lektoren-Schalter“ = die beiden Lektorat-Buttons im TaskForm (Titel/Beschreibung); „Menüs“ = Toolbar + Formular.

## Verworfen
- Serverseitiges User-Setting / API-Änderung — von den AKs nicht gefordert (nur Sichtbarkeit/Persistenz), localStorage-Muster existiert.
- Splitting — rein frontendseitig, ein PR ausreichend; kein `ai:to-big-issue`.

## Offen
- -

## Nächster Schritt
- UX-Phase (Label `ai:needs-ux-ui` gesetzt): KI-UX-Block schreiben; danach Spec/Impl gemäß Routing-Tabelle (ux sonnet/low, spec+impl+review sonnet/medium).

## Fallstricke
- Die beiden Präferenz-Schlüssel müssen mit den e2e-Tests übereinstimmen (wie `pp-voice-autostart`); neue Datei analog benennen, z. B. `pp-ai-disabled` / `pp-quick-capture-disabled`.
- Defaults NICHT auf „deaktiviert“ drehen — bestehende e2e (quick-capture, pillar-advisor, lektorat-button) laufen mit Status-quo-Defaults.
- Berater-„Übernehmen“-Flow (#327) setzt `dialog.initialText` — ohne Schnellerfassung muss der Text ins TaskFormModal-Prefill wandern, nicht verloren gehen.
- `KolInputCheckbox`-Zustand in e2e per `toBeChecked()`/`not.toBeChecked()` prüfen, nicht per `aria-checked` (Memory 2026-08-24).
- Mobiler Check bei 375px: auf `/settings`-Seite readyText entsprechend wählen (app.css versteckt `.app-name` ≤375px nur auf Hauptansicht).
