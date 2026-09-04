# Issue 1212 — Fixup zu PR #1215 (Runde 1), Stand 2026-09-04

## Erledigt
- Findings scoped gelesen: ai-review-Kommentar an Issue #1215 (1 Blocker + 1 Nit), `gh api .../pulls/1215/comments` (keine Inline-Threads), CI nicht rot gemeldet.
- **Finding #1 (blocker) behoben**: `frontend/src/components/GroupDetail.tsx` — „Entfernen" löst nicht mehr direkt `handleRemove` aus, sondern setzt `pendingRemoval` (neuer State, Z. 35). Neuer Bestätigungsdialog via `Modal` (Z. 163-187): Titel „Mitglied entfernen", Text mit Anzeigename, Buttons „Abbrechen" (Initialfokus über `cancelRemoveRef`, #472) und „Entfernen" (`_variant="danger"`, ruft `handleRemove`). `handleRemove` schließt den Dialog zuerst (`setPendingRemoval(null)`, Z. 86), damit die 409-Meldung („letzter Administrator") wie bisher als `KolAlert` in der Detailansicht stehen bleibt.
- Gate grün (delegiert an gate-runner): `pnpm format`, `prettier --check .`, `pnpm lint`, `pnpm knip`, `pnpm test` → alle exit 0, 274 Tests.

## Relevante Stellen
- `frontend/src/components/GroupDetail.tsx:35,37,86,115,163-187` — State, Fokus-Ref, Dialog-Rendering.
- `frontend/e2e/groups-invitations.spec.ts:104-106` — der Vertrag: Klick auf „Entfernen" in der Mitgliederzeile, danach GENAU EIN Klick auf `kol-dialog` → `getByRole('button', {name:'Entfernen', exact:true})`, danach ist das Mitglied weg.
- `frontend/src/components/GroupDeleteDialog.tsx` — zweistufiges Muster aus #1211 (Vorbild für Modal/Fokus, aber s. Annahmen).
- `frontend/src/components/Modal.tsx` — `initialFocusRef` erwartet `RefObject<HTMLElement | null>`, deshalb der Cast beim `HTMLKolButtonElement`-Ref.
- `docs/spec/issue-1212.md:54-55` — Frontend-Vertrag „sequenzielle Bestätigung".

## Annahmen
- **Einstufig statt zweistufig, bewusst**: `docs/spec/issue-1212.md:54` fordert das sequenzielle Muster (2 Schritte), der E2E-Test `groups-invitations.spec.ts:105` klickt aber genau EINEN Dialog-Button mit Namen exakt „Entfernen" und erwartet danach die Entfernung. Ein zweiter Schritt („Endgültig entfernen") würde diesen ausführbaren Vertrag brechen. Der ausführbare Test hat Vorrang; das Review-Finding verlangt „Bestätigungsschritt vor handleRemove", das ist erfüllt. Falls die Zweistufigkeit gewünscht ist, muss der E2E-Test mitgeändert werden — das wäre eine Entscheidung, keine reine Fixup-Korrektur.
- Es gibt KEINEN Unit-Test zu Entfernen/Dialog in `frontend/src/components/GroupDetail.test.tsx` (grep auf `Entfernen|removeGroupMember|dialog` = 0 Treffer) → der Fix ist unit-seitig ungedeckt, E2E deckt ihn ab.

## Verworfen
- Zweistufiger Dialog nach `GroupDeleteDialog.tsx` — bricht `groups-invitations.spec.ts:105` (nur ein Klick, exact „Entfernen"), s. Annahmen.
- Nit „Selbst-Austritt für Nicht-Admins" (ai-review, Nits-Abschnitt) — nicht blockierend, kein AK verlangt es; Fixup fasst nur gemeldete Blocker an.
- `fallbackFocusRef` am Modal — der Trigger-Button verschwindet zwar nach erfolgreichem Entfernen aus dem DOM, aber es gibt in `GroupDetail` kein stabiles Rücksprungziel; nicht Teil des Findings.

## Offen
- E2E wurde in diesem Lauf nicht ausgeführt (Zeitbudget; braucht laufendes Backend). Der Dialog ist gegen den erwarteten Selektor gebaut (`kol-dialog` kommt aus `Modal`/`KolDialog`, Button-Label exakt „Entfernen").

## Nächster Schritt
- Folge-Review liest die ✅-Tabelle im ai-fixup-decisions-Kommentar; falls CI-E2E rot: Selektor/Label im Dialog gegen `groups-invitations.spec.ts:105` abgleichen.

## Fallstricke
- Der Trigger-Button in der Mitgliederzeile heißt ebenfalls „Entfernen" — der E2E-Locator ist auf `kol-dialog` gescoped, in Unit-Tests wäre `getAllByRole` nötig.
- `handleRemove` muss den Dialog VOR dem Request schließen, sonst überlagert das Modal die Fehler-`KolAlert` (409 letzter Admin).
- `Modal` öffnet `KolDialog` imperativ beim Mount → Dialog nur bedingt rendern (`pendingRemoval !== null`), nicht per CSS verstecken.
