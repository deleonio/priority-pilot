# Issue #1085 / PR #1087 — Review (Kreuzverhör R1 + Fixup-Nachweis R2)

Status: **reviewed gesprochen** (2026-08-28, Fixup-Nachweis). Sammelkommentar (Marker `<!-- ai-review -->`):
https://github.com/deleonio/priority-pilot/pull/1087#issuecomment-5448857670 — per PATCH auf derselben ID
aktualisiert (Review-Status: reviewed, Review-Typ: Fixup-Nachweis). Keine neuen Inline-Kommentare (keine Findings).

## Erledigt
- R1 (Kreuzverhör): 4 Findings (1 🔴 Gate, 2 🟡 Alert-Text, 3 🟡 e2e-Vertrag, 4 🟡 Kommentar-Ref) → needs-fixup;
  PR-Titel auf `fix(#1085): disable quick-capture switch when ai is disabled` konform umbenannt.
- R2 (Fixup-Nachweis): Modus über Marker in issuecomment-5448857670 bestimmt (vorhanden → Fixup-Verifikation,
  kein neues Kreuzverhör). Delta = Fixup-Commit dbbebbe4 (85af7a13..dbbebbe4, 5 Code-Dateien + 2 Memory-Files).
- Alle 4 Findings im Diff verifiziert: `aiPreferences.ts:54` `isQuickCaptureEffective()` + `App.tsx:419/675`-Gate;
  `SettingsPage.tsx:325` Alert-Text; `SettingsPage.tsx:330` #1085-Ref; `ai-disable.spec.ts` (AK1+AK3 reworked mit
  `toBeDisabled()`, neuer AK2-Test, AK5-Reihenfolge, AK6-Reset-Schleife) + `aiPreferences.test.ts` it.each (4 Kombos).
- Konsumenten-Prüfung (grep `quickCaptureEnabled|isQuickCaptureEffective` über frontend/src): effektiver Wert fliesst
  NUR ins Anlegen-Gate; SettingsPage nutzt weiter Rohwert (`useAiPreferences`, SettingsPage.tsx:81/337) für die
  gesperrte Schalter-Anzeige — korrekt, keine stillen Semantik-Änderungen.
- CI am Head dbbebbe4: `verify` SUCCESS, `e2e (1)`–`e2e (4)` SUCCESS (die in R1 noch pendingen Shards sind grün).
- Titel-Gate: Conventional-Commits-konform, unverändert aus R1.

## Relevante Stellen
- `frontend/src/lib/aiPreferences.ts:54-55` — Wirksamkeitslogik (`aiEnabled && quickCaptureEnabled`), einziger Export dafür.
- `frontend/src/App.tsx:415-420, 675` — Anlegen-Gate (QuickCaptureModal vs. TaskFormModal), einziger Konsument der effektiven Präferenz.
- `frontend/src/components/SettingsPage.tsx:81, 325-341` — Rohwert-Anzeige + gesperrter Switch + Alert.
- `frontend/e2e/ai-disable.spec.ts` — #1080/#1085-Vertrag im Browser (9 Tests, lokal + CI grün).
- `frontend/src/lib/aiPreferences.test.ts:88-96` — Unit-Vertrag der Wirksamkeitslogik.

## Annahmen
- Delta-Scoping: updatedAt des Sammelkommentars (06:07:41Z) liegt NACH dem Fixup-Push (06:06:20Z), weil die Fixup-Phase
  den Kommentar selbst aktualisiert hat — massgeblich für den Nachweis ist der Fixup-Commit dbbebbe4, nicht commits>updatedAt.
- „review"-Check IN_PROGRESS im Rollup ist der eigene Review-Workflow (ich), kein rotes Gate.

## Verworfen
- Neues Kreuzverhör des Gesamtdiffs: Marker vorhanden → laut Methode nur Fixup-Delta + Abhaken (R1-Befunde standen).
- Neue Inline-Kommentare: keine Findings im Fixup-Diff → nichts zu verankern.

## Offen
- `-` (nur noch Deterministic Gate/Auto-Merge der Pipeline auf Basis von reviewed + grüner CI.)

## Nächster Schritt
- Keiner für die Review-Phase — Urteil `reviewed` steht; Pipeline übernimmt (Gate → ai:ready-to-merge → Merge).

## Fallstricke
- Der AI-Sammelkommentar muss per PATCH auf derselben Comment-ID (5448857670) aktualisiert werden — nicht neu erstellen.
- Temp-Body-Dateien für `gh … --body-file` unter `.ai-memory/issue-1085-*.md` anlegen und danach löschen.
- Titel nicht wieder auf einen deutschen zurückändern — konformer englischer Titel aus R1 bleibt.
