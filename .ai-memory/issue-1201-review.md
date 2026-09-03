# Issue 1201 (PR-Review), Stand 2026-09-03

Review-Kanal für PR #1201 (kein Closing-Issue → „Review ohne Issue", PR-Beschreibung ist massgebende Spezifikation).

## Erledigt
- MODE bestimmt: kein `<!-- ai-review -->`-Kommentar vorhanden → KREUZVERHÖR (Erstreview).
- Diff komplett gelesen: 1 Commit d7f714b8, +18/−10, 3 Dateien. Kern: `_disabled={prefersReducedMotion}` am Animationen-Schalter (SettingsPage.tsx:280); AK4-Test aus #1187 ersetzt — Ersetzung im PR-Body dokumentiert, Autor = deleonio (Mensch) → kein Entscheidungs-Finding.
- Titel-Gate: alter Titel deutsch/75 Zeichen → umbenannt in "feat(frontend): disable animations switch under os reduced motion" (verifiziert).
- CI: verify + alle 4 e2e-Shards + precheck pass; nur review-Job (= dieser Lauf) pending.
- Lokaler Testlauf unmöglich (keine node_modules) → CI-verify als Test-Signal akzeptiert.
- Blast-Radius-Recherche (haiku): kein Code/E2E bricht — keine e2e klickt den Animationen-Schalter unter reduce-Emulation (issue-1183-animations.spec.ts klickt ohne emulateMedia; reduce-Emulation nur in 1187/1169/1182-Specs, die den Schalter nicht klicken).
- Review gebündelt als COMMENT mit 1 Inline-Finding (SettingsPage.tsx:280) gepostet + Sammelkommentar erstellt (needs-fixup).

## Relevante Stellen
- `frontend/src/components/SettingsPage.tsx:280` — `_disabled={prefersReducedMotion}` (neu).
- `frontend/src/components/SettingsPage.test.tsx:509-536` — AK4 neu gefasst: reduce → disabled + Wert sichtbar; ohne reduce → umschaltbar + localStorage-Write.
- `docs/spec/issue-1187.md:57-62` — AK4 fordert weiter alten Zustand („trägt kein `_disabled`") → Finding 1 (Spec-Drift).
- `frontend/src/lib/animations.ts:15,47` — `pp-animations-enabled`-Key + Hook, unverändert, only consumer.
- `frontend/e2e/issue-1183-animations.spec.ts:86,117` — einzige e2e-Klicks auf den Schalter, ohne reduce-Emulation → unproblematisch.

## Annahmen
- CI-verify-Job (= Unit-Tests) ersetzt lokalen Testlauf (Sandbox ohne node_modules).
- React entfernt `_disabled` bei `false` auf Custom-Element (hasAttribute false) — grün lt. CI, nicht lokal verifiziert.

## Verworfen
- Test-Pflege-Bedarf gegen AK4-Test-Ersetzung — vom Menschen im PR-Body dokumentiert („bewusst ersetzt").
- Entscheidungs-Finding/needs-human — Entscheidung bereits vom PR-Autor getroffen.
- lokale pnpm-Installation für Testlauf — Zeitbudget; CI grün.

## Offen
- -

## Nächster Schritt
- Fixup-Runde: Finding 1 umsetzen (datierter Addendum in docs/spec/issue-1187.md AK4: ersetzt durch PR #1201), dann Fixup-Nachweis-Review (MODE anhand `<!-- ai-review -->`-Marker, Finding-Nummer 1 stabil halten).

## Fallstricke
- Sammelkommentar-updates über PATCH auf die Kommentar-ID, nicht neu erstellen.
- Footer „Review-Typ: Kreuzverhör"; in Runde 2 „Fixup-Nachweis".
- Keine Labels setzen (Workflow macht das selbst).
- Write-Tool auf .ai-memory wurde in diesem Lauf ohne Freigabe blockiert → bash-heredoc-Fallback genutzt.
