# Spec #1251 — Gruppenlöschung und Austritt lassen Einladungen und Serien zurück

**Issue:** #1251 · **Stand:** 2026-09-06 (Spec-Phase) · **Vertragstyp:** API-Vertrag (Server) + Anzeige-Vertrag (SeriesTab)

## Ziel

Gruppenlöschung (`DELETE /groups/{id}`) und Mitglieder-Austritt (`DELETE /groups/{id}/members/{userId}`) hinterlassen heute Geister-Daten: `group_invitations`-Zeilen der Gruppe überleben (→ Geister-Eintrag mit leerem Namen in `GET /invitations`), und Serien, die ein anderes Mitglied für den entfernten Eigentümer angelegt hat, laufen munter weiter. Künftig räumt derselbe Vorgang Einladungen ab und **stillagt** betroffene Cross-Member-Serien (`active:false`) — Bestands-Aufgaben bleiben unberührt.

## Feste Annahmen (von der Analyse festgezurrt)

1. Serie wird beim Austritt des Eigentümers **stillgelegt** (`active:false`), nicht zurückgegeben.
2. Gruppenlöschung = Massenaustritt → dieselbe Serien-Regel für alle Cross-Member-Paare der ehemaligen Gruppe.
3. Verwaiste Bestands-Einladungen werden einmalig idempotent beim Serverstart bereinigt.
4. Bestehende Guards bleiben unverändert (letzter Admin 409, Nicht-Admin 403/404 ohne Existenz-Leak); `GroupInviteLink`-Zeilen werden nicht angetastet; `GET /invitations` antwortet weiter 200 mit unverändertem DTO; Serien ohne Gruppenbezug bleiben aktiv.

## Verhalten je Akzeptanzkriterium

### AK1 — Gruppenlöschung räumt Einladungen ab

**Voraussetzung:** Gruppe mit Admin Alice, pending-Einladung für Bob.
**Schritte:** `DELETE /groups/{id}` als Alice (204).
**Erwartetes Ergebnis:** Keine `group_invitations`-Zeile mit dieser groupId (alle Status); `GET /invitations` von Bob antwortet 200 ohne diesen Eintrag.

### AK2 — Mitglieder-Entfernung räumt pending-Einladungen des Entfernten ab

**Voraussetzung:** Bob ist Mitglied mit pending-Einladung dieser Gruppe (Legacy-Zustand, per Modell geseedet — die API erzeugt ihn nicht mehr).
**Schritte:** (a) Admin Alice entfernt Bob; (b) Bob verlässt sich selbst (Gruppe mit zwei Admins).
**Erwartetes Ergebnis:** `GET /invitations` von Bob antwortet 200 ohne Eintrag dieser Gruppe.

### AK3 — Cross-Member-Serie des Entfernten wird stillgelegt

**Voraussetzung:** Serie `userId=Bob`, `createdById=Alice` über gemeinsame Gruppe, fällig (`startDate` Vergangenheit), aktiv.
**Schritte:** Bob wird aus der Gruppe entfernt; dann `POST /series/generate-all` als Bob.
**Erwartetes Ergebnis:** Serie ist `active:false`; der Lauf erzeugt daraus **0** neue Aufgaben.

### AK4 — Bestands-Aufgaben bleiben Eigentum des Empfängers

**Voraussetzung:** Wie AK3, aber vor der Entfernung wurde `POST /series/generate-all` als Bob ausgeführt (Instanz existiert).
**Schritte:** Bob wird entfernt.
**Erwartetes Ergebnis:** Die vorher erzeugte Aufgabe bleibt unverändert in `GET /tasks` von Bob (Schutz-Guard gegen Übereifer der Impl; heute grün, rot nur bei zerstörerischer Impl).

### AK5 — Massenaustritt bei Gruppenlöschung

**Voraussetzung:** Gruppe mit Alice+Bob (beide Mitglieder), Cross-Serien beider Richtungen (Alice→Bob, Bob→Alice), pending-Einladung für Carol.
**Schritte:** `DELETE /groups/{id}`.
**Erwartetes Ergebnis:** AK2/AK3 gelten für **alle** ehemaligen Mitglieder: beide Cross-Serien `active:false`, `group_invitations` für die Gruppe leer.

### AK6 — Ruhzustand sichtbar (API + UI)

**Voraussetzung:** Serie mit `active:false` im Bestand des Eigentümers.
**Schritte:** `GET /series`; Serieintrag im Serien-Tab (375×812).
**Erwartetes Ergebnis:** DTO liefert `active:false`; der Eintrag trägt ein Text-Badge „Ruhend" (KolBadge, Muster `series-tree-badge`; nie nur Farbe — WCAG 1.4.1; Badge darf umbrechen, kein horizontaler Scroll — WCAG 1.4.10). Kein Toggle/Reaktivieren, Toolbar (Bearbeiten/Löschen) bleibt.

### AK7 — Idempotente Bestandsbereinigung verwaister Einladungen

**Vertrag:** Neue Logik-Funktion `cleanupOrphanedGroupInvitations()` in `server/src/logics/groupInvitationCleanup.ts`, Aufruf beim Serverstart (`server/index.ts`).
**Voraussetzung:** Eine `group_invitations`-Zeile mit groupId ohne existierende Gruppe + eine gültige Einladung.
**Schritte:** Funktionsaufruf; zweiter Aufruf.
**Erwartetes Ergebnis:** Verwaiste Zeile gelöscht, gültige unberührt; zweiter Lauf = No-Op.

## Testlandkarte

| AK      | Test              | Datei                                                        |
| ------- | ----------------- | ------------------------------------------------------------ |
| AK1–AK5 | node:test API     | `server/src/express/groups-series-resting.api.test.ts` (neu) |
| AK6     | Vitest Komponente | `frontend/src/components/SeriesTab.test.tsx` (erweitert)     |
| AK6     | e2e mobile-first  | `frontend/e2e/issue-1251-series-resting.spec.ts` (neu)       |
| AK7     | node:test Logik   | `server/src/logics/groupInvitationCleanup.test.ts` (neu)     |
