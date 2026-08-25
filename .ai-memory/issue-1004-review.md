## Erledigt
- PR-Diff und Body gelesen: Test-only Change, erweitert E2E #930 AK2 um echte Tab-Navigation
- Issue-Verknüpfung: Closes #1004 (aus #945 Finding 2, critical)
- AK-Check im PR-Body geprüft: AK1 (Tab-Erreichbarkeit via Schleife), AK2 (Fokus-Indikator), AK3 (grüner Lauf), Mutations-Probe

## Relevante Stellen
- `frontend/e2e/issue-930-transparent-backgrounds.spec.ts:336-347` — Tab-Schleife statt `.focus()`
- `docs/spec/issue-1004.md` — Spec mit Ziel/Vorbedingung/Schritten/Erwartetes Ergebnis
- `.ai-memory/MEMORY.md:136-142` — neue Learnings: E2E/Shadow-Fokus, Git/Mutationsprobe

## Annahmen
- Auf `/` liegen vor dem ersten kol-button weniger als 15 fokussierbare Elemente (Banner-Logo/-Links) — ansonsten könnte der Test false-negativ werden
- `toBeFocused({timeout:150})` in try/catch ist ein Poll: Playwright prüft aktiv, keine bloße Rethrow-Wrapperei
- Die Mutations-Probe (`tabindex="-1"`) wurde lokal ausgeführt und macht den Test rot (laut PR-Body)

## Verworfen
- Kein Produktcode-Change, daher keine KoliBri-First-Prüfung nötig
- Keine weiteren E2E-Tests betroffen (Dedup-Check laut PR-Body)

## Offen
-

## Nächster Schritt
- Review abgeschlossen — keine Folgearbeit nötig (PR #1007 ist reviewed)

## Fallstricke
- Keine UI-Änderungen, nur Test — Regressionen sind theoretisch nur andere E2E-Laufzeiten
- Memory-Schreiben PFLICHT, nicht optional — zwischenspeichern bei jedem Schritt
- Die willkürliche Grenze von 15 Tabs ist in der Spec dokumentiert; für die aktuelle `/`-Seite konservativ genug (nur Banner-Logo/-Links davor). Bei Änderungen am Banner könnte dies angepasst werden müssen — ist aber ein Known Tradeoff, kein Finding.

## Ergebnis
- Review-Typ: Kreuzverhör (Erst-Review)
- Verdict: reviewed (🟢)
- Sammelkommentar gepostet: https://github.com/deleonio/priority-pilot/pull/1007#issuecomment-5404611275
- Keine Findings — der PR löst das adversariale Problem vollständig: Tab-Schleife mit `toBeFocused()` pierct Shadow DOM nativ, Mutation-Probe rot, alle AK erfüllt
