# Issue 1573 — Säulen sind fest: CRUD sperren, Bestand auf die 5 Standard-Säulen zurückführen

**Spec-Phase (rote Tests), Issue:** [#1573](https://github.com/deleonio/priority-pilot/issues/1573)

## Ziel

Die fünf Lebensbalance-Säulen (`SEED_PILLARS` in `server/src/models/pillarData.ts`: Körper, Mentale
Gesundheit, Beziehungen, Wirksamkeit, Sinn) sind per Definition fest: Sie adressieren die Balance im
Leben und gelten stets. Anlegen, Umbenennen und Löschen von Säulen entfällt komplett — serverseitig
gesperrt und in der UI nicht mehr erreichbar. Die individuelle Gewichtsverteilung bleibt editierbar.
Bestandsnutzer werden per Einmal-Migration auf exakt die 5 Standard-Säulen zurückgeführt.

## AK1 — Serverseitige CRUD-Sperre

**Vertrag:** `POST /pillars`, `PATCH /pillars/:id` und `DELETE /pillars/:id` antworten für
authentifizierte Nutzer mit einem 4xx-Status (400–499) und einer Fehlermeldung, die den Grund
erklärt (Message enthält einen Hinweis im Sinne von „fest"/„gesperrt", z. B. „Die fünf Säulen sind
fest und gelten stets."). Kein Endpunkt hat Nebeneffekte: keine angelegte, keine geänderte, keine
gelöschte Säule. Die Auth-Pflicht (401 ohne Session) bleibt bestehen.

`GET /pillars` und `PUT /pillars/weights` funktionieren unverändert (bestehende Tests bleiben grün,
keine neuen Tests — Dedup).

## AK2 — Settings-Tab „Säulen" ohne CRUD-Kontrollen, mit Hinweistext

**Vertrag:** `PillarList` wird zur reinen Leseansicht (KI-UX-Block): Es gibt keine Buttons
„Neue Säule anlegen", „Bearbeiten", „Löschen" — auch nicht im Leerzustand (die Leerzustands-Karte
mit Anlege-CTA entfällt ersatzlos). Stattdessen zeigt die Komponente durchgehend einen statischen
Hinweis als `KolAlert _type="info"` mit dem Wortlaut sinngemäß:
„Diese 5 Säulen adressieren per Definition die Balance im Leben und gelten stets. Deine Gewichtung
bleibt individuell anpassbar." Laden (`KolSpin`), Fehler (`KolAlert` + „Erneut versuchen") und die
Kurzbeschreibungen je Säule (#934) bleiben unverändert.

## AK3 — Gewichtsverteilung bleibt editierbar

Keine neuen Tests: Der bestehende Vertrag (`PUT /pillars/weights`, Summe 100, vollständige Abdeckung)
ist durch `server/src/express/pillars.test.ts` (GET/PUT-Blöcke) und die `PillarWeights*`-Tests
abgedeckt und darf sich nicht ändern.

## AK4 — Restore-Migration auf exakt die 5 Standard-Säulen

**Vertrag:** Neue idempotente Migration `migratePillarRestore(sequelize)` in
`server/src/logics/migrate.ts` (Muster: `migratePillarPerUser`), registriert in der
Migrations-Registry von `server/src/index.ts`, läuft vor `sync()`. Pro Bestandsnutzer:

1. **Umbenannte Standard-Säulen** (id bleibt, Name weicht ab): Name wird auf den Standardnamen
   zurückgesetzt. Die id-basierten Beiträge (`task_pillars`, `series_pillars`) bleiben unverändert
   erhalten — es geht nichts verloren.
2. **Fehlende Standard-Säulen**: werden angelegt (Name/Beschreibung aus `SEED_PILLARS`, Gewicht nach
   AK5).
3. **Zusätzliche Säulen** (Name nicht in `SEED_PILLARS`): werden mitsamt aller ihrer Beiträge
   entfernt (Folgt der heutigen DELETE-Semantik `pillars.ts:335-417`; eine Renormierung verbleibender
   Beiträge/Shares ist nicht erforderlich, da nur ganze Säulen verschwinden).
4. Ergebnis: Der Nutzer besitzt exakt die 5 Standard-Säulen mit Standard-Namen. Ein zweiter Lauf
   ändert nichts (idempotent).

Zuordnung „umbenannt statt zusätzlich": Eine Nutzer-Säule mit Standard-Namen ist eine Standard-Säule;
eine ohne Standard-Namen ist zusätzlich (und wird entfernt). Welche Standard-Säule „umbenannt" war,
ergibt sich aus der Lücke: Fehlt genau ein Standard-Name im Bestand, wird die Zuordnung beim
Zurücksetzen nicht über ids geraten — Contributions hängen an ids, und nur Namen werden
zurückgesetzt bzw. Zeilen ohne Standard-Namen entfernt.

## AK5 — Gewichte bei der Restore-Migration

- Das Gewicht einer vorhandenen (bereits genutzten) Standard-Säule bleibt **exakt** unverändert.
- Für neu angelegte Standard-Säulen gilt: Die Summe aller 5 Gewichte ist danach 100.
  - Ist die Summe der vorhandenen ≤ 100, füllen die neuen Säulen den Rest auf
    (eine neue Säule erhält `100 − Summe`, mehrere teilen sich den Rest gleichmäßig).
  - Ist die Summe der vorhandenen > 100 (Rest negativ), werden alle 5 proportional auf 100
    renormiert (Faktor `100 / Summe`; neue Säulen starten bei 0).

## AK6 — Mobile (375 px)

Im Settings-Tab „Säulen" sind Hinweistext und Gewichts-Regler ohne horizontalen Overflow benutzbar.
Messgrundlage: Bounding-Boxes der Light-DOM-Hosts (`kol-alert`, `.pillar-weights-grid
kol-input-range`) innerhalb des 375-px-Viewports — nicht `scrollWidth` (die App-Shell clippt
`overflow-x: hidden`, Muster `issue-996-pillar-row-mobile.spec.ts`).

## Test-Pflege-Bedarf (bewusst entfernt)

Die folgenden Tests beschreiben das nun verbotene CRUD und wurden ersatzlos gestrichen bzw. durch
Sperr-Tests ersetzt:

- `server/src/express/pillars.test.ts`: die Blöcke `POST /pillars`, `PATCH /pillars/:id`,
  `DELETE /pillars/:id` (Erfolgs- und Validierungsfälle des freien CRUD).
- `frontend/src/components/PillarList.test.tsx`: die Blöcke zu Anlegen, Bearbeiten, Löschen und
  „Neu laden nach Mutation" (#439-Vertrag).
- `frontend/e2e/pillar-crud.spec.ts` und `frontend/e2e/pillar-dynamic-cases.spec.ts`: komplette
  Dateien (UI-CRUD und CRUD-Lifecycle gegen das echte Backend). Ersetzt durch
  `frontend/e2e/issue-1573-saeulen-fix.spec.ts`.

## Offene Fragen

- Keine blockierenden. Der exakte 4xx-Statuscode der Sperre bleibt der Implementierung überlassen
  (AK verlangt nur 4xx + Hinweistext); die Tests asserten den Bereich 400–499.
