# Issue #1058 — Phase 1 (Triage)

## Erledigt

- Initial-Triage (kein KI-ANALYSE-Block vorhanden, nur ein `<!-- ai-quality -->`-Bot-Kommentar → keine Delta-Logik noetig).
- Code-Recherche: `SearchModal.tsx` vs. die drei anderen VoiceField-Call-Sites.
- KI-ANALYSE-Block + ai-phase-routing-Tabelle in den Issue-Body geschrieben (`stand=2026-08-27T13:11:32Z`), Quelltext liegt in `.ai-memory/issue-1058-body.md`.
- Labels gesetzt: `ai:analysed`, `ai:needs-spec`. Titel unveraendert (inhaltlich korrekt), Beschreibung unveraendert (kein Lektoratsbedarf).
- Kein Ping-Kommentar (Ampel 🟢, keine offenen Fragen) — so vom Skill vorgesehen.

## Relevante Stellen

- `frontend/src/components/SearchModal.tsx:45-65` — das `VoiceField` um `KolInputText`; **einzige** Call-Site ohne `autoStart`-Prop. Hier liegt die Aenderung.
- `frontend/src/components/SearchModal.tsx:22-27` — Autofokus-Effect (200 ms `setTimeout` auf `shadowRoot input`); darf nicht angefasst werden.
- `frontend/src/components/QuickCaptureModal.tsx:54` (`const [voiceAutostart] = useState(readVoiceAutostartPreference)`) und `:140` (`autoStart={voiceAutostart}`) — das zu kopierende Muster.
- `frontend/src/components/PillarAdvisorModal.tsx:145`, `frontend/src/components/TaskForm.tsx:293` + `:728` — dieselben zwei Zeilen, zweite/dritte Referenz.
- `frontend/src/components/VoiceField.tsx:44-69` — `autoStart`-Prop + Ein-Schuss-`useRef`-Effect mit StrictMode-sicherem Cleanup; kapselt den Auto-Start vollstaendig (kein eigener Effect in SearchModal noetig).
- `frontend/src/lib/voiceAutostart.ts` — `readVoiceAutostartPreference()`, `STORAGE_KEY = 'pp-voice-autostart'`, Default `false`.
- `frontend/e2e/voice-autostart.spec.ts` — Zielspec. `buildInitScript` (ab Zeile 27) mockt Web Speech API und setzt `window.__speechRecognitionStarted`; Vorbild-Bloecke: `:432` (Schnellerfassung), `:511` (Saeulen-Berater), `:339` (nicht-unterstuetzter Browser).
- `frontend/e2e/search-modal.spec.ts:21` (`searchButton`-Locator) und `:62` (Heading „Suche“) — wie der Dialog im e2e geoeffnet/verifiziert wird.

## Annahmen

- Der Suche-Dialog wird bei jedem Oeffnen neu gemountet (Toolbar-Button rendert `SearchModal` konditional) — nur dann greift der Mount-basierte Auto-Start. Nicht im `App.tsx` gegengeprueft; die Spec-Phase sollte das beim ersten roten Test verifizieren.
- `voiceAutostart` wird bewusst einmalig pro Dialog-Instanz gelesen (kein Live-Update), analog zum Kommentar `TaskForm.tsx:293`.

## Verworfen

- Vitest-Unit-Test fuer SearchModal: es gibt keine `SearchModal.test.tsx`, und alle drei bestehenden Autostart-Call-Sites sind ausschliesslich per e2e in `voice-autostart.spec.ts` abgesichert. Konsistenz schlaegt neue Testebene.
- Anpassung des Settings-Hinweistexts (`SettingsPage.tsx:160` nennt nur „Formulare zum Anlegen und Bearbeiten von Tasks und Serien“, obwohl Schnellerfassung + Berater ebenfalls autostarten): NICHT in den Analyse-Block aufgenommen — waere eine inhaltliche Erweiterung des Tickets ueber die Beschreibung hinaus (Skill Schritt 2: keine neuen Anforderungen). Bei Bedarf eigenes Ticket.
- Aufteilen (Skill Schritt 3): nicht noetig — eine Datei, ein PR.

## Offen

- -

## Naechster Schritt

- Phase 3 (Spec): roten e2e-Block „Suche-Dialog: Voice-Autostart im Suchfeld“ in `frontend/e2e/voice-autostart.spec.ts` gegen AK1–AK4 schreiben.

## Fallstricke

- Body-Text NICHT per Heredoc schreiben (Bash-Tool-Parser bricht) — `Write` nach `.ai-memory/issue-<N>-*.md` (gitignored via `.gitignore:4`) + `gh issue edit --body-file`. Hat hier so funktioniert.
- Die ai-phase-routing-Tabelle OHNE Leerzeilen zwischen Marker und Tabelle schreiben und ASCII halten (`-` fuer `Run: nein`) — sie wird von `resolve-phase-routing.sh` geparst.
- Gezielte e2e-Verifikation: im `frontend`-Verzeichnis `npx playwright test e2e/voice-autostart.spec.ts`, NICHT `pnpm --filter frontend test:e2e -- <pattern>` (filtert nicht, volle Suite ~10 Min).
