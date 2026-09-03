# Issue 1201 (Fixup), Stand 2026-09-03

## Erledigt
- Finding 1 (Spec-Drift, unambiguously): datierter Addendum bei AK4 in `docs/spec/issue-1187.md:57-63`
  ergänzt — „Update 2026-09-03, PR #1201: AK4 ersetzt" (Schalter bei reduce deaktiviert, ohne
  reduce unverändert bedienbar); Historie nicht umgeschrieben, alter AK4-Text bleibt.
- `pnpm exec prettier --check docs/spec/issue-1187.md` grün (Docs-only-Change, sonstiger Gate
  nicht betroffen; kein Code geändert).
- Commit + Push auf `fix/animations-switch-disabled-on-reduced-motion`.
- Review-Thread `PRRT_kwDONloM186eyaFR` (SettingsPage.tsx:280) via GraphQL aufgelöst.

## Relevante Stellen
- `docs/spec/issue-1187.md:57-65` — AK4 + neuer Addendum-Absatz.
- `frontend/src/components/SettingsPage.tsx:280` — `_disabled={prefersReducedMotion}` (unverändert, nur Anker).

## Annahmen
- Bei Docs-only-Fix genügt prettier als Gate-Teil (SKILL step 3c zielt auf Code-Änderungen).

## Verworfen
- Umschreiben der AK4-Historie — Review verlangte ausdrücklich Addendum, keine Historien-Fälschung.

## Offen
- -

## Nächster Schritt
- Fixup-Nachweis-Review (nächster Lauf) prüft den Commit.

## Fallstricke
- Keine Labels setzen (Workflow).
- Sammelkommentar des Reviews nicht anfassen.
