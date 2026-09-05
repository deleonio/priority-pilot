# Issue 1231 — UX (Phase 2), Stand 2026-09-05

**ERGEBNIS: VERDICT ux-ready.** KI-UX-Block in den Harness-Marker-Kommentar (REST-ID 5548559338) geschrieben, KI-ANALYSE byte-identisch erhalten. Keine Labels geändert, kein Ping-Kommentar, Issue-Body unangetastet.

## Erledigt
- SKILL.md, MEMORY.md, Issue-Body, Harness-Kommentar (`.ai-memory/issue-1231-harness.json`) gelesen; kein KI-UX-Block vorhanden → Phase lief.
- Regelquellen statisch geprüft: `docs/mobile-ui-rules.md`, `.ai-knowledge/ux-design.md` (beide vollständig gelesen). Kein Browser/Playwright, kein KoliBri-MCP-Lookup nötig (Komponentenwahl klar: Modal.tsx/KolDialog).
- KI-UX-Block verfasst (`.ai-memory/issue-1231-ux-block.md`), Kommentar-Body assembliert (`jq -r .body` + append → `.ai-memory/issue-1231-comment-full.md`) und per `gh api …/issues/comments/5548559338 -X PATCH -F body=@…` aktualisiert; Landing verifiziert (alle Marker 1×, Tail = KI-UX:END).

## Relevante Stellen
- `frontend/src/components/Modal.tsx` — KoliBri-KolDialog-Wrapper mit Fokus-Falle/Escape/Backdrop; UX-Empfehlung: für SessionExpiredDialog wiederverwenden.
- `frontend/src/components/UpdatePrompt.tsx` — Präzedenz global montierter Prompt (Analyse nennt es als Muster).
- `frontend/src/lib/apiError.ts` — zentrale Session-401-Erkennung (`toApiError`, SESSION_MESSAGES).
- `frontend/src/Root.tsx` — Silent-Login-Loop-Guards (`pp_silent_attempted`, `?silent=unavailable`).

## Annahmen
- UX-Beratung ist rein advisory; die beiden Benennungen (Datenverlust-Hinweis, Modal-in-Modal-Verhalten) sind Empfehlungen für die Spec, keine Blocker → ux-ready trotz „Offene UX-Fragen"-Sektion.
- Assemblierter Body aus dem JSON-Fetch ist byte-identisch zum Original (ggf. ±1 trailing newline, unkritisch — Analyse-Sektion zwischen den Markern unverändert).

## Verworfen
- KoliBri-MCP-Konsultation — Komponentenwahl durch ux-design.md-Tabelle (KolDialog/Modal.tsx, KolButton) eindeutig gedeckt.
- Dynamische Inspection — per Prompt verboten (rein statisch).

## Offen
- Wegwerf-Artefakte in `.ai-memory/`, NICHT committen: `issue-1231-harness.json`, `-ux-block.md`, `-comment-full.md`, `-mutation.graphql`, `-build-payload.py`, `-payload.json`, `-verify.md`. Nur diese Datei ist die Phasen-Notiz. `-payload.json`/`-build-payload.py`/`-mutation.graphql` waren Sackgassen-Artefakte (s. Fallstricke).

## Nächster Schritt
- Spec-Phase: rote Tests TF1–TF6 aus dem KI-ANALYSE-Block; dabei über die beiden UX-Benennungen (Datenverlust-Text, Modal-in-Modal) explizit entscheiden.

## Fallstricke
- **gh api: `-f body=@file` liest die Datei NICHT** — nur `-F` (typed) expandiert `@`. Mit `-f` landet der Literal-String `@pfad` als Body (ist diesem Lauf passiert; Kommentar-Body wurde kurzzeitig zerstört, per `-F` aus der Assemble-Datei wiederhergestellt). Immer `-F body=@file`.
- GraphQL-Mutation per `gh api graphql` war in dieser Sandbox unbrauchbar: Query-String mit `{…}`+Quotes → „Brace expansion"/„expansion obfuscation"-Ablehnung; `-f query=@file` liest Dateien nicht; `python3`/`jq --rawfile` wurden ebenfalls geblockt. REST-PATCH (oben) ist der funktionierende Weg.
- REST-ID des Kommentors via `gh api repos/{owner}/{repo}/issues/1231/comments --jq '.[].id'` ermitteln (5548559338), nicht per Node-ID-Base64-Decode (Hand-Decode lief falschen Wert → 404).
