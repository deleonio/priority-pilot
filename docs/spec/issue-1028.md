# Spec #1028 — KolAlert: leichtes Padding + abgerundete Ecken am Host

**Issue:** [#1028](https://github.com/deleonio/priority-pilot/issues/1028) · **Typ:** Reines CSS-Styling (Frontend, kein Server-Kontakt)
**Format-Referenz:** `docs/spec/user-journeys.md` · **Betroffen:** `frontend/src/app.css` · **Tests:** `frontend/e2e/issue-1028-alert-host-padding-radius.spec.ts`

## Ziel

Alle KolAlert-Meldungen der App erhalten am `kol-alert`-Host ein leichtes Padding und einen kleinen
`border-radius` — definiert in **einer** globalen CSS-Regel in `frontend/src/app.css` (Muster wie die
Ticket-Blöcke #866/#930, app.css:1872 bzw. 1879–1904), ohne Anpassung an den ~40 Verwendungsstellen.

**Verbindliche Design-Entscheidung** (deleonio, Issue-Kommentar 2026-08-25):

1. **Radius + Padding am Host** (Light-DOM-Host-Selektor, kein Shadow-Piercing).
2. **Sichtbare Fläche bleibt KoliBri-intern** (Shadow-DOM/Custom-Properties) — der Host bekommt
   **keine** eigene Hintergrundfläche.
3. **Die #930-Transparenz-Regel bleibt unverändert** (Host-Hintergrund bleibt transparent).

## Vorbedingung

- Angemeldeter Nutzer (E2E-Fixture mockt `/auth/me`), `/settings/general` geöffnet.
- `navigator.mediaDevices.getUserMedia` mockt mit `NotAllowedError` → Toggle des Sprachaufnahme-
  Switches zeigt den `micDenied`-Warn-Alert („Mikrofon-Zugriff verweigert") in der
  `.settings-switch-row` — ein deterministischer Alert inkl. des Spezial-Kontexts
  `.settings-switch-row kol-alert` (app.css:1482, `flex: 0 1 40%`).

## Schritte

1. `/settings/general` öffnen (Desktop 1280px), Mikrofon verweigern, Sprachaufnahme-Switch togglen.
2. `getComputedStyle()` am `kol-alert`-Host messen: Padding aller 4 Seiten, Radius aller 4 Ecken.
3. Theme auf Dark wechseln und dieselben Messungen wiederholen.
4. Viewport auf 320px verkleinern und Alert-Box vs. Container (`.settings-general`) und Dokument-
   Scrollbreite prüfen.

## Erwartetes Ergebnis (Akzeptanzkriterien)

| AK  | Erwartetes Verhalten                                                                                                                                                       | Verifiziert durch                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| AK1 | Globaler `kol-alert`-Regelblock in `app.css` (Kommentar mit `#1028`): Host-Padding > 0 und `border-radius` > 0, Werte innerhalb der Token-Skala (≤ 0.5rem = 8px).          | E2E-Test 1 (rot bis Umsetzung)                                                                                                 |
| AK2 | Wirkung app-weit ohne Änderung der Verwendungsstellen; messbar auch im Spezial-Kontext `.settings-switch-row kol-alert`.                                                   | E2E-Test 1 misst jeden sichtbaren Alert der Seite inkl. Row-Kontext; „ohne Änderung der Stellen" belegt der Diff (nur app.css) |
| AK3 | Keine Layout-Regression: Flex-Aufteilung der Settings-Switch-Row stabil, kein horizontaler Overflow bei 320px (Padding darf die Host-Box nicht aus dem Container drücken). | E2E-Test 2 (Schutz-Test, initial grün) + bestehende `settings-switch-layout.spec.ts` (#971)                                    |
| AK4 | #930-Transparenz bleibt: Host-Hintergrund weiter transparent (Radius wirkt ohne eigene Host-Fläche).                                                                       | Bestehende `issue-930-transparent-backgrounds.spec.ts` (Dedup, kein neuer Test)                                                |
| AK5 | Themenneutral: Padding/Radius identisch in Light und Dark, kein Kontrastverlust (Padding/Radius ändern keine Farben).                                                      | E2E-Test 1 (Dark-Messung)                                                                                                      |

## Tests

`frontend/e2e/issue-1028-alert-host-padding-radius.spec.ts`:

- **Test 1 (AK1/AK2/AK5, ROT bis Umsetzung):** Computed styles am Host — jede Padding-Seite und jede
  Radius-Ecke > 0 und ≤ 8px, für alle sichtbaren Alerts der Seite; identische Werte nach
  Theme-Wechsel (Dark).
- **Test 2 (AK3, Schutz-Test):** 320px-Viewport — Alert-Bounding-Box bleibt innerhalb des
  `.settings-general`-Containers und des Viewports, kein horizontaler Dokument-Scroll. Initial grün;
  wird rot, sobald Padding die Host-Box ohne Rücksicht auf Flex/box-sizing vergrößert (bekannter
  Fallstrick: kein globales `box-sizing: border-box`).

## Abgrenzung / nicht per Test verifiziert

- „Sichtbare Rundung auf der Alert-Fläche" (Shadow-DOM) ist KoliBri-intern und black-box nicht am
  Host messbar — Fläche und Rundung des Innenlebens folgen der KoliBri-Mechanik (Custom-Properties).
  Der Vertrag hier sichert die Host-Seite der Entscheidung (Radius + Padding am Host, Transparenz
  unverändert).
- „Ohne Änderung der ~40 Komponenten-Dateien" ist eine Diff-Eigenschaft (nur `frontend/src/app.css`
  ändert sich) — Review-Beleg, kein Test (Change-Detection auf Quelldateien fällt unter ADR 0001).
