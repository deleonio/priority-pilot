# Review PR #1061 — Adressfeld + Forward Geocoding fuer Aufgaben

MODE: Runde 2 = FIXUP VERIFICATION (ai-review-Marker vorhanden, Comment 5441983273).
Kein Closing-Issue → **Review ohne Issue**, PR-Beschreibung massgebend (Zeile 2 des
Sammelkommentars traegt den Hinweis, in beiden Runden).

## Erledigt

- Runde 1 (Kreuzverhör): siehe Git-History dieses Files — 4 Findings F1–F4, Review 5043062314,
  Sammelkommentar 5441983273, Verdict needs-fixup. Titel-Gate bereits erledigt
  (`feat(server): add task address field with forward geocoding search`, CC-konform).
- Runde 2: Delta-Review nur Commit f215c176 (einziger Commit seit Runde 1, `git diff 7fdf7984..f215c176`).
- F1 ✅ `useAddressSearch.test.ts` NEU, 4 Tests mit Biss (Mock-Aufruf-Zahl, `signal.aborted`,
  Deferred-Spaetantworten verworfen). F2 ✅ `isNominatimRateLimited()` auf Modulebene, geteilte
  `rateLimitMap`, Cross-Route-Test in `geocode-search.test.ts` (afterEach-fetch-Restore deckt den
  neuen Wrapper mit, `savedFetch`-Mechanismus in Dateikopf). F3 ✅ Cleanup-abort + `.then`-Guard +
  `loading` als `_hint` in TaskForm. F4 ✅ 375px-e2e mit `page.route`-Stub + Bounding-Box-Checks.
- Keine neuen Findings im Fixup-Diff (auch Konventions-Check: `as typeof fetch` und `!`-Assertions
  folgen dem bestehenden Muster der jeweiligen Datei — nicht finding-wuerdig).
- CI auf f215c176: verify pass, e2e 1–4 pass, precheck pass („review" pending = dieser Lauf selbst).
- Sammelkommentar 5441983273 per PATCH auf `reviewed` aktualisiert (Body in
  `.ai-memory/issue-1061-collected-r2.md`), F1–F4 in „✅ Behobene Anmerkungen" verschoben,
  Nummern unveraendert. Footer: `Review-Typ: Fixup-Nachweis · Updated: 2026-08-27`.
- Verdict: **reviewed** (/tmp/claude-verdict + letzte Ausgabezeile).

## Relevante Stellen

- `server/src/logics/nominatim.ts` — geteilter Rate-Limiter (F2-Fix).
- `server/src/express/geocode-search.test.ts:96ff` — Cross-Route-Test „Reverse nach Suche gedrosselt".
- `frontend/src/lib/useAddressSearch.ts` — abort-Guards in `.then` + Cleanup-abort.
- `frontend/src/lib/useAddressSearch.test.ts` — Hook-Vertrag (4 Tests).
- `frontend/src/components/TaskForm.tsx:274,891` — `addressLoading` → `_hint`.
- `frontend/e2e/issue-1061-task-address.spec.ts` — 375px-Layout-Test.
- `.ai-memory/issue-1061-collected-r2.md` — aktualisierter Sammelkommentar-Body (Quelle fuer PATCH).

## Annahmen

- e2e-Shard-Zuordnung: neues Spec lief in einem der 4 gruenen e2e-Shards (Fixup-Phase meldet
  2× lokal gruen; einzelne Shard-Zuordnung nicht verifiziert — Zeitbudget).
- `_hint` als KolCombobox-Prop laut Fixup-Phase per kolibri-mcp spec geprueft; nicht erneut verifiziert.

## Verworfen

- Neue Inline-Kommentare in Runde 2 — keine neuen Findings; Fixup-Phase hat die Runde-1-Threads
  bereits beantwortet + resolved (Reply-IDs siehe issue-1061-fixup.md).
- MEMORY.md-Eintrag — kein neues, uebertragbares Versagen (der PATCH-Zwischenfall war reiner
  Bedienfehler, keine strukturelle Luecke; Loesung „Body per Datei + `-F body=@file`" steht hier).

## Offen

- Nichts. Review abgeschlossen mit `reviewed`.

## Nächster Schritt

- Keiner aus Review-Sicht. Workflow uebernimmt Label/Weiterleitung (Labels NICHT selbst setzen).

## Fallstricke

- **NICHT** „Struktur-Probes" mit gh PATCH ausfuehren — ein PATCH mit Placeholder-Body
  ueberschreibt den Live-Kommentar sofort (ist passiert; binnen Sekunden mit `-F body=@file`
  wiederhergestellt). APIs nur mit dem finalen Body aufrufen.
- `--jq '{updatedAt}'` auf issues/comments liefert null — fuer Delta-Scoping stattdessen
  Commits per `gh pr view --json commits` gegen Runden-Bekanntstand pruefen.
- Sammelkommentar-Updates IMMER per `-F body=@<Datei>` (Body liegt in `.ai-memory/`); Klammern
  im Inline-Text brechen sonst den Bash-Parser.
