# Issue 1212 — Fixup zu PR #1215 (Runde 1 + Crash-Nachbereitung), Stand 2026-09-04

## Nachbereitung Lauf 2 (Crash-Wiederanlauf, gleiche Runde)
- Voriger Lauf crashte NACH Fix+Push (33be8aec) vor der Nachweis-Pflege. Dieser Lauf: ai-fixup-decisions-Kommentar erstellt (ID 5539372480, Marker `<!-- ai-fixup-decisions -->`), ✅-Tabelle mit Zeile für Finding #1/33be8aec gepflegt, Review-Thread PRRT_kwDONloM186fMFFR (GroupDetail.tsx:112) per GraphQL resolveReviewThread aufgelöst (isResolved:true verifiziert). Kein VERDICT (Fix-Commit bestimmt Fortschritt).

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
- **CI e2e-Shard 1 ROT** (Run 33845823342, SHA 8953ad13, kein Rerun ausgeführt): 3 Fehler in `frontend/e2e/groups-invitations.spec.ts` — AK1 (spec:44), AK6/AK9 (spec:59), AK12 (spec:114). Erstfehler: spec:53 `getByRole('searchbox')` nie gefunden nach Klick auf Gruppen-Listitem (`locator.fill` 30s-Timeout) — GroupDetail-Ansicht rendert die Suche scheinbar nicht. Shards 2-4 + verify grün; Modal.tsx existiert, `_type="search"` steht in GroupDetail.tsx:137. Ursache ungeklärt: Regression aus 33be8aec (Modal/Laufzeit) vs. Timing/Seed-Flake vs. bereits im Erststand. Im ai-fixup-decisions-Kommentar als 🔴 offener Punkt dokumentiert.
- E2E wurde lokal in keinem Lauf ausgeführt (Zeitbudget; braucht laufendes Backend).

## Nächster Schritt
- e2e-Fehler analysieren: Log von Job 100937378234 komplett lesen (Kontext um 06:57:57Z), prüfen ob alle 3 Tests am selben Punkt (searchbox nach Listitem-Klick) sterben; vermutlich Rerun ODER Fix. Danach erst Folge-Review.

## Fallstricke
- Der Trigger-Button in der Mitgliederzeile heißt ebenfalls „Entfernen" — der E2E-Locator ist auf `kol-dialog` gescoped, in Unit-Tests wäre `getAllByRole` nötig.
- `handleRemove` muss den Dialog VOR dem Request schließen, sonst überlagert das Modal die Fehler-`KolAlert` (409 letzter Admin).
- `Modal` öffnet `KolDialog` imperativ beim Mount → Dialog nur bedingt rendern (`pendingRemoval !== null`), nicht per CSS verstecken.
