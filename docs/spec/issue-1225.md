# Spec: Gruppenbild hinterlegen (#1225)

## Ziel

Admins können pro Gruppe eine https-Bildadresse hinterlegen; Gruppenliste und Gruppendetail
zeigen das Bild als `KolAvatar` neben dem Gruppennamen, ohne Bild die Initialen des Namens.
Vorbild ist das bestehende `avatarUrl`-Muster (`server/src/models/user.ts`, Migration
`migrateUsersAvatarUrl`, Header-Avatar `frontend/src/App.tsx:665`) — Bildadresse statt Upload.

## API-Vertrag (AK1)

- `PATCH /groups/:id` akzeptiert zusätzlich das optionale Feld `imageUrl`.
- Nur Werte, die nach Trim mit `https://` beginnen, werden übernommen; jeder andere
  angegebene Wert → `400` mit deutscher Meldung, Gruppe unverändert.
- `imageUrl: null` entfernt das Bild (DTO liefert danach `null`).
- Abwesendes Feld bleibt unverändert (presence-basierter PATCH-Vertrag, Kommentar
  `groups.ts` zum GroupUpdate-Vertrag).
- `GroupDto`/`toDto` liefern `imageUrl: string | null` mit; `openapi.yml` (Schemas `Group`,
  `GroupUpdate`) führt das Feld accordingly.

## Migration (AK2)

- Neue idempotente Funktion `migrateGroupImageUrl(db)` in `server/src/logics/migrate.ts`
  (Muster `migrateUserGeoConfigColumns`): zieht die nullable Spalte `imageUrl` auf einer
  bestehenden `groups`-Tabelle per `ALTER TABLE` nach, bevor `sequelize.sync()` läuft.
- Verdrahtet in `server/src/index.ts` in der Migrationsliste.
- Doppelter Lauf ist ein No-op; auf einer DB ohne `groups`-Tabelle ebenso (No-op,
  `sync()` legt die Tabelle inkl. Spalte an).

## Zugriffsrechte (AK3)

- Mitglied ohne Adminrolle → `403` (statt dem heutigen einheitlichen 404).
- Nicht-Mitglied → `404` (kein Existenz-Leak, Muster invitations-Route).

## Frontend (AK4/AK5, KI-UX-Block)

- `GroupFormDialog` bekommt im **Bearbeiten**-Modus ein optionales `KolInputText`
  „Bildadresse“ (unter Beschreibung, `_hint` „Adresse eines Bildes, beginnt mit https://“,
  `_type="url"`, clientseitige https-Prüfung mit `_error` wie der Name-Check; Dialog bleibt
  bei ungültiger Adresse offen). Anlegen-Modus bleibt ohne das Feld.
- Leeres Feld im Bearbeiten-Dialog wird als `imageUrl: null` gesendet („Feld leer = kein
  Bild“), gefülltes Feld nur bei Änderung (presence-Vertrag).
- `GroupsSection` (Liste) und `GroupDetail` (Detailkopf) rendern neben dem Gruppennamen
  einen `KolAvatar` mit `_label={group.name}`; mit `imageUrl` zusätzlich
  `_src={group.imageUrl}` (`undefined` → Initialen, Muster `App.tsx:665`). `_color` wird
  **nicht** gesetzt; der Avatar ist rein dekorativ, nicht fokussierbar und liegt außerhalb
  des Click-Exclusion-Themas der Karten-Klicks (#1212/#1223).
- Feste Avatar-Größe (unabhängig vom Bild), Textcontainer mit `min-width: 0` + Ellipsis —
  bei 375 px bleibt die Zeile ohne horizontales Scrollen (AK5).

## Testpflege

- Keine Widersprüche zu bestehenden Tests festgestellt; `groups.api.test.ts` (PATCH-Vertrag)
  und `groups-dataisolation.test.ts` bleiben unverändert gültig.
- Abweichung AK5: Assertion per Bounding-Box statt `element.scrollWidth` — die App-Shell
  clippt `overflow-x: hidden`, `scrollWidth` bleibt strukturell ≤ Viewport (Erfahrung
  2026-08-24, gleiche Abweichung wie #1211 AK8). Die End-to-End-Aussage („kein horizontales
  Scrollen“) ist identisch.
