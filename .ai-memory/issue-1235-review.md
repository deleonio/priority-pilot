# PR 1235 — Review, Stand 2026-09-05 (Runde 2: Fixup-Nachweis)

**ERGEBNIS Runde 2: VERDICT reviewed, Ampel 🟢, keine offenen Findings.**
Review OHNE Issue (`closingIssuesReferences == []`) — PR-Beschreibung ist maßgeblich.
Runde 1 (Kreuzverhör) siehe Abschnitt „Runde 1" weiter unten.

## Erledigt

### Runde 2 — Fixup-Nachweis (dieser Lauf)
- MODE bestimmt: `<!-- ai-review -->` vorhanden (Comment-ID **5551152980**) → Fixup-Nachweis,
  KEIN neues Kreuzverhör. Zusätzlich `<!-- ai-fixup-decisions -->` (ID 5551251300 laut
  node-id `IC_kwDONloM188AAAABSuEJZA`) als Claim-Checkliste geladen: 4 Zeilen (CI + Nits 1–3),
  alle „behoben via `b118cc0e`".
- Fixup-Diff `git show b118cc0e` gelesen (4 Dateien, +49/−9, davon `.ai-memory/issue-1235-fixup.md`
  als reine Notiz). **Alle 4 Claims bestätigt:**
  - **CI:** `frontend/e2e/issue-843.spec.ts:41` ergänzt `.settings-general > kol-details` im
    AK1-Locator. Kindschaftsbezug selbst verifiziert: `.settings-general` auf
    `SettingsPage.tsx:306` (Einrückung 4 Tabs), `<KolDetails>` auf `:384` (5 Tabs) → direktes
    Kind, der `>`-Selektor greift. Sub-Switches bleiben über
    `:not(.settings-switch-row--sub) > kol-input-checkbox` ausgenommen (sie sind Nachfahren
    des Details). Doc-Kommentar `:25-31` erklärt die Ursache (Messung „über das Summary hinweg",
    76px statt 16px).
  - **Nit 1:** `className="settings-animation-details"` entfernt; `grep -rn settings-animation-details`
    über `*.ts/*.tsx/*.css` (ohne node_modules) → **0 Treffer**.
  - **Nit 2:** `_label` → `"Animations-Details"`; 4 Kollateralstellen in
    `settings-switch-layout.spec.ts` (`:134`, `:272`, `:275`, `:284`) mitgezogen;
    `grep -rn "Details Optionen anzeigen"` → **0 Treffer**.
  - **Nit 3:** `switches.nth(3)` → `kol-input-checkbox[_variant="switch"][_label="Erledigt animieren"]`
    (`settings-switch-layout.spec.ts:146-148`). Abweichung vom wörtlichen Nit-Vorschlag
    (`switchControl()`-Helper) ist im Diff begründet und sachlich richtig: der Rollen-Locator
    des Helpers trifft ein kleineres Shadow-DOM-Element als der Host, den die Messschleife
    `:151` misst.
- Delta-Review: keine neuen Probleme. Der Fixup fasst nur Testlokatoren + einen Label-String an,
  Produktionsverhalten von `KolDetails` unverändert.
- Titel-Gate: `feat(frontend): use KolDetails for animation sub-options` (55 Zeichen,
  Conventional Commits konform) — in Runde 1 gesetzt, **kein Rename nötig**.
