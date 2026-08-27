### Entscheidung (bindend)
- **Option B — umgesetzt & gemergt (PR #1064):** Serien-Datenmodell mit `address` inkl. Vererbung auf generierte Instanzen; Badge in Serienliste (`SeriesTab`) und Erledigt-Liste (`CompletedTasksTable`) live.
- **Revision 2026-08-27, 18:42 UTC (@deleonio):** „in der aufgabenliste fehlt das icon!" — der Globus gehört **jetzt auch in die Aufgabenliste** (`TaskTree`, offene Aufgaben). Die frühere Eingrenzung „Aufgaben-Badge nur in der Erledigt-Liste, nicht im TaskTree" ist damit vom Entscheider selbst widerrufen; dieser Kommentar ist die neuere, bindende Vorgabe.
- **Icon:** Font-Awesome-Globus (`fa-solid fa-globe`) statt 🌍-Emoji (unverändert).

### Umsetzungskontext (Delta zur gemergten Basis main/13726f4)
- Betroffene Dateien:
  - `frontend/src/components/TaskTree.tsx` — GeoBadge in die Zeilen-Badge-Gruppe `.task-tree-badges` (~Zeile 90) des `task-list-item` (Anker `data-testid="task-list-item-<id>"`, Zeile 84), nur bei `task.address != null`; bestehende Badges (Serie, geändert, Fortschritt, Priorität) unangetastet.
  - `frontend/src/components/GeoBadge.tsx` — unverändert wiederverwenden (Vertrag: `data-testid="geo-badge"`, `aria-label` „Standort: …", `fa-solid fa-globe`).
  - `frontend/src/app.css` — nur falls Zeilen-Alignment es verlangt (`.geo-badge` existiert, ~Zeile 1261).
  - `frontend/e2e/issue-1063-geo-badge.spec.ts` — die AK5-Negativ-Assertion „TaskTree zeigt kein Badge" **muss gedreht werden** (jetzt positiv: mit `address` → Badge, ohne → keins).
- Betroffene Komponenten: TaskTree (Zeilen-Rendering), e2e-Vertrag.
- Vorhandenes Muster: `GeoBadge`-Einbau in `SeriesTab.tsx:148` und `CompletedTasksTable.tsx:127` (gemergt, e2e-verifiziert); Task-Daten serialisieren `address` bereits (`server/src/express/routes/tasks.ts:92`) — **kein Server-/API-Änderungsbedarf**.
- Randbedingungen: Baumstruktur (Einrückung, Chevrons, Badges, Popover-Aktionen) darf nicht brechen; 375px ohne horizontalen Überlauf (`overflow-x` wird von der App-Shell geclippt → Bounding-Box-Messung, nicht scrollWidth); Erledigt-/Serienliste unverändert lassen (funktionieren).
- Erwartetes Ergebnis: Offene Aufgabe mit `address` zeigt den Globus in der Aufgabenliste; Aufgabe ohne `address` zeigt keins; Serien- und Erledigt-Liste bleiben wie gemergt.
- Kein Split: eine Komponente plus Test-Flip, ein kleiner PR.

### Akzeptanzkriterien (Delta; Basis aus PR #1064 bleibt unverändert gültig)
- AK1: In der Aufgabenliste (`TaskTree`) zeigt jede offene Aufgabe mit `address` das Globus-Badge in der Zeile; Aufgaben ohne `address` zeigen keins.
- AK2: Mobile (375px): das Badge in der Aufgabenliste verursacht keinen horizontalen Überlauf/Layout-Bruch; die Baumstruktur (Einrückung, Badges, Aktionen) bleibt intakt.
- AK3 (Bestand, aus PR #1064 gemergt): Serien-`address`-Roundtrip (API), Snapshot-Vererbung auf Instanzen, Kaskade auf offene Instanzen, Badge in Serien- und Erledigt-Liste — kein Handlungsbedarf.

### Testfälle
- AK1 → E2e (`frontend/e2e/issue-1063-geo-badge.spec.ts` anpassen): bestehende TaskTree-Negativ-Assertion drehen — Task mit Adresse per API anlegen → `task-list-item-<id>` enthält sichtbares `geo-badge`; Task ohne Adresse → kein `geo-badge` im Eintrag.
- AK2 → E2e, 375px-Viewport: Bounding-Box-Prüfung der Baumzeile mit Badge (`el.x + el.width ≤ viewportWidth`), schmale Zeilen mit Badges + langem Titel mitprüfen.

### Ampel
- Ampel: 🟢
- Begründung: Reines Frontend-Delta (eine Komponente, Badge-Komponente existiert, Daten serialisiert); Muster aus SeriesTab/CompletedTasksTable direkt übertragbar; revisionierte Vorgabe liegt bindend vom Entscheider vor.

### ❓ Offene Fragen
- keine
