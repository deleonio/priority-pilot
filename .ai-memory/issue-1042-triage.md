# Issue #1042 — Triage (Phase 1/7)

## Erledigt

- Lauf 1 (10:49Z): Erst-Triage → `ai:needs-human`, EIN `<!-- ai-triage-decision -->`-Kommentar
  (https://github.com/deleonio/priority-pilot/issues/1042#issuecomment-5424223047), kein Analyse-Block.
- Lauf 2 (10:54Z, Re-Triage): Delta-Kommentar von `deleonio` (2026-08-26T10:52:50Z) beantwortet die
  Frage: **„Jetzt starten"-Schalter auf der Dashboard-Seite**.
- Analyse-Block (`KI-ANALYSE`, stand=2026-08-26T10:54:29Z) + `ai-phase-routing`-Tabelle in den
  Issue-Body geschrieben (Quelle: `.ai-memory/issue-1042-body.md`, gitignored).
- Body leicht lektoriert (Grossschreibung im IST-Satz), Bild-Tag unveraendert. Titel NICHT geaendert
  (inhaltlich korrekt).
- Labels final: `ai:analysed` + `ai:needs-ux-ui`; `ai:needs-analyse` und `ai:needs-human` entfernt
  (per `gh issue view --json labels` verifiziert).
- KEIN Ping-Kommentar (Auftrag: Body-Block + Label = vollstaendige Kommunikation).

## Relevante Stellen

- `frontend/src/components/Dashboard.tsx:184-189` — `KolButton _label="Jetzt starten"`, rendert nur bei
  `onStartTask !== undefined` und vorhandener `nextTask`.
- `frontend/src/app.css:517-521` `.dashboard-next-task-content` — `display:flex; flex-direction:column`
  → Button erbt `align-self: stretch` = Root Cause der Desktop-Vollbreite.
- `frontend/src/app.css:1441-1452` `.settings-action-btn` — Zielmuster (`stretch` → ab 768px `flex-start`).
- `frontend/src/app.css:1583-1600` `.update-prompt kol-card kol-button` — Muster fuer Selektor-Scoping
  ohne TSX-Aenderung.
- `frontend/e2e/settings-action-buttons.spec.ts` — e2e-Vorbild fuer die neue Spec.
- Breakpoint: Datei nutzt `48rem` (=768px) durchgehend (`grep -n "@media" frontend/src/app.css`).

## Annahmen

- CSS-only reicht; `Dashboard.tsx` muss nicht angefasst werden (Selektor `.dashboard-next-task-content
  kol-button`).
- Bounding-Box-Messung ist die tragfaehige Pruefmethode (Memory 2026-08-24: `scrollWidth` untauglich,
  boundingBox misst Border-Box).

## Verworfen

- KoliBri `_inline`: entfernt den 44px-Touch-Target (Mobile-UI-Regel 2), steht so schon im
  `.settings-action-btn`-Kommentar.
- Wiederverwendung der Klasse `.settings-action-btn` am Dashboard-Button: Name ist settings-spezifisch,
  Scoping-Muster #1034 ist sauberer.
- Screenshot laden (Lauf 1): kein Netzzugriff auf `user-attachments` — Bilder sind fuer die Pipeline
  grundsaetzlich unsichtbar.

## Offen

- `-`

## Naechster Schritt

- Phase 2 (UX, laut Routing `haiku`/`low`): kurze Pruefung, dann Spec.

## Fallstricke

- Tickets, die den Ort nur per Screenshot benennen, sind ohne Textangabe zwingend `needs-human` —
  #1021 entfernt Bilder ausserdem nachtraeglich.
- Body-Schreiben nur per `Write` in `.ai-memory/issue-<N>-*.md` + `gh issue edit --body-file`;
  Heredoc mit mehrzeiligem Markdown scheitert am Bash-Tool-Parser (MEMORY 2026-08-26).
- Routing-Tabelle muss ASCII bleiben (wird maschinell von `resolve-phase-routing.sh` gelesen).
