# Spec #2015 — Einstellungen: zweite Ebene ausschließlich Details-Blöcke (Regel 1)

**Stand:** 2026-10-04

## Journey: Einstellungsseite ohne Verschachtelung lesen und auf- und zuklappen

### Ziel

Auf der Einstellungsseite gilt die Regel 1 der Cockpit-Design-Sprache (`.ai-knowledge/ux-design.md`):
Gliederung nur auf oberster Ebene, Details darunter. Es gibt keine Karte in einer Karte und kein
Akkordeon in einer Karte oder in einem Akkordeon; aufklappbare Inhalte zweiter Ebene sind
`KolDetails`-Blöcke über die volle Zeilenbreite.

### Vorbedingung

- Nutzer ist angemeldet und öffnet die Einstellungsseite
- Für die Experten-Inhalte („Was umfasst der Expertenmodus?“, „Einzelne Animationen“,
  „Reichweite und Intervall“) ist der Expertenmodus aktiv (`pp-expert-mode`)
- Für den Sync-Vertrag von „Reichweite und Intervall“ ist die Standorterfassung einschaltbar

### Schritte

1. **Alle Tab-Panels auf Verschachtelungsfreiheit prüfen (AK2, TF1)**
   - Auf jedem Settings-Tab-Panel (Allgemein, Säulen, Kategorien, Standort, Orte, KI,
     Gruppen, Pakete & Abo, Nutzerverwaltung) gilt:
     `querySelector('kol-card kol-card, kol-card kol-accordion, kol-accordion kol-card, kol-accordion kol-accordion') === null`
   - Konkret werden die Verstoß-Stellen umgebaut: „Was umfasst der Expertenmodus?“ und
     „Einzelne Animationen“ werden `KolDetails` in ihren Karten (Tab „Allgemein“), der
     Leerzustand „Noch keine Kategorien“ verliert seine Kartenfläche (Tab „Kategorien“), die
     sechs Gruppen-Detail-Bereiche werden `KolDetails` (Tab „Gruppen“)

2. **Zweite Ebene als `KolDetails` klappen (AK2, TF2)**
   - Die ehemaligen Akkordeon-Labels („Was umfasst der Expertenmodus?“, „Einzelne Animationen“,
     „Offene Einladungen“, „Offene Gruppen-Aufgaben“, „Füreinander angelegt“,
     „Füreinander angelegte Serien“, „Mitglieder einladen“, „Einladungslinks“) existieren als
     `kol-details` und sind per Klick klappbar
   - Die Klapp-Zustands-Syncs bleiben erhalten: „Einzelne Animationen“ folgt dem
     Master-Schalter „Animationen“ (auf → Details offen, aus → zu, #1552)

3. **„Reichweite und Intervall“ in der Standort-Karte (AK3, TF2)**
   - „Reichweite und Intervall“ ist ein `KolDetails` **innerhalb** der Karte „Standorterfassung“
     (kein eigenständiges Akkordeon daneben) und öffnet/schließt synchron mit dem Schalter
     „Standort erfassen“ (bei aus → gerendert, aber zu, #1098)
   - Im Standardmodus bleibt der Block ungerendert (#1984, bedingtes Rendern, kein CSS-Hide)

4. **Leerzustand „Noch keine Kategorien“ ohne Kartenfläche (AK2, TF3)**
   - Der Leerzustand in `CategoryList` rendert kein `kol-card` mehr — Einladungstext und
     Anlege-Aktion bleiben erhalten

5. **Details-Block füllt die Zeilenbreite (AK4, TF4)**
   - Ein geöffnetes `KolDetails` zweiter Ebene ist ein Block über die volle Zeilenbreite;
     bei 375 px entspricht seine Bounding-Box der vollen Zeilenbreite der Details-Blöcke (Bounding-Box-Assert, kein
     `scrollWidth` — die App-Shell clippt `overflow-x: hidden`)

### Kein Testgegenstand

- **AK1 (Dokumentation):** „Heutige Verstöße gegen Regel 1“ in `.ai-knowledge/ux-design.md`
  leeren und die „Umstellung offen“-Hinweise in `docs/ux-pattern-master-detail-settings.md`
  auf den Ist-Zustand bringen — Markdown-Inhalte sind laut Testkonzept kein Testgegenstand
  (ADR 0001); die Doku-Pflege ist Teil des Implementierungs-PR.
- Konforme Flächen bleiben unverändert: TaskForm-Sektionen (#1285), Orte-Tab (zwei
  Top-Level-Karten), KI-Tab (#1903), Abo/Pakete (#1902).

### Erwartetes Ergebnis

- Kein Panel der Einstellungsseite enthält eine verschachtelte Karte oder ein verschachteltes
  Akkordeon (TF1)
- Alle ehemaligen Akkordeon-Labels zweiter Ebene sind als `kol-details` vorhanden, klappbar und
  behalten ihre Sync-Verträge (TF2)
- Der Kategorien-Leerzustand kommt ohne Kartenfläche aus (TF3)
- Geöffnete Details-Blöcke füllen bei 375 px die volle Zeilenbreite (TF4)
- KoliBri-Eigenheiten bleiben erhalten: key-Remounts und `_disabled`-Logik der Geo-Regler
  (#1098), Experten-Renderung nur bei expertMode (#1984)
