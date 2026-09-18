# Spec — Issue #1475: Feedback-Kategorien konsolidieren

Quelle: Harness-Marker-Kommentar (KI-ANALYSE), AK1–AK6. Ändert den Kategorie-Vertrag des
Feedback-Formulars aus [#1435](issue-1435.md) — vier Kategorien werden zu drei zusammengefasst.

## Ziel

Das Kategorie-Select des Feedback-Formulars bietet statt der bisherigen vier Optionen
(Fehler, Funktionswunsch, Idee, Frage) genau drei, in dieser Reihenfolge:

| Position | Label (Anzeige)   | Wert (Server-Vertrag, ASCII-Slug) |
| -------- | ----------------- | --------------------------------- |
| 1        | Fragen und Hilfe  | `frage`                           |
| 2        | Wünsche und Ideen | `wunsch`                          |
| 3        | Fehler melden     | `bug`                             |

Die Vorauswahl bleibt auf der Fehler-Kategorie (`bug`). Die internen Werte bleiben
ASCII-Slugs ohne Umlaute, weil sie in Dateinamen und YAML-Frontmatter des Obsidian-Repos
fließen. `feature` und `idee` entfallen: der Server lehnt sie danach bewusst mit 400 ab.
Bereits committete Feedback-Dateien im Vault werden nicht umbenannt.

## Server (`server/src/express/routes/feedback.ts`)

`CATEGORIES` enthält genau `frage`, `wunsch`, `bug`. `validateBody` antwortet für jeden
anderen Wert (insbesondere `feature`, `idee`, Fremdwerte) mit 400 — unverändert ansonsten:
`buildPath` baut `<dir>/<datum>-<kategorie>-<slug>-<zufall>.md`, `buildContent` schreibt
`kategorie: <wert>` ins Frontmatter, `buildAdminMail` nennt den Wert in Betreff
(`Neues Feedback (<wert>): <titel>`) und Text (`Kategorie: <wert>`).

## Frontend (`frontend/src/components/FeedbackForm.tsx`)

`FEEDBACK_CATEGORIES` enthält genau die drei Paare aus der Tabelle oben (Wert = Server-
Vertrag, Label = Anzeige, Reihenfolge wie in der Tabelle). Der Intro-Text beschreibt die
neue Aufteilung (Fragen, Wünsche, Fehler) und nicht mehr die alte Vierer-Formulierung
„Fehler, Wünsche, Ideen oder Fragen" im Sinne von vier Kategorien.

## Akzeptenzkriterien → Tests

- AK1: e2e `frontend/e2e/issue-1435-feedback.spec.ts` — Optionen des Combobox
  „Kategorie" exakt und in Reihenfolge, Vorauswahl `bug`.
- AK2: `server/src/express/feedback.test.ts` — `frage`/`wunsch`/`bug` → 201;
  `feature`/`idee`/Fremdwert → 400 ohne Upstream-Aufruf.
- AK3: `server/src/express/feedback.test.ts` — für `wunsch`: Pfad `…-wunsch-….md` und
  `kategorie: wunsch` im Frontmatter (Bestandsdateien unberührt ist keine testbare
  Aussage im Code; der Server schreibt ausschließlich neue Pfade mit Zufallssuffix).
- AK4: `frontend/src/components/FeedbackForm.test.tsx` — Intro-Text matcht die neue
  Aufteilung, der alte Vierer-String kommt nicht mehr vor.
- AK5: `server/src/express/feedback.test.ts` — Admin-Mail enthält den neuen
  Kategorie-Wert in Betreff und Text.
- AK6: durch den bestehenden 375px-Bounding-Box-Test (AK10 derselben Spec) abgedeckt —
  er läuft nach der Umstellung gegen das dreielementige Select. Dedup, kein neuer Test.

## Test-Pflege

- Die `selectOption({ label: 'Fehler' })`-Stellen in `issue-1435-feedback.spec.ts`
  (AK8/AK9) werden auf `'Fehler melden'` umgestellt — das Label ändert sich mit AK1,
  Playwrights `selectOption` matcht Labels exakt.

## Nicht im Scope

Umbenennen bereits committeter Feedback-Dateien im Vault; Änderungen an Upload, Push oder
Admin-Mail-Mechanik selbst (nur der Kategorie-Wert ändert sich).