- Sammelkommentar 5551152980 per `gh api -X PATCH .../issues/comments/5551152980 -F body=@…`
  aktualisiert (Runde-2-Fassung mit gefüllter Tabelle „✅ Behobene Anmerkungen" inkl. Prüfspalte,
  leeren Abschnitten Entscheidungs-/Offene Findings, Footer „Review-Typ: Fixup-Nachweis").
  KEIN zweiter Kommentar angelegt.

### Runde 1 — Kreuzverhör (2026-09-05, vorheriger Lauf)
- Vollen Diff gelesen (4 Dateien, +81/−78), KoliBri-first via MCP `spec/details` geprüft,
  #1227 gegengelesen, `settings-action-buttons.spec.ts:134`-Rückbau und `app.css:1800/:1811`
  verifiziert, `Modal` weiterhin ≥10× benutzt (kein knip-Fund).
- Ergebnis: 🟢 mit 3 Nits, keine Fixup-Runde gefordert; Titel umbenannt; Review
  (event=COMMENT, ID 5120857685) mit 2 Inline-Ankern + Sammelkommentar 5551152980 angelegt.

## Relevante Stellen

- `frontend/e2e/issue-843.spec.ts:38-42` — AK1-Locator, jetzt inkl. `.settings-general > kol-details`;
  das war der reale `e2e (3)`-Fehler.
- `frontend/src/components/SettingsPage.tsx:384` — `<KolDetails _label="Animations-Details">`,
  ohne `className`; direktes Kind von `.settings-general` (`:306`).
- `frontend/e2e/settings-switch-layout.spec.ts:146-148` — label-basierter Touch-Target-Poll
  (Attribut-Selektor, nicht `switchControl()`); `:151` Messschleife über alle 5 Switches.
- `frontend/e2e/settings-switch-layout.spec.ts:134,275,284` — Klick/Testname auf
  `'Animations-Details'`.

## Annahmen

- Der lokale Playwright-Lauf des Fixup-Autors (`issue-843.spec.ts` 4/4, beide Switch-Dateien
  12/12) ist nicht nachgestellt — auf CI standen `e2e (1)`–`(4)` und `verify` zum Review-Zeitpunkt
  auf `IN_PROGRESS`. Die Locator-Korrektur ist statisch nachvollziehbar (Kindschaft geprüft),
  der grüne Beweis kommt vom Gate.
- `kol-details` hält seinen Inhalt bei geschlossenem Zustand im DOM und kollabiert nur die Höhe —
  nur so gehen `toHaveCount(5)` und das AK1-Ausschlussmuster gleichzeitig auf. Unverändert aus
  Runde 1 übernommen, nicht im Browser verifiziert.
- Dass React `_label` als DOM-Attribut durchreicht (Voraussetzung für den Attribut-Selektor in
  Nit 3), ist vom Fixup-Autor per Probe-Script belegt, von mir nicht nachgestellt.

## Verworfen

- Neues Kreuzverhör des ganzen PRs — MODE ist Fixup-Nachweis; nur Claim-Checkliste + Delta.
- Finding gegen die Abweichung bei Nit 3 (`switchControl()` nicht benutzt) — die Begründung im
  Diff-Kommentar ist technisch korrekt (unterschiedliche Bounding-Box von Host vs. Shadow-DOM-
  Element); ein Pseudo-Fund hätte eine Runde gekostet.
- Finding gegen die weiterhin indexbasierte `for`-Schleife `switches.nth(i)` — sie prüft alle 5
  Elemente, ein verschobener Index ändert dort nichts.
- Blocker wegen laufender CI — Checks sind `IN_PROGRESS`, nicht rot; als Merge-Vorbehalt im
  Sammelkommentar vermerkt (deterministisches gate-merge deckt das ab).
- MEMORY.md-Eintrag — kein neuer wiederkehrender Fehler; das KoliBri-`_label`-Detail steht
  bereits in `.ai-memory/issue-1235-fixup.md` (Fallstricke).

## Offen

- `verify` + `e2e (1)`–`(4)` liefen beim Review noch. 🟢 ist ein inhaltliches Urteil; grüne
  Pflicht-Checks muss das Merge-Gate separat abwarten.
- Die zwei Review-Threads aus Runde 1 (`SettingsPage.tsx:384`, `settings-switch-layout.spec.ts:143`)
  sind inhaltlich erledigt, aber nicht als „resolved" markiert — kosmetisch, kein Blocker.

## Nächster Schritt

- Nichts vom Review aus. Nach grüner CI kann der PR gemergt werden.

## Fallstricke

- `.settings-general > kol-details` im AK1-Locator hängt daran, dass `<KolDetails>` **direktes**
  Kind von `.settings-general` bleibt (`SettingsPage.tsx:306` → `:384`). Wer es in einen Wrapper
  packt (wie `.settings-profile` bei #1219/#1233), macht `e2e (3)` wieder rot — dann den
  Selektor mitziehen, nicht die Assertion aufweichen.
- KoliBri rendert `_label` NICHT in den Light-DOM-Textinhalt → `hasText`/`innerText()` greifen
  ins Leere; Attribut-Selektor nutzen. `getByRole(..., {name})` trifft ein anderes (kleineres)
  Element als der `kol-input-checkbox`-Host — für Bounding-Box-Vergleiche nicht mischen.
- Der Label-String `Animations-Details` steht an 5 Stellen (1× Quelltext, 4× e2e). Wer ihn
  ändert, muss alle mitziehen — es gibt keine gemeinsame Konstante.
- `.settings-general > kol-button` ist seit dem Wegfall des zweiten Buttons wieder eindeutig
  (`SettingsPage.tsx:444`); ein weiterer direkter KolButton bricht
  `settings-action-buttons.spec.ts` mit Strict-Mode-Fehler, nicht mit einer Assertion.
- Die AK1-Einrückungs-Assertion hat bei ≤767px nur 4px Luft (`app.css:1800`, 20px − 16px).
