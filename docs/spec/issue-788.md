# Issue 788: LLM-Einstellungsmenü optimieren

**Stand:** 2026-08-19
**Ziel:** Kompaktere Darstellung der LLM-Einstellungen mit verbesserter UX.

---

## Szenario 1: API-Key-Eingabe mit Anzeige als Punkte

### Ziel

Gesetzte API-Keys werden direkt in den Eingabefeldern als Punkte (••••) angezeigt, keine separaten "Key gesetzt"-Anzeigen mehr.

### Vorbedingung

- User befindet sich im LLM-Einstellungsmenü
- Eingabefelder für API-Keys sind leer oder bereits gefüllt

### Schritte

1. **API-Key eingeben**
   - User tippt API-Key in ein InputPassword-Feld ein
   - Bei jedem eingegebenen Zeichen erscheint ein Punkt (•) statt des Klartextes

2. **Key ist vollständig eingegeben**
   - Das Feld zeigt nur noch Punkte (••••) an
   - X-Button erscheint rechts im/nach dem Feld

### Erwartetes Ergebnis

- Feld zeigt nur Punkte (••••) an, nicht den Klartext
- X-Button ist sichtbar (min 44×44px für Mobile)
- Keine separate "Key gesetzt"-Anzeige mehr im UI

---

## Szenario 2: X-Button zum Löschen von Keys

### Ziel

User kann gesetzte API-Keys direkt über einen X-Button löschen.

### Vorbedingung

- Ein API-Key ist bereits gesetzt (Feld zeigt Punkte an)
- X-Button ist sichtbar

### Schritte

1. **X-Button klicken**
   - User klickt auf den X-Button
   - Key wird sofort gelöscht

2. **Feld ist leer**
   - Das InputPassword-Feld ist wieder leer
   - X-Button verschwindet

### Erwartetes Ergebnis

- X-Button ist nur sichtbar wenn Key gesetzt
- Klick auf X-Button löscht den Key sofort
- X-Button verschwindet nach dem Löschen
- Tastatur-Navigation: X-Button ist mit Tab erreichbar, mit Enter/Space aktivierbar

---

## Szenario 3: Model-Auswahl als Single-Select

### Ziel

OpenRouter-Modelle werden über Single-Select ausgewählt, kein Modal mehr.

### Vorbedingung

- User befindet sich im LLM-Einstellungsmenü
- Provider "OpenRouter" ist ausgewählt

### Schritte

1. **Model-Auswahl öffnen**
   - User klickt auf das Model-Auswahl-Feld
   - Ein Dropdown (Single-Select) öffnet sich

2. **Model auswählen**
   - User wählt ein Modell aus der Liste
   - Das Dropdown schließt sich
   - Das gewählte Modell wird im Feld angezeigt

### Erwartetes Ergebnis

- Kein Modal öffnet sich
- Single-Select funktioniert direkt im UI
- Auswahl wird sofort übernommen

---

## Szenario 4: Mobile-First kompakteres UI

### Ziel

UI ist insgesamt kompakter, auch auf mobilen Geräten (ab 320px).

### Vorbedingung

- User öffnet LLM-Einstellungsmenü auf Mobile (≤480px) oder Desktop

### Schritte

1. **UI prüfen**
   - User scrollt durch das Einstellungsmenü
   - Alle Felder sind sichtbar und gut erreichbar

### Erwartetes Ergebnis

- InputPassword + X-Button sind platzsparend integriert
- Touch-Ziele sind min 44×44px (ideal 48×48px)
- Keine redundante "Key gesetzt"-Anzeige mehr
- UI ist kompakter als vorher

---

## Szenario 5: Accessibility (A11y)

### Ziel

UI ist barrierefrei gemäß BITV-2.1-PS.

### Vorbedingung

- User nutzt Screenreader oder Tastatur-Navigation

### Schritte

1. **Screenreader-Test**
   - User navigiert mit Screenreader durch das Feld
   - Status-Änderungen werden angesagt

2. **Tastatur-Test**
   - User navigiert mit Tab durch alle Elemente
   - X-Button ist mit Tab erreichbar und mit Enter/Space aktivierbar

### Erwartetes Ergebnis

- inputPassword mit aria-describedby="key-status" verknüpft
- X-Button mit aria-label="API-Key löschen" auszeichnet
- Status-Änderung ("Key gesetzt"/"Key gelöscht") als ARIA-Live-Region
- Kontrastverhältnis 4.5:1 für X-Button (bei hover/focus)

---

## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, LLM-Einstellungen optimiert
- **v1.0** (2026-08-17): Initialefassung für Issue #788
