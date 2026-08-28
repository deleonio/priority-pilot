# Issue 1095 — Implement (Phase 3), Stand 2026-08-28T16:40Z

## Erledigt
- **PHASE ABGESCHLOSSEN:** Commit e95bcb59 auf `ai/harness/1095` gepusht, PR **#1097** via `gh pr ready 1097` review-ready (isDraft=false), Body um Umsetzung + Gate-Tabelle erweitert (Ergebnis aller Schritte steht im PR-Body).
- Gate: format/prettier/lint/knip exit 0 (knip nur bekannte Configuration-hints), `pnpm --filter frontend test` **451 passed/13 skipped**, E2E `pwa-update-prompt.spec.ts` **11/11** grün. `pnpm --filter server test` exit 1 — pre-existing (AK-5 Redis-Store, `git stash`-Gegenprobe auf unverändertem Stand identisch: 730 pass/fail 0/skipped 1), im PR-Body dokumentiert, nicht gefixt.
- Spec-PR gefunden + gecheckt: Draft-PR **#1097** (`headRefName=ai/harness/1095`, closingIssuesReferences=[1095]); lokale untracked `.ai-memory/issue-1095-{spec,triage}.md` waren byte-identisch mit dem Branch-Stand → vor `git switch` gelöscht (sonst "Please move or remove them").
- Quick-Check (Skill Schritt 2, KEIN Re-Triage): Analyse-Block im Body stand=2026-08-28T16:17:01Z, Ampel 🟢, AK1–AK4 + Testfälle intakt; betroffene Dateien existieren. KEIN KI-UX-Block im Body (ux=nein laut Routing-Tabelle).
- Rot-Verifikation: `pnpm exec vitest run src/components/UpdatePrompt.test.tsx` (im `frontend/`) = **3 failed | 18 passed** — genau die drei neuen #1095-Verhaltenstests (AK1 Listener-Registrierung ~250, AK1 reload ~264, AK2 Idempotenz ~278); AK3 ~291 initial grün wie im Spec vorgesehen.
- Komponente umgesetzt (`frontend/src/components/UpdatePrompt.tsx`): `confirmUpdate()`-Handler — Klick → `updateServiceWorker(true)` + einmalige `controllerchange`-Registrierung auf `navigator.serviceWorker` (Guard via `useRef`), Listener ruft `window.location.reload()` mit Reload-Flag. VITE.config, UI, Texte unangetastet.

## Relevante Stellen
- `frontend/src/components/UpdatePrompt.tsx:34` — einzige Produktiv-Änderung (Klick-Naht).
- `frontend/src/components/UpdatePrompt.test.tsx:228-303` — Spec-Vertrag (NICHT geändert); `navigator.serviceWorker`-EventTarget-Stubb + `vi.stubGlobal('location',{reload})`.
- `frontend/e2e/pwa-update-prompt.spec.ts:299-357` — AK4 ist Mechanismus-Test mit injizierter Struktur → unabhängig von der Komponente grün (im Spec als initial grün deklariert).
- `frontend/vite.config.ts` — bewusst unangetastet (registerType 'prompt' durch AK1a–d gesichert).

## Annahmen
- `toHaveBeenCalledWith('controllerchange', expect.any(Function))` im AK1-Test zwingt zu einer Registrierung OHNE drittes Options-Argument → `{once:true}` ist NICHT verwendbar; Idempotenz läuft über eigene Flags.
- Workbox-interner Reload-Pfad bleibt außerhalb des Guards (steht so im Spec); AK2 fordert "genau 1 Reload aus der Komponente".

## Verworfen
- `{ once: true }` als Idempotenz-Mechanik — bricht die AK1-Assertion (3. Argument). Flags stattdessen.
- Änderung an `vite.config.ts`/`vitest.config.ts` — nicht Teil der AKs, Spec verbietet es explizit.

## Offen
- -

## Nächster Schritt
- Review-Phase (Kreuzverhör) — Implementierung ist fertig, nichts offen.

## Fallstricke
- `git switch ai/harness/1095` blockt auf untracked `.ai-memory/issue-1095-*.md`, wenn die Datei im Branch schon existiert → vorher byte-identisch prüfen (`git show origin/<branch>:<pfad> | diff - <pfad>`), dann löschen.
- E2E `sessionStorage`-Zähler ist der einzige Reload-Beweis; JS-Closure-Zustand stirbt beim Reload (Spec-Notiz).
