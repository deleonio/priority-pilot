# Issue 1004 — Spec-Phase (Tab-Fokus-Probe E2E #930 AK2)

## Erledigt
- Branch `feat/issue-1004-tab-fokus`, Spec `docs/spec/issue-1004.md`, Test-Umbau in
  `frontend/e2e/issue-930-transparent-backgrounds.spec.ts` (AK2-Test, ~Z. 336):
  `.focus()` → Tab-Schleife (max 15×) mit `expect(innerButton).toBeFocused({timeout:150})` im try/catch.
- Suite grün (7/7), ESLint grün, Mutations-Probe rot (tabindex=-1), Commit 94577de6 gepusht.
- Draft-PR erstellt (siehe gh pr view).

## Offen
- Nichts — Phase abgeschlossen.

## Nächster Schritt
- Impl-Phase: nichts zu tun (kein Produktcode nötig; Issue ist reiner Test-Fix, AK3 verlangt grünen Lauf — erfüllt).

## Fallstricke
- #824-ESLint-Guard verbietet `.shadowRoot`-Zugriff im E2E-Code → Playwrights `toBeFocused()`
  pierct nativ, das nutzen statt eigener activeElement-Kette.
- `git checkout --` nach sed-Mutationsprobe verwirft die EIGENE Änderung mit → Backup per `cp` nach /tmp.
- Commit-Hook läuft lint+knip; git-Ident musste lokal gesetzt werden (user.name/email).
