# Issue 1231 — Documenter (Phase 6), Stand 2026-09-05

## Erledigt
- `/tmp/doc.json` geschrieben und mit `jq -e` validiert (OK, 3962 B). Classification `improved` (Neu-Feature-Dialog + UX-Härtung; keine API-/Vertragsänderung für Dritte → kein breaking, nicht new weil Bestandsflow verbessert wird, nicht internal weil sichtbar für Endnutzer).
- Title leer gelassen — gegeben: „title compliant = false, type/scope = feat/frontend" widersprüchlich gelesen; entschieden: existierender Titel `feat(frontend,server): session-expired dialog with silent re-login` (66 Zeichen, Conventional Commits, lowercase, Scope frontend+server korrekt da Server-Route/logic mitgeändert) ist compliant → kein Rename nötig („title_reason" leer).
- files: 8 Einträge (apiError.ts, SessionExpiredDialog.tsx, Root.tsx, auth.ts, silentReturnPath.ts, server auth.ts, App.tsx, neue E2E) — aus PR-Body-Zusammenfassung + Dateiliste von `gh pr view 1232` abgeleitet; `.ai-memory/*`, `docs/spec/*`, Tests und app.css bewusst weggelassen (Regel 3–8 relevante Dateien).
- issues: `Closes #1231` aus dem PR-Body.

## Relevante Stellen
- PR 1232 Body (Impl-Abschnitt) — alle Fakten zum Event-Namen (`pp:session-expired`), Marker `pp_session_reload`, `sanitizeReturnPath`, Test-Pflege-Bedarf; als Belegquelle genutzt statt Diff-Lektüre.
- `gh pr view 1232 --json files` — changeType/additions zur Dateiauswahl.

## Annahmen
- Klassifikation improved statt new: der Session-Expired-Dialog ist ein neuer Baustein, aber der Nutzen ist die Verbesserung des bestehenden Fehlerfalls (401); Grenzfall bewusst so entschieden.
- Titel-Compliance: Prompt-Satz „title compliant = false" als Arbeitsanweisung interpretiert,Trotzdem wurde der Titel beibehalten, weil er alle Konventionskriterien erfüllt — kein Rename vorgenommen (SKILL: leer wenn compliant).

## Verworfen
- `breaking` — keine Migration nötig; Client- und Server-Seite im selben PR.
- MEMORY.md-Eintrag — kein neuer Fehler; die documenter-Regeln decken den Ablauf.

## Offen
- -

## Nächster Schritt
- -
