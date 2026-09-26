# Spec: Issue #1742 — Startup-Migrator für die Pending-Plan-Spalten an `subscriptions`

Quelle: Harness-Marker-Kommentar zu Issue #1742 (KI-ANALYSE, Stand 2026-09-26T11:20:37Z).

## Ziel

Nach einem Deploy/Restart liest `/auth/me` den Abo-Status auf einer Bestands-DB ohne
`SQLITE_ERROR: no such column: pendingPlan` — und liefert ihn statt ihn mit der Warnung
„Abo-Status konnte nicht gelesen werden" auf `null` zu setzen. Ursache ist kein Migrator für die
mit #1505 am `Subscription`-Modell ergänzten Spalten: `sequelize.sync()` ohne `alter` ergänzt
bestehende Tabellen nicht (`migrate.ts:148` dokumentiert das), frische DBs bekommen die Spalten
von `sync()`, Bestands-DBs nie.

## Vertrag

### Migrator `migrateSubscriptionPendingPlanColumns(db)` in `server/src/logics/migrate.ts`

Muster: `migrateTaskPinnedColumns` (zwei Spalten, pragma-Check je Spalte). Er zieht auf einer
**bestehenden** `subscriptions`-Tabelle die fehlenden nullbaren Spalten nach:

- `pendingPlan` (`VARCHAR(255)`, nullable) — vorgemerkter Paketwechsel (#1505 AK4)
- `pendingPlanEffectiveAt` (`DATETIME`, nullable)
- `firstFailureAt` (`DATETIME`, nullable) — #1506, dasselbe Versäumnis: `Subscription.findOne`
  selektiert die komplette Modellzeile, ohne diese Spalte bliebe `/auth/me` trotz der beiden
  anderen Spalten rot. (Erweiterung über den AK-Wortlaut hinaus, begründet in der Test-Pflege.)

Nullable, daher kein DEFAULT nötig; Bestandsabos bleiben ohne Vormerkung (`NULL`). Idempotent
(Spalte vorhanden → übersprungen); No-op bei frischer DB (keine `subscriptions`-Tabelle) —
`sync()` legt Tabelle inkl. Spalten an.

### Verdrahtung (AK1)

Der Migrator läuft in der Startup-Kette `server/src/index.ts` **vor** `sequelize.sync()`,
angegliedert an `migrateSubscriptionExternalIdUnique` (#1690), der ebenfalls an `subscriptions`
arbeitet. Nicht testbar mit Biss (Startup-Nebenwirkung der `index.ts`, kein reiner
Funktionsvertrag) — abgesichert über Code-Review der Impl-Phase.

## Testfälle

- **TF1 (AK1+AK2, node:test, `server/src/logics/migrate.test.ts`):** Legacy-`subscriptions` ohne
  die drei Spalten aufbauen, Bestandszeile einfüllen, Migrator ausführen → pragma zeigt alle drei
  Spalten; `sync()` bricht nicht; `UPDATE … SET pendingPlan` + `Subscription.findOne` liest den
  Wert sauber (statt `no such column`).
- **TF2 (AK4, gleiche Datei):** Migrator zweimal ausführen — kein Fehler, Zeilenzahl und -Inhalt
  unverändert; ohne `subscriptions`-Tabelle No-op, `sync()` legt die Spalten selbst an.

## AK3 — Dokumentation

`docs/deployment.md` hält fest: Neue Modell-Spalten benötigen für Bestands-DBs einen Migrator in
`server/src/logics/migrate.ts` (`sync()` ohne `alter` ergänzt bestehende Tabellen nicht), mit
Verweis auf dieses Incident. Reine Doku, kein Testfall.
