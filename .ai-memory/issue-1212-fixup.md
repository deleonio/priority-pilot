# Issue 1212 — Fixup zu PR #1215, Stand 2026-09-04

## Runde 4 — Finding #2 behoben, e2e ERSTMALS LOKAL GRÜN

### Ursache (bestätigt, nicht mehr vermutet)

`page.getByRole('listitem').…click()` trifft das Zentrum der Gruppenkarte. `.groups-item` ist
`display:flex; justify-content:space-between` — dort liegt die Lücke zwischen `.groups-info` und
`.groups-actions`, also das `li` selbst. Das `li` hatte keinen Klick-Handler; nur der Namens-Button
schaltete `openGroupId`. Ergebnis: Detail klappte nie auf → `getByRole('searchbox')` lief 30 s ins
Leere. Die Hypothese „KolInputText exponiert `role=searchbox` nicht" ist widerlegt — nach dem Fix
findet Playwright die Searchbox sofort.

### Fix

- `frontend/src/components/GroupsSection.tsx` — `onClick` am `li.groups-item` mit Guard
  (`closest('.group-detail, kol-button, kol-input-text, kol-dialog, button, a, input')`). Der Guard
  ist zwingend: das Detail wird INNERHALB des `li` gerendert, ohne ihn klappte jeder Klick auf
  „Einladen"/„Entfernen"/ins Suchfeld die Ansicht wieder zu. Web-Components zählen mit, weil das
  Event-Target beim Verlassen des Shadow-DOM auf den Host (`kol-button`) retargeted wird —
  `closest('button')` allein greift nicht. Tastaturpfad bleibt der Namens-Button.
- `frontend/src/app.css` — neue Klasse `.groups-item--expandable { cursor: pointer }`. Bewusst nicht
  auf `.groups-item` global: die Einladungskarten oben teilen sich die Klasse und sind nicht klickbar.
- `frontend/e2e/groups-invitations.spec.ts` — drei Locator-Präzisierungen, alle wegen der
  aufgeklappten Karte, die den gesuchten Text ein zweites Mal enthält (strict-mode-Verstöße, in
  Playwright NICHT retrybar):
  - `spec:107` „Ines Eingeladen ist weg" auf `.group-members` gescoped — der schließende
    Bestätigungsdialog trägt den Namen in `<strong>` ebenfalls.
  - `spec:93` „Einladung ist weg" auf `.group-received-invitations` gescoped — nach dem Annehmen
    steht der Gruppenname weiter auf der Seite, nur eben als eigene Gruppe. Vorher ein echter Race
    (bestand einmal, fiel im nächsten Lauf).
  - `spec:103/130` Mitgliederzeile über `.group-members` statt `getByRole('listitem').first()` —
    die umschließende Gruppenkarte ist selbst ein `listitem` und matcht sonst mit.
  Die Klick-Zeilen (`getByRole('listitem').filter(...)`) blieben unangetastet: sie SIND der Vertrag
  „Karte klickbar".
- `frontend/src/components/GroupDetail.test.tsx` — Unit-Abdeckung für den Bestätigungsdialog aus
  Runde 1 (Nit aus Finding #2): Dialog öffnet statt sofort zu entfernen, Bestätigen ruft
  `removeGroupMember({id, userId})` und lädt neu, Abbrechen feuert keinen Request. `./Modal` wird
  gemockt (Muster `DeleteTaskDialog.test.tsx`).

### E2E lokal ausgeführt — so geht es in dieser Umgebung

Bisher scheiterte jede Runde daran, dass e2e nie lokal lief. Es geht:
Playwright startet Backend + Vite selbst (`webServer` in `playwright.config.ts`), nur der Browser
fehlt — das Repo will Build 1234, vorinstalliert ist 1194 unter `/opt/pw-browsers/chromium`.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` wird von Playwright ignoriert. Was funktioniert: eine
temporäre Config unter `/tmp` (NICHT im Repo), die die echte importiert und überschreibt —
`use.launchOptions.executablePath` auf `/opt/pw-browsers/chromium`, plus `cwd: <frontend>` an jedem
`webServer`-Eintrag (sonst startet Playwright die Server im Config-Verzeichnis und bricht mit
„Process from config.webServer exited early" ab).

### Gate (alles lokal, alles grün)

| Kommando                                          | Ergebnis                          |
| ------------------------------------------------- | --------------------------------- |
| `pnpm format` / `prettier --check .`              | exit 0                            |
| `pnpm lint`                                       | exit 0                            |
| `pnpm knip`                                       | exit 0                            |
| `pnpm --filter server test`                       | 811 pass / 0 fail                 |
| `pnpm --filter frontend test`                     | 530 pass (vorher 527, +3 neue)    |
| e2e `groups-invitations.spec.ts` (AK1/AK6+AK9/AK12) | 3 passed — erstmals grün          |
| e2e `groups.spec.ts` (#1211, Regressionsprobe)    | 6 passed                          |

## Frühere Runden (Kurzfassung)

- **Runde 1** — Finding #1 (blocker): „Entfernen" ohne Bestätigung. Behoben via `33be8aec`
  (`pendingRemoval`-State + `Modal`, Initialfokus „Abbrechen" nach #472). Bewusst EINstufig statt
  zweistufig wie `GroupDeleteDialog.tsx`: `spec:105` klickt genau EINEN Dialog-Button mit exakt
  „Entfernen" — ein zweiter Schritt bräche den ausführbaren Vertrag. Thread
  `PRRT_kwDONloM186fMFFR` aufgelöst, Nachweis im ai-fixup-decisions-Kommentar (ID 5539372480).
- **Runde 2** — Crash-Nachbereitung (Kommentar + Thread-Auflösung nachgeholt).
- **Runde 3** — am Soft-Deadline abgebrochen, kein Code. Die dort gesicherte Mentor-Diagnose
  (li-Klick trifft die Lücke) hat sich als richtig erwiesen.

## Verworfen

- Spec-Klicks auf den Namens-Button umschreiben — schwächt den Vertrag „Karte klickbar" ab.
- `cursor: pointer` global auf `.groups-item` — die nicht klickbaren Einladungskarten nutzen dieselbe
  Klasse.
- Nit „Selbst-Austritt für Nicht-Admins" (ai-review) — nicht blockierend, kein AK verlangt es.

## Fallstricke

- Der Trigger-Button in der Mitgliederzeile heißt ebenso „Entfernen" wie der im Dialog — Unit-Tests
  brauchen `within(row)` bzw. `within(getByTestId('modal'))`, e2e den `kol-dialog`-Scope.
- `handleRemove` muss den Dialog VOR dem Request schließen, sonst überlagert das Modal die
  Fehler-`KolAlert` (409 letzter Admin).
- `Modal` öffnet `KolDialog` imperativ beim Mount → nur bedingt rendern, nie per CSS verstecken.
- Strict-mode-Verstöße („resolved to 2 elements") werden von `expect(...).toBeHidden()` NICHT
  wegretryt, auch wenn der Zustand eine Sekunde später stimmt. Immer scopen statt hoffen.
