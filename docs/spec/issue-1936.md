# Spec #1936 — Wissens-Einträge für die Säulenzuordnung

Quelle: KI-ANALYSE im Harness-Kommentar von #1936. Pro-Nutzer pflegen freie Wissens-Einträge; passende fließen in `POST /tasks/suggest-pillars` ein.

## Vertrag

- **Modell** `KnowledgeEntry` (`id`, `userId`, `text`, Zeitstempel), exportiert aus `server/src/models/index.ts`.
- **API** `GET/POST/PATCH/DELETE /knowledge-entries` (DTO `{ id, text }`; POST 201, PATCH 200 mit Body `{ text }`, DELETE 204). Datenisolation über `ownerScope` (fremd: 404). Text 1–500 Zeichen, höchstens 50 Einträge je Nutzer, sonst 400.
- **Paket**: neue FeatureId `knowledge_entries`, nur `pro`; Free/Plus erhalten auf allen Routen 403 `{ code: 'plan_required', feature: 'knowledge_entries', requiredPlan: 'pro' }`.
- **Relevanz** `selectRelevantKnowledge(entries, { title, description?, context?, pillars: { id, name }[] })` in `server/src/logics/knowledgeEntries.ts`: Kleinschreibung, Trennung an Nicht-Buchstaben, Wörter unter 4 Zeichen und Stoppwörter entfallen; Treffer bei gleichen ersten 5 Zeichen (kürzere Wörter: Gleichheit) mit einem Wort aus Titel, Beschreibung, Kontext oder Säulenname; höchstens 10.
- **Säulenzuordnung**: `ClassifyPillarsInput.knowledge?: { id, text }[]` (nur Pro mit passenden Einträgen); der Prompt enthält die Texte; die Antwort trägt `knowledgeEntryIds` (nur API, kein UI-Hinweis). Sonst keine Einträge, Nachrichtenfolge unverändert, `knowledgeEntryIds` fehlt oder ist leer.
- **Kontolöschung**: Einträge entfallen in derselben Transaktion.
- **UI** (Tab „KI“): `KnowledgeEntriesSection` (`api.listKnowledgeEntries/createKnowledgeEntry/updateKnowledgeEntry/deleteKnowledgeEntry`) listet, legt an, bearbeitet, löscht. Ohne Entitlement `knowledge_entries`: `PlanHint` statt Liste. 375 px ohne Überlauf, Touch-Ziele ≥ 44 px.

## Abdeckung

| AK  | Test                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------- |
| 1/2 | `server/src/express/knowledge-entries.test.ts`, `server/src/logics/plans.test.ts`                               |
| 3   | `server/src/logics/knowledgeEntries.test.ts`                                                                    |
| 4/5 | `server/src/express/suggest-pillars.test.ts` (Route + Prompt)                                                   |
| 6   | `server/src/express/delete-account.test.ts`                                                                     |
| 7   | `frontend/src/components/KnowledgeEntriesSection.test.tsx`, `frontend/e2e/issue-1936-knowledge-entries.spec.ts` |
| 8   | `frontend/e2e/issue-1936-knowledge-entries.spec.ts` (Bounding-Box, 375 px)                                      |
