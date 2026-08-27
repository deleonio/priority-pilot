# Issue 1055 — Triage-Phase (abgeschlossen 2026-08-27)

## Erledigt
- Erst-Triage: Body + alle Kommentare gelesen (1 Autor-Kommentar: „Ermittel eine granulare
  wertvolle Optimierung und gib mir deinen Plan." → Scope auf EINE Optimierung eingeengt).
- Audit-Behauptungen am Repo verifiziert: `.claude/skills/impeccable/` existiert NICHT
  (ls-Fehler); review.md-Passagen stimmen zeilengenau (L15-16, L17-20, L24-29, L49-52);
  Referenz-Ziele in `.claude/skills/review-kreuzverhoer/SKILL.md` vorhanden
  (Step 2 = L42 inkl. Test-Pflege L52 + KoliBri-Bullet L53; Step 5 = L102 ff. inkl.
  Diff-Scoping updatedAt/committedDate/git diff L134-139; Sammelkommentar-Struktur L140).
- Analyseblock + Routing-Tabelle in den Issue-Body geschrieben (stand=2026-08-27T05:19:18Z,
  Marker per grep verifiziert: 4 neue + 1 alte Erwähnung im Audit-Text selbst).
- Titel geändert (1 Edit, substantiell): „ci: Prompt-Audit — review.md auf SKILL.md-Referenzen
  trimmen (2026-08-27)" — alter Titel („Phasen-Prompts optimieren", plural) war nach der
  Scope-Einengung auf eine Optimierung zu breit.
- Labels: `ai:needs-analyse` entfernt; `ai:analysed`, `ai:needs-impl`, `ai:model:sonnet`
  gesetzt (Konvention gegen checks an #1033/#1042 verifiziert: ai:analysed + Trigger +
  ai:model:<impl-klasse>, ohne ai:needs-analyse).
- KEIN Ping-Kommentar (eindeutiges Ergebnis), KEIN autonomes Schließen (review.md ist
  ungetrimmt — Passagen stehen noch alle drin).

## Relevante Stellen
- `.github/prompts/review.md` — DIE Änderungsdatei der Impl-Phase; zu ersetzende Passagen:
  L15-16 (Kreuzverhör-Fragen+Regression), L17-20 (2.5 KoliBri-first), L25-29 (Fixup-Modus
  Schritte 2-5), L49-52 (VERDICT-Einleitung). Vorlage fürs Referenz-Muster: L39.
- `.claude/skills/review-kreuzverhoer/SKILL.md` — Referenz-Ziel der neuen Verweise
  (step 2 / step 5); Zeilen siehe Erledigt.
- `.github/prompts/` — gesamter Prompt-Korpus (8 Dateien, ~22,8 kB), Kontext des Audits.
- `.ai-memory/MEMORY.md` — Lernings zu gh-body-files (Write unter .ai-memory + body-file)
  und Heredoc-Falle; hier befolgt.

## Annahmen
- „EINE granulare wertvolle Optimierung" = Hebel 1 der ticket-eigenen Rangfolge (review.md
  trimmen, ~1,2 kB) — vom Autor-Kommentar gedeckt, da das Audit ihn selbst als größten
  Einzelhebel ausweist.
- Hebel 2-7 (triage.md-Widerspruch, toter Impeccable-Pfad, ux/spec/implement/fixup/
  documenter/memory-write-Kürzungen) sind bewusst NICHT Scope; ggf. Folge-Issues.
- `ai:model:sonnet` entspricht der impl-Zeile der Routing-Tabelle (Workflow setzt das
  Kompatibilitätslabel laut SKILL Schritt 4 — hier von Triage direkt mitgesetzt, wie die
  Konvention an #1033/#1042 zeigt).

## Verworfen
- Issue-Split (Skill Schritt 3): nach Autor-Einengung auf eine Optimierung nicht mehr
  oversized — eine Datei, ein PR.
- Kopftext-Lektorat des Bodies (Skill Schritt 2): Audit-Report ist strukturiert und sauber;
  pro-forma-Edit ohne substanzielle Änderung unterlassen (Skill-Regel).
- needs-human: keine relevante Mehrdeutigkeit — die Ranking-Frage („welche Optimierung?")
  beantwortet das Audit selbst.

## Offen
- -

## Nächster Schritt
- Impl-Phase (Label `ai:needs-impl` gesetzt): review.md gemäß AK1 kürzen — vier Passagen
  durch Einzeiler-Verweise auf SKILL.md step 2/step 5 ersetzen, AK2-Funktionszeilen
  unangetastet lassen, nur diese eine Datei ändern.

## Fallstricke
- Die Verdict-Kanäle und Marker-Strings in review.md sind maschinengelesen (Workflow 05
  parst /tmp/claude-verdict + <!-- ai-review -->) — beim Kürzen KEINEN Token/Marker
  ankratzen (AK2-Liste im Issue-Body ist die Checkliste).
- L39 des heutigen review.md zeigt das Ziel-Muster; nicht versehentlich auch diese
  bereits korrekte Zeile „optimieren".
- Der Issue-Body enthält eine alte wörtliche `<!-- KI-ANALYSE:START -->`-Erwähnung im
  Audit-Text (triage.md-Abschnitt) — beim Re-Parsen nicht mit dem echten Block verwechseln;
  der echte Block steht am Ende nach `---`.
- Temp-Dateien `.ai-memory/issue-1055-{raw,block,final}.md` konnten nicht gelöscht werden
  (rm brauchte Freigabe) — gitignored, koennen bei Gelegenheit weg.
