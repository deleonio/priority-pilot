# Spec #965 — KI-Modell-Auswahl als Icon-Only-Button in der Toolbar

Issue: #965 · Status: Spec-Phase (rote Tests) · Vorgänger: #787 (Toolbar-Integration), #929 (Mobile-Ausblendung — wird aufgehoben)

## Ziel

Der Schalter zur KI-Modell-Auswahl in der Kopf-Toolbar wird kompakter und überall verfügbar:

1. icon-only (Gehirn-Icon, kein sichtbarer Text), statischer Accessible Name „KI-Modell auswählen“,
2. auf allen Viewport-Breiten gerendert — auch mobil (Rückbau der #929-Ausblendung),
3. an 3. Stelle der Toolbar: hinter „Säulen-Berater“, direkt vor „Einstellungen“, auf allen Breiten identisch.

## Vorbedingung

- Angemeldete Sitzung, App geladen (`/`). Die Kopf-Toolbar (`kol-toolbar`, Name „Kopf-Aktionen“) enthält die fünf Kopf-Aktionen (#691) plus KI-Modell-Button.
- `GET /api/v1/llm-config` liefert das konfigurierte Modell (Default `openrouter/free`); die Modell-Liste des Dialogs kommt aus `GET /api/v1/models/free`.

## Schritte & erwartetes Ergebnis (Akzeptanzkriterien)

### AK1 — Icon-only mit statischem Accessible Name

**Schritte:** Header bei 1280px öffnen; Accessible Name des KI-Modell-Buttons bestimmen; `GET /api/v1/llm-config` als Referenz abfragen.

**Erwartet:**

- Der Button hat exakt den statischen Accessible Name „KI-Modell auswählen“ — kein `KI-Modell: …`-Präfix, kein Modellname, kein Ladezustand („Laden…“ entfällt, weil der Name nicht mehr vom Config-Fetch abhängt).
- Der Accessible Name enthält NICHT das konfigurierte Modell (Sollwert aus der API, nicht hartcodiert) — der Modellname ist aus dem Button entfernt.
- Umsetzungsmuster: `_hideLabel: true` + `_icons: { left: { icon: 'fa-solid fa-brain' } }` + statisches `_label: 'KI-Modell auswählen'` (wie die anderen Kopf-Aktionen).

### AK2 — Modellname nur noch im Dialog; kein toter Code

**Erwartet:**

- `toShortName`, `currentModel`-State und der `getLlmConfig`-Mount-Fetch sind aus `App.tsx` entfernt; `onModelSaved`-Prop am Dialog-Aufruf entfällt (Prop bleibt am Dialog optional kompatibel).
- Das aktuelle Modell ist ausschließlich im `ModelSelectionDialog` sichtbar („Aktuelles Modell: …“; der Dialog lädt seine Config selbst).
- Prüfbar über AK1 (Modellname nicht im Button) — der Code-Entfall selbst ist Review-Gegenstand, kein eigener Test (Change-Detector).

### AK3 — Auf allen Breiten gerendert

**Schritte:** Header bei 375×812 öffnen.

**Erwartet:** Der Button mit Accessible Name „KI-Modell auswählen“ ist sichtbar. Die isMobile-Ausblendung aus #929 (`useIsMobile` in App.tsx) ist rückgebaut — der Hook-Import entfällt in App.tsx (Datei bleibt für andere Consumer).

### AK4 — Position 3, auf allen Breiten identisch

**Schritte:** Toolbar bei 1280px und bei 375px betrachten; horizontale Positionen von „Säulen-Berater“, KI-Modell-Button und „Einstellungen“ vergleichen.

**Erwartet:** Säulen-Berater < KI-Modell < Einstellungen (visuelle Links-nach-rechts-Ordnung) — auf beiden Breiten gleich.

### AK5 — Mobile-Header-Vertrag bleibt erfüllt

**Erwartet:** Bei 375px bleibt der Header einzeilig, Höhe ≤ 64px und ohne horizontalen Overflow (bestehender Vertrag aus `mobile-shell.spec.ts` / #485). Platzprobleme werden über `app.css` (Gap/Padding) gelöst, niemals durch Ausblenden. Bestehende Tests decken das ab — kein neuer Test, kein Duplikat.

### AK6 — Bestehende Verträge migriert

**Erwartet:**

- Alle e2e-Selektoren `/KI-Modell:/i` sind auf den neuen Accessible Name umgestellt (`free-models-selection.spec.ts`, `issue-787.spec.ts`).
- Tastatur-Test (#787 A11y): Der Roving-Verbund erreicht den Button jetzt nach zwei Pfeiltasten (Position 3 statt 2).
- #929-erklärende Kommentare (header-appearance.spec.ts AK6, App.tsx toolbarItems) sind aktualisiert.
- Test-Pflege: Der #787-Vertrag „mobil kein Einstieg“ (`toHaveCount(0)` bei 375px) und der Klartext-Label-Check (Modellname im Button-Label) widersprechen AK1/AK3 und werden ersetzt.

## Abgrenzung

- Keine Backend-/API-Änderung; `ModelSelectionDialog` bleibt unverändert.
- Rein visuelle Feinjustage (exakte Gap-Werte in `app.css`) ist Implementierungsdetail von Phase 4, gesichert über den Höhen-/Overflow-Vertrag aus AK5.
