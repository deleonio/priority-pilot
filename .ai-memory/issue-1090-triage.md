# Issue 1090 — Triage (Phase 1), Stand 2026-08-28

**ERGEBNIS: VERDICT needs-human.** Issue = fertiger Prompt-Audit (13 Dateien, Funde Rang 1–12, Optionen O1/O2/O3), Abschnitt „Entscheidung" reserviert die Optionswahl ausdrücklich dem Menschen → kein Analyse-Block, stattdessen Entscheidungs-Kommentar + `ai:needs-human`.

## Erledigt
- Issue-Body gelesen (kein KI-ANALYSE-Block → Initial-Triage); **null Kommentare** vorhanden (Ausgabe von `gh issue view 1090 --json comments` leer).
- Alle 13 im Audit genannten Prompt-Dateien auf Existenz geprüft: `.github/prompts/{adr-sync,documenter,fixup,guide-sync,implement,memory-read,memory-write,prompt-audit,review,spec-sync,spec,triage,ux}.md` — komplettes Set vorhanden, Audit-Dateitabelle deckt das Verzeichnis 1:1 ab.
- Genau EIN Entscheidungs-Kommentar gepostet (issuecomment-5453093916), erste Zeile exakt `<!-- ai-triage-decision -->`; alle 4 offenen Fragen dort gesammelt (Optionswahl O1/O2/O3/Kombi/keine, PR-Aufteilung, O2-Scope, Nachweis-Form).
- Labels: `ai:needs-analyse` entfernt, `ai:needs-human` gesetzt. Workflow parkt das Issue bis zur menschlichen Entscheidung.
- Titel und Body unangetastet (Titel präzise; Body ist der Audit selbst — kein Copyedit, kein pro-forma-Edit).
- Kein Split durchgeführt (siehe Verworfen).

## Relevante Stellen
- `.github/prompts/spec.md`, `ux.md`, `implement.md`, `review.md`, `documenter.md` — O1-Ziele (Skill-Duplikate kürzen).
- `.github/prompts/spec-sync.md`, `guide-sync.md`, `adr-sync.md` + `.github/workflows/` der drei Sync-Läufe — O2-Ziele (Include `_sync-common.md`, Workflow-Cat erweitern).
- `.github/prompts/prompt-audit.md` — Rang-10-Fix (Aufzählung um adr-sync.md ergänzen), 5-min-Korrektheitsfix, Teil meiner Empfehlung.
- `.github/prompts/triage.md` — Rang 8 (Routing-Klammer) + Rang 11 (Ping-Kommentar-Override deklarieren).

## Annahmen
- needs-human ist korrekt obwohl O1 im Issue mit ⭐ empfohlen ist: „Der Mensch entscheidet, welche Option umgesetzt wird (oder keine)" ist eine explizit reservierte Entscheidung, keine technische Klärung, die Code-Lektüre lösen könnte.
- Nach der menschlichen Antwort läuft Re-Triage: Trigger = `ai-triage-decision`-Kommentar + alle danach folgenden Kommentare sind BINDEND (Prompt-Regel „Re-triage after needs-human").

## Verworfen
- Analyse-Block + Ampel schreiben — wäre eine geratene Optionswahl gewesen; Skill verbotet das bei nicht eindeutig auflösbaren Tasks.
- Split in O1/O2/O3-Sub-Issues — verfrüht: erst der Mensch wählt die Optionen; ein Split vor der Entscheidung präjudiziert sie (O2 würde z. B. evtl. gar nicht umgesetzt).
- MEMORY.md-Eintrag — kein neuer Fehler/noch nicht gelöste Erfahrung; Aufnahmekriterium (streng) nicht erfüllt.

## Offen
- `.ai-memory/issue-1090-decision.md` ist ein Wegwerf-Artefakt (Kommentar-Body, bereits gepostet als issuecomment-5453093916) und gehört NICHT in einen Commit; Löschversuch (`rm`) brauchte eine Freigabe, die nicht kam (wie schon 1083). Nur diese Datei hier (`issue-1090-triage.md`) ist die echte Phasen-Notiz.

## Nächster Schritt
- Warten auf menschliche Entscheidung im Thread; danach Re-Triage (nur Deltakommentare ab dem Entscheidungs-Kommentar lesen), Analyse-Block + Routing-Tabelle schreiben. Hinweis: Ticket hat KEINEN Application-Code (`server/src|frontend/src|e2e` unverändert) → Routing dann ux=nein, spec=nein (Begründung im Block), impl/review=ja; KEINE Testfälle in den AKs.

## Fallstricke
- Bei der Re-Triage nicht erneut needs-human fragen, wenn der Mensch die Option bereits gewählt hat — Entscheidung ist bindend.
- O1/O3 ändern `.github/prompts/*.md` = die eigenen CI-Prompts: der implementierende Agent schneidet den Ast, auf dem er sitzt — Änderungen wirken erst für Folgeläufe; kein Grund zur Vorsicht im Analyse-Block vergessen.
- `gh label list` braucht `--json` für `--jq` (ohne --json verweigert gh --jq).
