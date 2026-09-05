# Issue 1219 — Review (Phase 5, Kreuzverhör Runde 1), Stand 2026-09-05T07:5xZ

**ERGEBNIS: VERDICT needs-fixup (🔴). Kommentare SIND gepostet** (vorheriger Soft-Abort-Lauf 33942803381 hatte nur diese Notiz, keine Kommentare). Review #5120347729 (event COMMENT) mit 2 Inline-Findings; Sammelkommentar `<!-- ai-review -->` = issuecomment-5550353239. Titel-Gate: „Anzeigenamen selbst festlegen (#1219)" → `feat(frontend,server): editable display name in settings (#1219)` umbenannt (erster Lauf hatte Umbenennung behauptet, war aber nicht gelandet — Titel war noch alt).

## Erledigt
- Modus: markerlos → Kreuzverhör. Vorläufer-Notiz übernommen, gegen Head 9b339bd5 (Merge von main bd0c2b82 = #1234/#1227) neu verifiziert: CI-Lauf 33952363975 — `verify` grün, e2e 1/2/4 grün, **e2e-Shard 3 ROT mit genau 2 Failures**: `issue-843.spec.ts:26` AK1 (Gap 147.125 ≠ 16) + `profile-display-name.spec.ts:44` (toContainText uniqueName received "E1", in AK7-Test :17).
- settings-action-buttons-Regression des Vorläufs IST ENTFALLEN: main #1227 filtert `.settings-general > kol-button` nach Text „Push testen" (Diff 85198d99..9b339bd5 geprüft) → nur noch 2 offene Findings.
- Precedent verifiziert: `header-appearance.spec.ts:33-39` (`toHaveAttribute('_label', …)`), `App.tsx:664` `<KolAvatar _label={user.displayName}>`.
- Review + Sammelkommentar + Titelumbenennung gepostet.

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:309-328` — `.settings-general` mit direkten Kindern KolInputText (:313) + KolButton „Anzeigename speichern" (:328); Fix: Wrapper-Div `.settings-profile`. Achtung: :383 steht inzwischen #1234s „Details Optionen anzeigen" (direkt, aus main — darf/darf nicht mit in den Wrapper? Nein — nur #1219-eigene Elemente ummanteln, #1234-Button gehört main und ist von #843-AK1 auf main offenbar toleriert).
- `frontend/e2e/issue-843.spec.ts:33` — Control-Liste (direkte Kinder + descendant kol-input-checkbox), 16px-Gap-Paarweise-Messung = die rote AK1.
- `frontend/e2e/profile-display-name.spec.ts:44` — rot; Korrektur: `toHaveAttribute('_label', uniqueName)` auf `.app-header__user kol-avatar`.
- `frontend/e2e/settings-action-buttons.spec.ts:136` — inzwischen text-gefiltert (main #1227), kein Finding mehr.

## Annahmen
- Wrapper um Feld+Button stellt den #843-Zustand von main wieder her (dort AK1 mit #1234-Button grün); Beleg liefert der Fixup-Shard-3-Lauf.
- Finding-Zählung 1+2 stammt aus Vorläufer-Runde (stabil); die entfallene settings-action-buttons-Regression war nie nummeriert, steht nur als Vorab-Info in „Behobene Anmerkungen".

## Verworfen
- needs-human für Kopfzeilen-Assertion — #865 ist dokumentierte Menschen-Entscheidung; Korrektur freigegeben.
- Eigene Neu-Durchsicht des Server-Diffs — Vorläufer hat profile.ts geprüft (extractDisplayName, Session-Pflege korrekt), `verify` grün; keine neuen Commits außer Merge.

## Offen
- Fixup muss liefern: (1) Wrapper um Feld+Button, (2) Spec-Korrektur :44 mit Begründungs-Kommentar, danach e2e-Shard 3 grün.
- Wegwerf-Artefakte NICHT committen: `issue-1219-review-{body,c1,c2,collected}.md` (nur diese Datei ist die Phasen-Notiz).

## Nächster Schritt
- Fixup-Runde (Workflow setzt `ai:needs-changes`): Findings 1+2 umsetzen, `npx playwright test e2e/issue-843.spec.ts e2e/profile-display-name.spec.ts e2e/settings-action-buttons.spec.ts` im frontend/-Verzeichnis gegenprüfen; danach Fixup-Nachweis-Review (Modus markerbasiert).

## Fallstricke
- #843/#1017-Locatoren NICHT lockern — Produktcode-Wrapper ist der Weg.
- Beim Wrapper nur die #1219-Elemente ummanteln; `.settings-switch-row` nicht verwenden (e2e-Guard zählt genau 3 Zeilen, #971).
- Erneuter Merge-Konflikt mit main möglich (SettingsPage.tsx ist Hotfile — #1234 hat es gerade umbaut); Fixup auf aktuellem Head aufsetzen.
