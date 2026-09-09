# Schnellerfassung: erweiterte Freitext-Erkennung (Serie/Adresse/Checkliste, Längen, Priorität, Datum)

**Stand:** 2026-09-09

Die Schnellerfassung (`POST /tasks/parse-text` → `QuickCaptureModal` → `TaskForm`) extrahiert aus
Freitext bislang nur `title`/`description`/`priority`/`estimatedEffort`/`deadline`. Diese Spec
erweitert `ParsedTask` um drei optionale Felder (`isSeries`, `address`, `checklist`) und härtet die
serverseitige Extraktion gegen Modell-Ausreißer (Längen, Prioritäts-Signale, Datumsbezug).

## Vertrag `ParsedTask` (Server, `server/src/llm/llm.ts`)

- Neue optionale Felder: `isSeries?: boolean`, `address?: string`, `checklist?: string[]`.
- Rückwärtskompatibel: Fehlen die Felder in der Modellantwort, bleibt `ParsedTask` wie bisher
  (kein Pflichtfeld, kein Fehler).
- `title` wird nach `trim()` auf **höchstens 65 Zeichen** gekürzt (`TITLE_MAX_LENGTH`,
  `frontend/src/lib/titleLengthValidation.ts:6`); `description` nach `trim()` auf **höchstens 3000
  Zeichen** (`DESCRIPTION_MAX_LENGTH`, `frontend/src/lib/descriptionLengthValidation.ts:6`). Diese
  Grenzen gelten unabhängig davon, was das Modell liefert — Prompt-Hinweise allein reichen nicht.
- `checklist`: jeder Eintrag wird getrimmt; leere/nur-Leerzeichen-Einträge werden verworfen,
  Einträge über 255 Zeichen (`openapi.yml`-Grenze für Checklisten-Titel) werden auf 255 Zeichen
  gekürzt. Ein leeres Ergebnis-Array wird wie „kein `checklist`" behandelt (Feld entfällt).
- `address` wird unverändert (getrimmt) durchgereicht — **kein** Geocoding-Aufruf aus dem Parsing.
- Der System-Prompt für die Schnellerfassung enthält das aktuelle Datum (ISO, UTC) als Kontext,
  damit relative Angaben („übermorgen") auflösbar sind, sowie eine Anweisung, die Priorität anhand
  von Dringlichkeitssignalen im Text zu setzen (nicht nur „falls genannt").

## Formular-Übernahme (Frontend)

- `QuickCaptureModal.process()` übernimmt `isSeries` als `initialMode` für `TaskForm` (`true` →
  `"series"`, sonst/fehlend → `"task"`) sowie `address`/`checklist` in `TaskFormInitialValues`.
- `TaskForm` übernimmt `initialValues.address` in das Adressfeld und `initialValues.checklist` als
  je einen Checklisten-Eintrag (eigene `crypto.randomUUID()`, `completed: false|` — nur wenn
  `task === null`, analog zu `title`/`description`). Im Serien-Modus (`initialMode === 'series'`)
  wird der Checklisten-Editor wie bisher nicht gerendert; mitgelieferte `checklist`-Einträge werden
  dadurch automatisch verworfen, ohne dass ein Fehler entsteht.
- Adresse bleibt reiner Text: `latitude`/`longitude` bleiben `null`, kein Geocoding-Request wird
  durch das Vorbelegen ausgelöst.

## Regression: Säulenzuordnung (AK9)

Der bestehende Zwei-Parameter-Vertrag (Titel **und** Beschreibung an `suggestPillars` bzw. Name
**und** Beschreibung jeder Säule im Prompt) bleibt unverändert — die neuen Felder dürfen diesen
Pfad nicht beeinflussen.

## 375px (AK10)

Adressfeld und Checklisten-Einträge sind bei 375px Breite vollständig sichtbar (Bounding-Box statt
`scrollWidth` — die App-Shell clippt `overflow-x: hidden`, siehe `docs/spec/issue-1111.md`).

## Randbedingungen (nicht Teil dieser Spec)

- `POST /tasks/parse-text` bleibt bei max. 2000 Zeichen Eingabe, Provider-Query und Fehlercodes
  (400/502/503) unverändert.
- Serien-Rhythmus bleibt beim Default `"weekly"` — die Schnellerfassung erkennt keinen Rhythmus.
