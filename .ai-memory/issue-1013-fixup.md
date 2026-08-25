# Fixup PR #1013 (docs(spec): sync specs to actual state 2026-08-25)

## Erledigt
- ALLES ERLEDIGT (Runde 1, 2026-08-25). Fix-Commit `efd9e5ee` auf `chore/spec-sync-all`
  gepusht (2229f324..efd9e5ee), Pre-Commit-Hook (format/knip/lint) grün.
- Finding #1 (Tab-Label-Drift) gefixt: docs/spec/issue-951.md Zeile 7 nun
  „…unter Einstellungen → Tab „KI-Provider“.“ (Klammerzusatz „(Bereich „KI-Provider“)“
  gestrichen — redundant, das Tab selbst heisst so, SETTINGS_TABS SettingsPage.tsx:27);
  Zeile 20: „Tab „KI-Provider“ ist geöffnet“.
- Thread PRRT_kwDONloM186b7uGj: Reply 3849533704 gepostet, Thread resolved (true).
- CI: alter verify-Fail auf 2229f324 war `prettier --check` auf docs/spec/user-journeys.md —
  mein Commit enthielt genau die Prettier-Neuausrichtung dieser Tabelle (aus pnpm format) →
  verify auf efd9e5ee GRÜN, alle 4 e2e-Shards grün. CI-Fix als Nebenprodukt, kein Rerun nötig.
- KEIN Verdict geschrieben (weder needs-human noch already-done): Commit bewegt HEAD,
  Review prüft neu. Keine Labels gesetzt.

## Relevante Stellen
- docs/spec/issue-951.md — einzige inhaltlich geänderte Datei (Zeilen 7, 20).
- docs/spec/user-journeys.md — nur Prettier-Tabellen-Ausrichtung (~Zeile 189–204), CI-Fix.
- frontend/src/components/SettingsPage.tsx:27 — SETTINGS_TABS, Quelle des echten Labels.

## Annahmen
- Streichung des Klammerzusatzes in Zeile 7 deckt sich mit Finding-Intention („beide Stellen
  zu Tab „KI-Provider“ korrigieren“).

## Verworfen
- CI-verify-Rerun — war ECHTER Format-Fehler, durch Commit behoben, kein FLAKY.
- MEMORY.md-Eintrag — nichts Nicht-Offensichtliches (git-identity-Fallstrick steht seit 08-23 drin).

## Offen
-

## Nächster Schritt
- Nichts. Abgeschlossen ohne Verdict; PR geht zurück ins Review (HEAD bewegt).

## Fallstricke
- git-identity musste gesetzt werden (Memory 08-23): `my-github-action-bot[bot]` <
  295279188+my-github-action-bot[bot]@users.noreply.github.com> — repo-lokal konfiguriert.
- Review-Phase hat PR-Titel auf „docs(spec): sync specs to actual state 2026-08-25“ geändert —
  nicht wundern, PR-Titel ≠ Branch-Commit-Message.
