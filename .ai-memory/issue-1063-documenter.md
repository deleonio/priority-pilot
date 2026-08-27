# Issue 1063 — Documenter (PR #1064)

## Erledigt
- PR-Diff geladen (gh pr diff 1064): 877 Zeilen, 15 Dateien (Modell/Migration/API/Logik/OpenAPI/TaskForm/GeoBadge/SeriesTab/CompletedTasksTable/CSS + Spec + Tests).
- PR-Metadaten geladen (gh pr view 1064): Titel `feat(server): add series address field and geo badges in lists`, Author app/my-github-action-bot, Label ai:reviewed, Body mit Umsetzungstabelle und Gate-Ergebnissen.
- Issue 1063 geladen (gh issue view 1063): Kontext zu Problemstellung, Entscheidung (Option B), AK1–AK6, UX-Block (KI-UX:START bis KI-UX:END).
- Analyse durchgeführt: Titel ist compliant (Conventional Commits, English, lowercase, ≤72), Type=feat passt (new feature, nicht improved), Classification=new (neue Funktionalität: Badge + Series-Address-Feld).
- JSON-Struktur vorbereitet: classification=new, title="" (compliant=true), summary_en/de (3–5 Sätze), release_note_en (End-User-Fokus), migration_en="" (kein breaking), files (8 relevante Dateien), issues (Closes #1063).

## Relevante Stellen
- `server/src/models/series.ts` — address?: string | null, Spaltendefinition nullable VARCHAR(255).
- `frontend/src/components/GeoBadge.tsx` — neue Icon-only-Komponente, Font-Awesome-Globus, aria-label, data-testid="geo-badge".
- `frontend/src/components/SeriesTab.tsx` — Badge in series-tree-row hinter Rhythmus-Badge (nur bei address).
- `frontend/src/components/CompletedTasksTable.tsx` — Badge in Titel-Zelle per renderIntoCell.
- `frontend/src/components/TaskForm.tsx` — Adressfeld im Serie-Modus, Payload/Caskade erweitert.
- `server/src/express/routes/series.ts` — validateSeriesFields, serializeSeries, Kaskade (applyToInstances).
- `server/src/logics/series.ts` — generateDueInstances vererbt address als Snapshot.
- `openapi.yml` — Series/SeriesCreate/SeriesUpdate um address erweitert.

## Annahmen
- Titel ist compliant (feat(server), lowercase, ≤72) → title bleibt leer.
- Classification=new (Badge-Funktionalität + Series-Address-Feld sind neu, nicht nur Verbesserung bestehender Features).
- Kein breaking → migration_en bleibt leer (Datenmodell-Änderung ist additive Spalte, keine API-Kontrakt-änderung bestehender Felder).

## Verworfen
- Classification=improved — zwar erweitert es bestehende UI, aber das Series-Address-Feld ist neues Datenmodell, new ist treffender.
- Classification=breaking — Spalte ist nullable, kein API-Contract-Bruch, bestehende Clients funktionieren weiter.

## Offen
- Write-Permission für /tmp/doc.json steht noch aus — JSON ist vorbereitet, konnte noch nicht verifiziert werden (jq . /tmp/doc.json).

## Nächster Schritt
- Nach Permission-Erteilung: /tmp/doc.json schreiben, mit jq verifizieren, Phase abschließen.

## Fallstricke
- JSON-Struktur muss exakt SKILL.md entsprechen (classification, title, summary_en, summary_de, release_note_en, migration_en, files[], issues[]).
- files: 3–8 Einträge, path+note_de (not_de ist das Feld, NICHT note).
- issues: ref ("Closes #1063") + note (Kurzbeschreibung).
- Bei title="" muss title_reason auch "" sein (nur gesetzt, wenn title neu verfasst wird).
