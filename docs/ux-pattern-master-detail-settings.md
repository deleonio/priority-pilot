# UX-Pattern: Haupt-/Unter-Einstellung

Dieses Dokument beschreibt das UX-Pattern **Haupt-/Unter-Einstellung** für Settings-Paare in
Priority Pilot, bei denen eine Haupt-Einstellung eine Gruppe fachlich zusammengehöriger
Unter-Einstellungen freischaltet. Es dient als verbindliche Referenz für künftige
Implementierungs-Issues, die ein solches Master-/Sub-Verhältnis in den Einstellungen umsetzen.

Stabiler Pfad für Querverweise: `docs/ux-pattern-master-detail-settings.md`.

---

## Wann das Pattern eingesetzt wird

Sobald eine Einstellung mehrere Feinschalter oder Regler „besitzt", die nur einen Sinn ergeben,
wenn die übergeordnete Einstellung aktiv ist — etwa Animations-Feinschalter unterhalb eines
Animations-Masters, oder Entfernungs-/Intervall-Regler unterhalb eines Standort-Masters. Statt
jede Unter-Einstellung als eigene, gleichrangige Switch-Zeile zu zeigen, bündelt das Pattern sie
sichtbar unter ihrem Master in einem `KolDetails`.

Vorhandene Umsetzungen dieses Patterns:

- **„Animations-Details"** — Feinschalter „Herz animieren"/„Erledigt animieren" unter dem Master
  „Animationen" (`SettingsPage.tsx`, Tab „Allgemein").
- **„KI-Funktionen-Details"** — Feinschalter „Schnellerfassung aktiv" unter dem Master
  „KI-Features aktiv" (`SettingsPage.tsx`, Tab „KI-Provider").
- **„Standort-Details"** — die drei Geo-Regler (Anzeige-/Alarm-Entfernung,
  Aktualisierungsintervall) unter dem Master „Standort erfassen" (`SettingsPage.tsx`, Tab
  „Standort").

---

## 1. Theoretische Fundierung (Fachliteratur)

- **Progressive Disclosure (Nielsen Norman Group):** Unter-Optionen sind nur relevant, solange die
  übergeordnete Einstellung aktiv ist. Sie werden daher erst dann vollständig sichtbar, wenn ihr
  Master eingeschaltet ist — bei ausgeschaltetem Master bleibt die Oberfläche ruhiger.
- **Gestalt-Prinzip der Nähe/Gruppierung:** Fachlich zusammengehörige Optionen werden visuell als
  eine Einheit erkennbar (ein Aufklapp-Element) statt als lose Aneinanderreihung gleichrangiger
  Switch-Zeilen — das reduziert die wahrgenommene Komplexität der Einstellungsseite.
- **Hick'sches Gesetz (Hick & Hyman):** Weniger initial sichtbare, gleichrangige Entscheidungen
  senken die Entscheidungszeit auf einer Einstellungsseite mit vielen Optionen.

---

## 2. Barrierefreiheit

`KolDetails` verwaltet Fokus und Zustand über die native Summary-/Details-Semantik selbst
(Aufklapp-Button mit korrektem Zustand, per Tastatur bedienbar). Anders als beim
[UX-Pattern: Sequenzielle Bestätigung](ux-pattern-sequential-confirmation.md) ist deshalb **keine**
zusätzliche Fokus-Choreografie beim Öffnen/Schließen erforderlich — das Öffnen/Schließen ist hier
ein Nebeneffekt des Master-Schalters, kein eigenständiger, fokus-relevanter Navigationsschritt.

Sub-Controls bleiben unabhängig vom `KolDetails`-Zustand über `_disabled` korrekt als deaktiviert
markiert (siehe Abschnitt 3) — ihr Zustand ist damit auch für assistive Technologien erkennbar,
selbst wenn das umschließende `KolDetails` zusätzlich geschlossen ist.

---

## 3. Umsetzungsregel

- Das `KolDetails`, das die Unter-Einstellungen umschließt, bindet `_open` direkt an den Zustand
  des Master-Schalters: `_open={masterEnabled}`. Ein zusätzlicher `_on.onToggle`-Handler ist nicht
  nötig — beobachtetes Verhalten: manuelles Auf-/Zuklappen durch die nutzende Person bleibt
  zwischen zwei Master-Umschaltungen möglich, solange sich `_open` dabei nicht ändert (siehe
  `settings-switch-layout.spec.ts` AK9, das den Master-Sync-Fall pinnt).
- Sub-Controls behalten zusätzlich ihr eigenes `_disabled={!masterEnabled}` (bzw. eine erweiterte
  Bedingung, wenn ein weiterer Zustand den Master zusätzlich sperrt, z. B.
  `prefersReducedMotion` bei den Animations-Feinschaltern). Das ist bewusst redundant zum
  `_open`-Binding („Gürtel und Hosenträger"): Es deckt den Fall ab, dass jemand das `KolDetails`
  manuell offen lässt, während der Master (oder eine zusätzliche Bedingung) die Bedienung sperrt.
- `kol-details` ist Teil der App-weiten Transparenz-Regel für KoliBri-Host-Hintergründe (#930,
  `frontend/src/app.css`) — kein eigener Hintergrund, wie bei allen anderen KoliBri-Komponenten in
  Priority Pilot.
- Eingerückte Sub-Zeilen (z. B. `.settings-switch-row--sub`, `.settings-llm-switch-row--sub`)
  zeigen die Zugehörigkeit zum Master zusätzlich visuell.

---

## Präzedenzfall: Ablösung des „immer sichtbar, nur disabled"-Verhaltens

Vor diesem Pattern galt bei den Standort-Reglern (#1098 AK3) die Regel „auch bei ausgeschaltetem
Standort sichtbar, nur deaktiviert — nicht versteckt". Diese Entscheidung wurde bewusst zugunsten
der Einheitlichkeit revidiert: **künftige Master-/Unter-Kombinationen nutzen das kollabierende
`KolDetails`**, nicht mehr das ältere „immer sichtbar + disabled"-Verhalten. Wer eine bestehende
Einstellungsgruppe auf dieses Pattern umstellt, prüft bestehende Spec-Texte und e2e-Tests auf
Formulierungen wie „nicht versteckt" oder „bleibt sichtbar" und passt sie entsprechend an.

---

## Umsetzungshinweise für Folge-Issues

- Neue Master-/Unter-Settings-Paare verwenden von Anfang an dieses Pattern statt einzelner,
  gleichrangiger Switch-Zeilen.
- Künftige Implementierungs-Issues verweisen zur Begründung auf dieses Dokument (stabiler Pfad:
  `docs/ux-pattern-master-detail-settings.md`).
