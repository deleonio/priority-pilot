# Spec #935 — Säulen-Formular: Beschreibung als Textarea, Titel auf 30 Zeichen begrenzt

**Stand:** 2026-08-24  
Issue: #935 · Muster: `TaskForm.tsx` (Titel + Beschreibung)

## Ziel

Das Säulen-Formular (`PillarFormDialog.tsx`, Anlegen **und** Bearbeiten) bekommt für die
**Beschreibung** eine mehrzeilige `KolTextarea` statt des einzeiligen `KolInputText`, und das
**Namensfeld** wird — konsistent zu Aufgaben (#582) und Serienaufgaben — auf **30 Zeichen**
begrenzt.

## Vorbedingung

- `PillarFormDialog.tsx` rendert aktuell zwei `KolInputText` (Name, Beschreibung) in `.form-grid`;
  Werte liegen im `form`-Ref parallel zum State (Ctrl+Enter-Race), Submit trimmt und sendet
  `createPillar`/`updatePillar`. Dieses Verhalten bleibt unverändert.
- Sollwert-Quelle für die Länge: `frontend/src/lib/titleLengthValidation.ts` → `TITLE_MAX_LENGTH` (= 30),
  bereits von `TaskForm.tsx` via `_maxLength={TITLE_MAX_LENGTH}` verwendet.
- KoliBri: `kol-input-text` unterstützt `_maxLength` (Default-Verhalten `hard` → setzt das
  native `maxlength`-Attribut und kappt Eingabe). `kol-textarea` ist der etablierte Typ für
  Beschreibungen (TaskForm, Series-Form).
- Dedup: `pillar-crud.spec.ts` / `pillar-dynamic-cases.spec.ts` adressieren die Beschreibung nur
  über `getByRole('textbox', …)` (matcht Input **und** Textarea) und prüfen keine Längen­
  beschränkung — Elementtyp und maxlength sind ungedeckt, bestehende Tests bleiben gültig.
- UX (KI-UX-Block): einspaltige Dialogstruktur, Label bleibt sichtbar, Speichern bleibt
  Primäraktion, Validierung/Feedback unverändert (Name-leer-Alert existiert bereits).

## Schritte / Verhalten

1. **Beschreibung als Textarea (AK1):** Im Anlegen- **und** im Bearbeiten-Dialog ist das Feld
   „Beschreibung" eine `kol-textarea` mit innerem nativem `<textarea>` (mehrzeilige Eingabe
   möglich, Label „Beschreibung" bleibt). Das Namensfeld bleibt eine `kol-input-text` mit
   innerem `<input type="text">`.
2. **Mehrzeilige Beschreibung bleibt erhalten (AK1):** Eine mit Zeilenumbruch eingegebene
   Beschreibung wird gespeichert und steht nach Reload im Bearbeiten-Dialog wieder mit dem
   Zeilenumbruch im Textarea-Wert (Rundreise durch Create + Read).
3. **Name auf 30 Zeichen begrenzt (AK2):** Das Namensfeld übergibt `_maxLength={TITLE_MAX_LENGTH}`
   aus `titleLengthValidation.ts` (kein Literal im Dialog). Das gerenderte `<input>` trägt
   `maxlength="30"`, und Tastatur-Eingaben darüber hinaus werden hart gekappt (Browser-
   maxlength-Semantik, „hard"). Bestehende Tastatur-Ctrl+Enter- und Abbrechen-Abläufe ändern
   sich nicht.

## Erwartetes Ergebnis (Test-Vertrag)

E2E-Tests in `frontend/e2e/issue-935.spec.ts` (Feature/UI-Verhalten, echtes Backend):

| Test                                       | deckt | Erwartung                                                                                                                                                                                 |
| ------------------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Beschreibung ist eine KolTextarea"        | AK1   | Im Anlegen- **und** Bearbeiten-Dialog: Beschreibung = `kol-textarea textarea`, Name = `kol-input-text input`                                                                              |
| „Mehrzeilige Beschreibung überlebt Reload" | AK1   | Angelegte Beschreibung mit `\n` steht nach Reload im Bearbeiten-Dialog wieder zeilengenau im Textarea                                                                                     |
| „Name auf TITLE_MAX_LENGTH begrenzt"       | AK2   | `maxlength` des Name-Inputs = `TITLE_MAX_LENGTH` (Import aus `../src/lib/titleLengthValidation`, Sollwert aus führender Quelle); `pressSequentially` über die Grenze kappt bei 30 Zeichen |

Reines Styling (einspaltige Dialogstruktur, Abstände) ist nicht test-erzwungen.
