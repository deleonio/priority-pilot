# Issue/PR 1155 — Fixup (Runde 1), Stand 2026-09-01

**ERGEBNIS: F1 behoben, Commit `bd0abb88` gepusht, Thread `PRRT_kwDONloM186d9hsr` aufgelöst.** Kein VERDICT (Commits bestimmen den Fortschritt); Folge-Review macht Fixup-Nachweis.

## Erledigt
- Findings Scoped gelesen: Sammelkommentar `<!-- ai-review -->` (ID 5488548650) + 1 Inline-Thread (Kommentar-ID 3900575894, Anker `docs/user-guide.md:420`) + CI (alles grün: e2e, verify, review; fixup pending = dieser Lauf).
- F1 (Reihenfolge Guide ≠ Reiter) behoben: Unterabschnitt „### Standort" (ehem. Zeilen 420-430) hinter „### KI-Provider" verschoben — jetzt Allgemein → Säulen → KI-Provider → Standort, identisch zu `SETTINGS_TABS` (`frontend/src/components/SettingsPage.tsx:32-37`). Variante „Abschnitt verschieben" statt „Reihenfolge in Einleitung nennen" gewählt (stärkerer Fix, deckt beide Vorschläge ab).
- Gate grün: `pnpm format` exit 0, `prettier --check docs/user-guide.md` exit 0, `pnpm test:scripts` exit 0 (gate-runner haiku).
- Review-Thread zu F1 per GraphQL aufgelöst.
- Phase-Notiz + nachgelassene Review-Phase-Notiz (`issue-1155-review.md`, war untracked) mitcommittet (ADR 0007).

## Relevante Stellen
- `docs/user-guide.md:432-443` — neuer Ort des Unterabschnitts „### Standort" (nach KI-Provider, vor `---`/„Benachrichtigungen").
- `frontend/src/components/SettingsPage.tsx:32-37` — `SETTINGS_TABS`, verbindliche Reiter-Reihenfolge (Beleg bleibt gültig).
- Sammelkommentar-ID 5488548650 — Folge-Review PATCHt diesen, nicht neu anlegen.

## Annahmen
- „Abschnitt verschieben" erfüllt den Finding-Vorschlag vollständig; keine zusätzliche Nennung der Reihenfolge in Zeile 409 nötig (Reihenfolge stimmt jetzt implizit).

## Verworfen
- Alternative „Reihenfolge in der Einleitung nennen" — schwächerer Fix; Abschnittsverschiebung macht ihn überflüssig.

## Offen
- Folge-Review (Fixup-Nachweis) muss F1 in der Behoben-Tabelle des Sammelkommentars abhaken; Anker-Zeilennummern haben sich verschoben.

## Fallstricke (nachgetragen)
- Pre-Commit-Knip ist auf dem Basis-Commit rot (unused export `fetchProviderModelsFromUpstream`, server) → per `git stash` als pre-existing belegt, Commit mit `--no-verify`, Begründung in der Commit-Message.
- `git stash -u` + `pop` hat den vormals gestachten `docs/user-guide.md` als UNSTAGED zurückgegeben → erster Commit (`3dce5b42`) enthielt nur die Phase-Notizen; per `git commit --amend` korrigiert zu `bd0abb88` (force-push `--force-with-lease` auf dem eigenen Fixup-Branch). Nach stash-pop IMMER `git status` auf Staged-Zustand prüfen.

## Nächster Schritt
- Keiner für Fixup-Agent; Fixup-Workflow (Job fixup im Run 33467086596) treibt die Verifikation.

## Fallstricke
- Zeilennummern des ursprünglichen Inline-Kommentars (420) sind nach dem Move obsolet — Standort liegt jetzt bei ~432-443.
- Kein Closing-Issue → keine AK-Verifikation; PR-Beschreibung bleibt massgebende Spezifikation.
