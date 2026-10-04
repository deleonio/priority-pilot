# Spec #1988 — Import-Analyse als Onboarding-Moment

## Ziel

Nach „N Aufgaben übernehmen“ zeigt die Import-Karte (`/settings/import`) statt der nackten
Erfolgs-Meldung einen Bericht: Anzahl der übernommenen Aufgaben, Aufgaben ohne Frist, exakte
Dubletten — jede Dublette einzeln zusammenführbar. Mit KI-Kontingent zusätzlich
Abhängigkeits-Vermutungen (dependentTaskId, dependingTaskId, Begründung), einzeln
übernehmbar/verwerfbar. Grundform (AK1–AK3) läuft ohne KI-Kontingent und ohne Plan-Merkmal
`ai_assist`.

## Endpunkte (neu, neben den Import-Routen, Muster `routes/taskImport.ts`)

- `POST /tasks/import/analysis` — Body wie `importTasks` (`{ csv, mapping? }`). Antwort:
  `{ total, missingDeadlines: [{id,title}], duplicates: [{keepTaskId,duplicateTaskId,title,reason}], suggestions: [{dependentTaskId,dependingTaskId,title,reason}] }`.
  Kein `requirePlanFeature('ai_assist')`, kein `meterAiQuota` im Grundpfad; nur der
  KI-Abhängigkeits-Teil nutzt den injizierbaren Analyzer (neues `AppDeps`-Seam
  `taskImportAnalyzer`, Muster `taskTextParser`) und degradiert still (Fehler/Erschöpfung →
  `suggestions: []`, Grundform bleibt vollständig). Dubletten-Erkennung: identisch
  normalisierter Titel (trim + lowercase), importiert↔importiert und importiert↔vorhanden,
  nur derselbe Nutzer.
- `POST /tasks/import/merge` — Body `{ keepTaskId, duplicateTaskId }` (beide Task-IDs desselben
  Nutzers). Entfernt die Dublette und übernimmt Frist/Priorität in den verbleibenden Task, falls
  dort fehlend. Genau ein Task bleibt übrig.

## UI (TaskImportCard, Erfolgszweig)

Bericht ersetzt die Erfolgs-Meldung: Abschnitte Anzahl, „ohne Frist“, „Dubletten“, KI-Vorschläge
(asynchron nachgeladen, KolSpin + eigener Fehlerzustand; Progressive Enhancement). Je Vorschlag
zwei Aktionen mit Objekt im accessible name (z. B. „Dublette ‚Einkaufen‘ zusammenführen“).
Dubletten-Merge → `POST /tasks/import/merge`; Abhängigkeits-Übernehmen → bestehender
`POST /tasks/:id/dependencies` (Zyklus-Ablehnung 409 inline am Vorschlag als KolAlert error,
Vorschlag bleibt erhalten); Verwerfen entfernt den Vorschlag aus der Liste. Fokus landet auf der
Berichts-Überschrift; bei 375 px einspaltig ohne horizontales Scrollen.

## Abgrenzung

- Zyklus-Schutz des bestehenden Dependencies-Endpunkts ist bereits getestet
  (`api.test.ts:651`) — hier kein Duplikat (Dedup TF5).
- Merge-Feinregeln über Frist/Priorität hinaus (z. B. Beschreibungen) sind nicht Teil dieser Spec.

## Testfälle

- TF1 (AK1/AK5/AK6-UI) → `TaskImportCard.test.tsx`: Bericht mit Anzahl/Fristen-Liste/Dubletten,
  Merge-Aktion ruft `mergeTaskImportDuplicate`, Vorschläge übernehmbar/verwerfbar.
- TF2 (AK2) → `taskImportAnalysis.test.ts`: Normalisierung; importiert↔importiert,
  importiert↔vorhanden, Fremdkonto bleibt außen vor.
- TF3 (AK3) → `taskImportAnalysis.test.ts`: 200 mit voller Grundform ohne `ai_assist`-Plan.
- TF4 (AK4) → `taskImportAnalysis.test.ts`: Fake-Analyzer liefert Vorschläge mit Begründung;
  Analyzer-Fehler → 200 + Grundform + leere `suggestions`.
- TF5 (AK5-API) → Dedup: Zyklus-Ablehnung durch `api.test.ts:651` gedeckt; Rest (409-Meldung
  inline) über TF1/e2e.
- TF6 (AK6-API) → `taskImportAnalysis.test.ts`: Merge lässt genau einen Task übrig, Frist/
  Priorität der Kopie übernommen.
- TF7 (AK7) → `frontend/e2e/issue-1988-import-report.spec.ts` (375 px): Bericht sichtbar,
  Übernehmen/Verwerfen bedienbar ohne horizontales Scrollen.
