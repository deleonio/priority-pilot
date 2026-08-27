# Issue 1051 — Review-Phase (Fixup-Nachweis Runde 1, 2026-08-27)

Verdict: needs-fixup (F1 weiterhin offen, jetzt Kalibrierungsproblem statt struktureller Fehler).
Inline-Kommentar gepostet (pullrequestreview-5037823457), Sammelkommentar aktualisiert
(issuecomment-5434668195, MODE=Fixup-Nachweis).

## Erledigt
- Modus bestimmt: `<!-- ai-review -->`-Marker vorhanden (Kommentar-ID 5434668195, updatedAt 2026-08-27T05:12:27Z) → Fixup-Verifikation, kein Neu-Kreuzverhör
- Fixup-Commits seit updatedAt ermittelt: `73023576` (Merge, kein Content) + `a5326b3f` (der eigentliche F1-Fix)
- Fixup-Diff geprüft (`git show a5326b3f`): app.css (`--pp-input-below`/`.voice-field--counter`), VoiceField.tsx (`counter`-Prop), TaskForm.tsx (Titelfeld markiert), neuer e2e-Test
- Struktur des Fixes verifiziert: korrekt nur der `_hasCounter`-Call-Site (TaskForm-Titel, TaskForm.tsx:742) markiert, Beschreibungsfeld (ohne `_hasCounter`) unverändert gelassen
- CI-Status geprüft (`gh pr checks 1054`): `e2e (4)` ROT — `voice-transcription.spec.ts:246` (AK10, #264, Bestandstest außerhalb des Fixup-Diffs) schlägt fehl: `Math.abs(buttonCenter-fieldCenter)` = 4.796875 > 4px-Toleranz
- Root Cause identifiziert: `--pp-counter-height: 1.5rem` (app.css:1291) ist ein geschätzter, nicht kalibrierter Default — trifft die reale KoliBri-Counter-Zeilenhöhe knapp nicht
- F1 NICHT als "behoben" verbucht (Gate-Regel: CI rot → kein 🟢/Resolved)

## Relevante Stellen
- `frontend/src/app.css:1279-1291` — Bottom-Anker-Formel + neuer `--pp-input-below`/`--pp-counter-height`-Mechanismus (Default 1.5rem = 24px, unkalibriert)
- `frontend/e2e/voice-transcription.spec.ts:246-273` — AK10 (#264), Bestandstest, prüft exakt dasselbe TaskForm-Titelfeld mit ±4px-Toleranz — deckt die Fehlkalibrierung auf; NICHT Teil des PR-1054-Diffs
- `frontend/e2e/issue-1051-header-toolbar-mic-align.spec.ts` (Fixup-Ergänzung, Zeilen ~130-163) — neuer F1-Test hat offenbar großzügigere Toleranz, deckt die 0.8px-Abweichung nicht auf
- CI-Lauf: https://github.com/deleonio/priority-pilot/actions/runs/33042924794 (Job e2e (4))

## Annahmen
- Die 4.796875-Abweichung ist rein durch den geschätzten `--pp-counter-height`-Wert verursacht, nicht durch Flakiness (Fehler ist deterministisch an der Zentrierungs-Formel, kein Timing-Test)
- `titleInput(page)` in voice-transcription.spec.ts referenziert exakt dieselbe Inputbox (`getByRole('textbox', {name:'Titel'})`) wie der neue F1-Test — beide messen dieselbe Geometrie, nur mit unterschiedlicher Toleranz

## Verworfen
- Neu-Kreuzverhör des Gesamt-PR — Modus ist Fixup-Verifikation, nur Fixup-Diff + offene Findings geprüft
- Eigene lokale e2e-Ausführung zur Nachmessung der realen Counter-Höhe — CI-Beweis (deterministischer Fehlbetrag) reicht als Evidenz, Zeitbudget

## Offen
- F1 weiterhin offen: `--pp-counter-height`-Default muss an der real gerenderten KoliBri-Counter-Zeilenhöhe kalibriert werden (nicht geschätzt), bis `voice-transcription.spec.ts:246` (AK10) wieder grün ist

## Nächster Schritt
- Nächste Fixup-Runde: `--pp-counter-height` korrekt kalibrieren (z. B. reale Zeilenhöhe im Browser messen statt 1.5rem zu schätzen), dann erneute Fixup-Verifikation (nur den neuen Diff + F1 prüfen)

## Fallstricke
- F1-Nummer bleibt stabil über alle Runden — nicht neu nummerieren, auch wenn der Fixup den Fehler nur teilweise behebt
- Der neue F1-e2e-Test im Fixup-Commit ist selbst NICHT scharf genug (Toleranz zu großzügig) — bei der nächsten Prüfung ggf. zusätzlich als Kollateral-Hinweis nennen, falls die Toleranz nicht verschärft wird
- CI-Rot-Gate strikt einhalten: 🟢 nur wenn sowohl Content als auch CI grün sind (SKILL.md „CI/quality gate als Precondition")
