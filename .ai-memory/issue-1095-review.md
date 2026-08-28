# Issue 1095 — Review/Kreuzverhör (PR #1097), Stand 2026-08-28T16:55Z

**ERGEBNIS: VERDICT needs-fixup, Ampel 🟡.** MODE = Kreuzverhör (kein `<!-- ai-review -->`-Kommentar vorhanden → erste Runde). Closing issue #1095 vorhanden → AKs aus dem KI-ANALYSE-Block (stand=2026-08-28T16:17:01Z, Ampel 🟢, AK1–AK4). 3 Findings gepostet als Review (event=COMMENT): F1 Verhalten (UpdatePrompt.tsx:38), F2 Naming (UpdatePrompt.tsx:33), F3 vakuer E2E-Assert (pwa-update-prompt.spec.ts:355).

## Erledigt
- Marker-Suche: 0 Issue-Kommentare auf PR #1097, 0 Review-Kommentare → Kreuzverhör (volle Prüfung).
- PR gelesen: head `ai/harness/1095`, base main, 7 Dateien (3× `.ai-memory`, docs/spec/issue-1095.md, UpdatePrompt.tsx, UpdatePrompt.test.tsx, pwa-update-prompt.spec.ts); 425 Diffzeilen; CI: precheck/verify/e2e(1-4) SUCCESS, `review` = laufender Job.
- Issue #1095 KI-ANALYSE-Block geladen (AK1 Listener+updateServiceWorker, AK2 Idempotenz, AK3 kein Reload ohne Klick, AK4 E2E 375px).
- Separation of Duties geprüft: `git diff de2c95ea HEAD -- UpdatePrompt.test.tsx pwa-update-prompt.spec.ts` = LEER → rote Spec-Tests (Commit de2c95ea „test: red spec tests for #1095", vor fix-Commit e95bcb59) wurden UNVERÄNDERT grün gemacht ✓; AK3 initial grün im PR-Body begründet ✓.
- Testsubstanz gegenprüft: AK1-Test spy't `addEventListener` am EventTarget-Stubb + `toHaveBeenCalledWith('controllerchange', expect.any(Function))`; AK2 3× dispatch → 1× reload; AK3 kein Listener/Reload ohne Klick; Mutationsprobe im PR-Body plausibel.
- Naming-Konvention gegen Codebase geprüft: `grep -rnE "const [a-zA-Z]*[äöüß...]"` → `bestätigtRef` ist der EINZIGE Nicht-ASCII-Bezeichner im `frontend/src`; alle Refs sonst englisch camelCase (App.tsx:257, Modal.tsx:59/74).
- Findings als Review gepostet (gh api pulls/1097/reviews, event=COMMENT, 3 inline comments); Sammelkommentar `<!-- ai-review -->` erstmals angelegt; Titel-Gate: PR-Titel war Issue-Titel „Pwa update hängt oder geht nicht (#1095)" → umbenannt in `fix(frontend): guarantee reload after PWA update confirmation (#1095)`.

## Relevante Stellen
- `frontend/src/components/UpdatePrompt.tsx:37-41` — `bestätigtRef`-Early-Return blockt auch den erneuten `updateServiceWorker(true)`-Aufruf (F1).
- `frontend/src/components/UpdatePrompt.tsx:33-34` — `bestätigtRef`/`reloadtRef` (F2, Naming).
- `frontend/e2e/pwa-update-prompt.spec.ts:355` — `toHaveCount(0)` auf `.update-prompt` nach Reload: kann nie fehlschlagen (injizierter Container weg, echter Prompt nie gemountet) (F3).
- `frontend/src/components/UpdatePrompt.test.tsx:216-303` — #1095-Suite (AK1×2/AK2/AK3), unverändert zur roten Version.
- `frontend/src/components/UpdatePrompt.test.tsx:52-58` — #353-AK3-Test („Klick ruft updateServiceWorker(true)") bleibt grün, testet aber nur den ersten Klick.

## Annahmen
- vite-plugin-pwa-Interna (interner `controlling`-Reload-Pfad) NICHT selbst gelesen (keine node_modules in der Sandbox) — F1 begründet rein über beobachtbares Verhalten: zweiter Klick = No-op, unabhängig vom internen Pfad.
- Tests als grün über CI-Nachweis übernommen (verify SUCCESS, e2e 4× SUCCESS, PR-Body: 451 passed/13 skipped, 11/11 E2E) — kein lokaler Lauf möglich (kein node_modules).

## Verworfen
- F1 als needs-human/Entscheidungs-Finding — klar fixbarer Code-Fehler mit Empfehlung, keine Architekturfrage.
- AK2-„Workbox-Pfad + eigener Fallback"-Lücke als eigenes Finding — interner Pfad ist prinzipiell nicht vom Komponenten-Guard erfassbar, im Spec/Impl-Note dokumentiert; E2E deckt die 3×-Kette.
- Doppelklick-Guard als solches zu verwerfen, ohne Empfehlung — Fixup bekommt beide Optionen (Guard nur auf Listener-Registrierung ODER Test, der das Verhalten nagelt).
- KoliBri-/Mobile-First-Prüfung als Finding — UI/Marup/CSS unverändert, 375px-E2E vorhanden.

## Offen
- Fixup-Runde steht aus; F1–F3 nummernstabil halten (Review-ID 5053249457, Sammelkommentar-ID 5455350477).
- Titel-Gate ausgeführt: PR-Titel war Issue-Titel → jetzt `fix(frontend): guarantee reload after PWA update confirmation (#1095)` (≤72, englisch, lowercase).

## Nächster Schritt
- Fixup-Nachweis: nur noch F1–F3 abhaken (Diff-Scope auf die Fixup-Commits), keine erneute Vollprüfung.

## Fallstricke
- `git show <sha>:<pfad>` nötig für Anchor-Zeilen — die Diff-Hunk-Kopfzeilen (z. B. `+23,34`) sind nicht die finalen Dateizeilen.
- gh-Review-JSON mit Codeblocks: per python3 json.dump bauen (nacktes Heredoc-JSON bricht an Newlines/Tabs in Vorschlägen).
- Pre-existing rot: `pnpm --filter server test` exit 1 an session.test.ts Redis-Store (durch `git stash`-Gegenprobe im PR-Body als pre-existing belegt) — NICHT als Finding werten.
