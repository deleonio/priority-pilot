# Fürsorge: KI-Vorschlag für Plus und Pro

**Stand:** 2026-09-29

## Ziel

`GET /scores/care-suggestions` (#1791) ergänzt bei einem Defizit für Plus und Pro **einen** KI-Vorschlag, der auf den bisherigen Aufgaben des Nutzers beruht. Free bleibt bei Bestand und Vorlagen.

## Ablauf

1. **Zuschaltung im Handler** nach `effectivePlan(user.plan)` (`plus`/`pro`), nicht per Middleware: Free bekommt weder 403 noch 429.
2. **Voraussetzung:** mindestens eine defizitäre Säule (`bewerteCareDefizit`). Ohne Defizit kein Aufruf, keine Buchung.
3. **Aufruf:** der injizierbare Berater (`AppDeps.activityAdvisor`, Typ `ActivityAdvisor`) erhält ausschließlich die eigenen Aufgaben (`ownerScope`) im Input.
4. **Ergebnis:** genau ein Eintrag `typ: 'ki'`, `anlass: 'defizit'`, `saeuleId`/`saeuleName` der ersten defizitären Säule, `titel` = Vorschlag, `beschreibung` = Begründung. Bestand/Vorlagen bleiben unverändert in der Antwort.
5. **Budget (#1783):** Buchung über `createAiQuotaCounter` (`book`/`refund`); ein erfolgreicher Vorschlag kostet genau einen Punkt.
6. **Tagesdeckel:** höchstens ein KI-Aufruf je Nutzer und Kalendertag; weitere Abrufe liefern den gespeicherten Vorschlag ohne Advisor-Aufruf und ohne Buchung (In-Memory, Schlüssel wie `fairUseKey` mit `createdAt`).

## Erwartetes Ergebnis

- Plus/Pro mit Defizit: Bestand + Vorlagen + 1× `ki`.
- Free, kein Defizit: unverändert, Advisor 0×, `AiUsage` unverändert.
- Advisor wirft: Status 200, kein Fehlerfeld, kein `ki`, Buchung zurückgenommen.
- Fair-Use-Drossel greift (`book()` = false): Status 200, kein `ki`, Advisor nicht aufgerufen.
- Anonyme Zählung #1798 bleibt auf `typ: 'vorlage'` beschränkt; kein Frontend-Umbau in diesem Ticket.
