# Spec #1977 — Server: „Nicht jetzt" mit Begründung erfassen

**Issue:** #1977 · **Stand:** 2026-10-05 (Spec-Phase) · **Vertragstyp:** API-Vertrag (Server) + Interaktions-Vertrag (CareHint)

## Ziel

„Nicht jetzt" in der Empfehlungskarte snoozed heute die gesamte Karte bis Tagesende — ohne zu erfahren, warum. Künftig öffnet der Klick eine **optionale Inline-Grundauswahl in derselben Karte** (kein Modal, ersetzt die Aktionsreihe), der gewählte Grund wird **serverseitig je Aufgabe/Vorlage** gespeichert, die Karte zeigt sofort die nächste Empfehlung, und die Ablehnungs-Historie ist je Aufgabe abrufbar. Der Global-Snooze wird zum **Snooze je Vorschlag**.

## Feste Annahmen

1. `grund` ist ein sprachunabhängiger Enum-Wert (wie `templateKey`): `zu-gross`, `gerade-nicht-moeglich`, `keine-energie`, `warte-auf-jemanden`, `falsche-prioritaet`.
2. Bezug ist **genau eins** von `taskId` (eigene Aufgabe) oder `templateKey` (kuratierte Vorlage). KI-Vorschläge (`typ: 'ki'`, kein stabiler Schlüssel, #1873) behalten das heutige lokale Snooze-Verhalten **ohne Grundprompt**.
3. Neues Modell `CareSuggestionRejection` (`userId`, `grund`, `taskId?`, `templateKey?`, `abgelehntAm`), Muster `careSuggestionDismissal.ts`. Historie: mehrere Einträge je Aufgabe erlaubt (jede „Nicht jetzt"-Entscheidung wird erfasst, kein Upsert).
4. UI-Komponenten (KI-UX-Block): Gründe als `KolInputRadio` (`_orientation="vertical"`, `_label` = Legend „Warum nicht jetzt?"), „Grund speichern" als `KolButton _variant="secondary"`, „Ohne Grund überspringen"/„Abbrechen" tertiär; Karte bleibt `KolAlert`-Info, Krisenzeile sichtbar.
5. i18n-Keys (de-Texte in allen 10 Locales, bestehendes Muster): `care.reasonLegend`, `care.reason.tooBig/notPossible/noEnergy/waitingFor/wrongPriority`, `care.skip`, `care.cancel`, `care.saveReason` — Formulierungen entlang `docs/fuersorge-tonalitaet.md` (abwägend, nicht vorwurfsvoll).
6. Frontend-API-Erweiterung: `api.rejectCareSuggestion({ grund, taskId? } | { grund, templateKey? })` → `POST /scores/care-suggestions/rejections`, Antwort 204.

## Verhalten je Akzeptanzkriterium

### AK1 — Grundauswahl mit fünf Gründen plus Überspringen

**Voraussetzung:** CareHint zeigt einen Vorschlag (`typ: 'vorlage'` oder `'task'`).
**Schritte:** Klick auf „Nicht jetzt".
**Erwartetes Ergebnis:** Die Aktionsreihe wird **ersetzt** durch eine Radio-Gruppe (Legend „Warum nicht jetzt?") mit **genau fünf** Gründen (zu groß, gerade nicht möglich, keine Energie, warte auf jemanden, falsche Priorität) sowie den Aktionen „Ohne Grund überspringen", „Abbrechen" (kehrt ohne Snooze zu den Aktionen zurück) und „Grund speichern". Bis zur Auswahl kein Server-Call. A11y: Radio-Gruppe mit beschrifteter Legend, Options-Label = vollständiger Grundtext; Fokusführung beim Öffnen auf die Gruppe bzw. erste Option (Impl-Anforderung, nicht testgezähmt).

### AK2 — Persistierung mit Grund und Bezug

**Schritte:** Grund wählen + „Grund speichern".
**Erwartetes Ergebnis:** Genau ein `POST /scores/care-suggestions/rejections` mit `grund` + `taskId` (eigene Aufgabe) bzw. `templateKey` (Vorlage); Server persistiert den Eintrag **je Nutzer** (ownerScope). Ungültige Payloads antworten **400**: ohne `grund`, mit unbekanntem `grund`, ohne Bezug. „Ohne Grund überspringen" löst **keinen** Server-Call aus (nur lokalen Snooze).

### AK3 — Nachrücken ohne Reload, Snooze je Vorschlag

**Erwartetes Ergebnis:** Nach „Nicht jetzt" (mit oder ohne Grund) zeigt die Karte **ohne Reload** den nächsten nicht lokal unterdrückten Vorschlag aus der bereits geladenen Liste; ist keiner übrig, den Leerzustand (`care.empty`). Der gesnoozte Vorschlag bleibt **allein** bis Tagesende unterdrückt — ein Reload am selben Tag zeigt den nächsten, nicht die leere Karte; am Folgetag ist der Vorschlag zurück (Fehlerfall des Speicherns: bestehendes `role="alert"`-Feedback, Karte bleibt).

### AK4 — Abrufbare Historie

**Erwartetes Ergebnis:** `GET /scores/care-suggestions/rejections?taskId=<id>` liefert die Historie der eigenen Aufgabe (Einträge mit `grund`, `abgelehntAm`, aufsteigend); ohne Filter alle eigenen Einträge. Fremde Aufgaben/Einträge anderer Nutzer bleiben unsichtbar (leere Antwort, keine 403-Leak-Diskriminierung).

### AK5 — Bedienbarkeit bei 375 px

**Erwartetes Ergebnis:** Grundauswahl und Nachrücken sind im 375-px-Viewport bedienbar: Karte und Optionszeilen bleiben im Viewport (keine Überlagerung/Überlauf), Optionszeilen ≥ 44 px Touch-Höhe, vertikale Ein-Spalten-Liste.

## Testzuordnung

| TF  | AK        | Datei                                                  |
| --- | --------- | ------------------------------------------------------ |
| TF1 | AK1       | `frontend/src/components/CareHint.test.tsx`            |
| TF2 | AK2 (API) | `server/src/express/scores-care-suggestions.test.ts`   |
| TF3 | AK2/AK3   | `frontend/src/components/CareHint.test.tsx`            |
| TF4 | AK4 (API) | `server/src/express/scores-care-suggestions.test.ts`   |
| TF5 | AK5       | `frontend/e2e/issue-1977-care-rejection.spec.ts` (neu) |

**Test-Pflege-Bedarf:** Der #1793-AK4-Test („Nicht jetzt blendet bis Tagesende aus", `CareHint.test.tsx`) wird bewusst umgeschrieben — er fixiert den Global-Snooze, den dieses Ticket durch den Snooze je Vorschlag ersetzt (Analyse-Randbedingung).
