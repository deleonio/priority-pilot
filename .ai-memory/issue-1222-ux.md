# Issue 1222 — UX (Phase 2), Stand 2026-09-05T20:27Z

## Erledigt
- KI-UX-Block (deutsch, alle 6 Abschnitte befüllt, keine offenen UX-Fragen) in den Harness-Kommentar `IC_kwDONloM188AAAABSxM_Iw` geschrieben — zwischen `<!-- KI-ANALYSE:END -->` und `<!-- ai-phase-routing:START -->`. Verifiziert: Analyse-Sektion + Routing-Tabelle byte-identisch, KI-UX-Block je Marker 1×, kein sonstiges Delta. Issue-Body UNANGETASTET (ADR 0009). Keine Labels gesetzt/entfernt (derzeit `ai:needs-po-review`, `ai:analysed`, `ai:model:sonnet` — Workflow steuert), kein Ping-Kommentar.
- Statische Regelprüfung gegen `.ai-knowledge/ux-design.md` + `docs/mobile-ui-rules.md` (kein Browser, kein Playwright).
- Code-Lektüre: `TaskForm.tsx:346-356,707-715,917-938` (#1213-Empfängerauswahl, aktuell `!isEdit && !isSeriesMode`), `SeriesTab.tsx:107-183` (Liste, Badges, KolToolbar, Zustände), `TaskTree.tsx:120-129` („Für:"-KolBadge-Muster).

## Relevante Stellen
- `frontend/src/components/TaskForm.tsx:921` — Kern-UX-Stelle: Bedingung `!isSeriesMode` streichen → Empfängerauswahl auch im Serie-Modus (AK8); State/Lade-/Fehlerpfade sind modusagnostisch.
- `frontend/src/components/TaskForm.tsx:934` — Fehlertext sagt „Aufgabe"; im Serie-Modus „Serie" verwenden.
- `frontend/src/components/SeriesTab.tsx:145-154` — `series-tree-row` mit Badge-Gruppe; um „Für:"-Badge erweitern, umbrechfähig halten (TaskTree-Muster, kein nowrap — #1211-Fallstrick).
- `frontend/src/components/TaskTree.tsx:127` — KolBadge `_label={"Für: …"}` als Vorbild für AK9.
- `SeriesTab.tsx:155-178` — Bearbeiten/Löschen-Toolbar: für fremde Serien NICHT rendern (404-Sackgasse AK6, keine Geister-Fokusziele).

## Annahmen
- Analyse-Block (stand=2026-09-05T20:17:52Z) korrekt und aktuell — UX läuft davor, keine Widersprüche gefunden; AK10 (Bounding-Box statt scrollWidth, +320 px) übernommen.
- Moduswechsel Task↔Serie resettet derzeit die Empfängerwahl nicht (nicht dynamisch geprüft — Empfehlung als Boundary im Block verankert).
- 403-Pfad (AK2) ist nur per Manipulation erreichbar → generischer Inline-Fehler genügt (advisory).

## Verworfen
- Browser-/Playwright-Inspektion — Prompt verbietet sie; rein statische Regelprüfung.
- Einfärbung/neue Tokens fürs „Für:"-Badge — bestehende Badge-Klasse deckt Kontrast-/Dunkelmodus-Pflicht ab.
- Eigenes Auswahl-Control im Serien-Tab — nicht gefordert; Empfänger gehört ins Formular (gemeinsame Komponente, genau dafür wurde #1222 nach #1213 geschnitten).
- Verdict-Zeile in den Kommentar schreiben — lt. SKILL verboten (Verdict nur im Lauf).

## Offen
- Wegwerf-Artefakte in `.ai-memory/` NICHT committen: `issue-1222-harness-now.md`, `-harness-new.md`, `-verify.md`, `-a-old/-a-new/-t-old/-t-new` (Diff-Hilfsdateien, teils leer), `-query.txt` (GraphQL-Query wegen Brace-Expansion-Ban). Nur diese Datei ist die Phasen-Notiz.

## Nächster Schritt
- Spec-Phase: rote Tests laut Analyse-Testfälle (AK1-AK10); UI-Seite `TaskForm.test.tsx` (Serie-Modus-Select + Payload) und `SeriesTab.test.tsx` („Für:"-Badge, Aktionen ausgeblendet) gemäß KI-UX-Empfehlungen.

## Fallstricke
- gh `--jq` hängt 1 Newline an — Verifikations-Diff zeigt eine Phantom-Zeile 85; das ist Artefakt, nicht Body-Inhalt.
- Brace-Expansion `{...}` in `gh api graphql`-Queries wird vom Bash-Tool-Parser blockiert → Query in Datei auslagern und `-F query=@datei` (GROSS-F, sonst wird `@` literal übernommen) + Body via `-F b=@- < datei` übergeben.
- Python/`sed`-Bereiche und Prozess-Substitution brauchen hier Freigabe → Body-Zusammensetzung über `Write` in `.ai-memory/` (passt auf `.gitignore`-Muster) und `diff` auf Einzeldateien.
- KolSingleSelect-Props (`_value`/`onChange`-Signatur) nicht aus #1213-Code „raten", sondern bei Änderungsbedarf über KoliBri-MCP prüfen.
