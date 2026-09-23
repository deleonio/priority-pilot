# Issue #1085 / PR #1087 — Review (Kreuzverhör Runde 1)

Status: **needs-fixup** gesprochen (2026-08-28). Sammelkommentar:
https://github.com/deleonio/priority-pilot/pull/1087#issuecomment-5448857670 (Marker `<!-- ai-review -->`).
Inline-Review (event COMMENT, id 5048190413) mit 2 Anker-Kommentaren an SettingsPage.tsx:338/:330.

## Erledigt
- Modus bestimmt: kein `<!-- ai-review -->` vorhanden → Kreuzverhör (Erstrunde).
- Issue #1085 gelesen: **kein KI-ANALYSE-Block**, keine Analyse-Kommentare (nur veralteter
  Template-Bot) → AK informell aus dem Issue-Body „Woran messen wir das?" (3 Bullets) übernommen
  und im Sammelkommentar so dokumentiert.
- Vollständigen Diff gelesen (1 Datei, +4/−3: SettingsPage.tsx — `_disabled={!aiEnabled}`, Hint,
  Kommentar).
- Konsumstellen geprüft: `aiEnabled` steuert NUR App.tsx:442 (Toolbar-Berater) und
  TaskForm.tsx:807/1020 (Lektorat-Buttons); QuickCaptureModal/VoiceField haben KEIN aiEnabled-Gate.
- PR-Titel-Gate: deutsch → konform umbenannt in
  `fix(#1085): disable quick-capture switch when ai is disabled`.
- 4 Findings gepostet (siehe unten); Urteil needs-fixup, kein Entscheidungs-Finding
  (Issue hat „disabled statt ausgeblendet" bereits vorgegeben).

## Relevante Stellen
- `frontend/src/App.tsx:671` — Anlegen-Gate `(quickCaptureEnabled ? <QuickCaptureModal/> : <TaskFormModal/>)`: Finding 1 🔴 (AK 2 fehlt).
- `frontend/src/lib/aiPreferences.ts:45` — Default `quickCaptureEnabled: true` → macht Finding 1 praktisch relevant (KI-aus-Nutzer behält Schnellerfassung).
- `frontend/src/components/SettingsPage.tsx:323-326` — KolAlert „…unabhängig von dieser Einstellung gesteuert": Finding 2 🟡 (widerspricht neuem Verhalten; NICHT im Diff-Hunk → inline bei Zeile 338 verankert).
- `frontend/e2e/ai-disable.spec.ts:61-64` — AK1+AK3-Test pinnt #1080-Unabhängigkeit (klickt Switch bei KI-aus): Finding 3 🟡 Test-Pflege-Bedarf; Datei nicht im Diff → nur im Review-Body, nicht inline.
- `frontend/src/components/SettingsPage.tsx:330` — neuer Kommentar nennt #1080 statt #1085: Finding 4 🟡.

## Annahmen
- Playwright `click()` auf nativ deaktiviertem KolInputCheckbox-Input läuft in den
  Actionability-Timeout („element is not enabled") → Spec wird rot; beim Fixup-Nachweis per
  CI-Shard verifizieren (Zeitpunkt Review: e2e-Shards 1+3 noch pending).
- AK-Lage „kein KI-ANALYSE-Block = Issue-Body massgeblich" ist die richtige Auslegung von
  SKILL.md Schritt 1 (Legacy-Fallback auf Analyse-Kommentar greift nicht, da keine existieren).

## Verworfen
- needs-human / Entscheidungs-Finding: nein — die Produktfrage (ausblenden vs. disabled) hat das
  Issue selbst entschieden („mindestens disabled"); PR folgt ihr.
- Weiteres Jagen der pending e2e-Shards: kein Erkenntnisgewinn, die Vertrags-Widerlegung steht
  unabhängig vom Shard-Ergebnis fest.

## Offen
- Fixup-Runde: Findings 1–4 aus dem Sammelkommentar abarbeiten; danach Fixup-Nachweis
  (Delta-Review ab updatedAt des Sammelkommentars).

## Nächster Schritt
- Fixup-Nachweis: nur neuer Diff + Abhaken der 4 offenen Findings; Sammelkommentar
  (issuecomment-5448857670) per PATCH aktualisieren, Behobenes in die History-Tabelle verschieben.

## Fallstricke
- Der AI-Sammelkommentar muss per PATCH auf derselben Comment-ID aktualisiert werden — nicht
  neu erstellen (Marker-Suche über `issues/1087/comments`).
- Inline-Anker nur auf Diff-Zeilen möglich: App.tsx und ai-disable.spec.ts liegen ausserhalb des
  Diffs — solche Findings gehören in den Review-Body/Sammelkommentar, nicht inline.
- PR-Titel wurde von mir umbenannt (englisch, konform) — beim Fixup nicht wieder zurück auf den
  deutschenSetTitle fallen.
