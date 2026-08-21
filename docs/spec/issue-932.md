# Spec: Issue 932 — Button „Push testen" inline statt block-füllend

## Ziel

Der „Push testen"-Button im Einstellungen-Tab „Allgemein" rendert nicht mehr über die gesamte Container-Breite, sondern inline (nur so breit wie sein Inhalt).

## Vorbedingung

- Nutzer ist auf `/settings/general`
- Push-Benachrichtigungen sind aktiviert (der Button ist bedingt gerendert: `{pushEnabled && <KolButton … />}`)

## Schritte

1. `/settings/general` öffnen
2. „Push-Nachrichten aktivieren" einschalten (falls noch nicht geschehen)

## Erwartetes Ergebnis

- **AK1:** Der Button „Push testen" nimmt nicht die volle Container-Breite ein.
- **AK2:** Horizontales Padding links und rechts ist gleichmäßig (KoliBri-Default).
- **AK3:** Layout der umgebenden Controls (Checkboxen, Alerts) bleibt unverändert.
- **AK4:** Auf Mobile (375px) und Desktop (≥768px) visuell konsistent.

## Technische Lösung

`.settings-general` ist ein Flex-Column-Container. Flex-Items erben standardmäßig `width: 100%`. Der Fix setzt auf dem `kol-button` innerhalb `.settings-general`:

```css
.settings-general kol-button {
	align-self: flex-start;
}
```

Dies ist der minimalistischste Eingriff – kein DOM-Change, kein neues Markup, kein Verstoß gegen Mobile-UI-Regeln (44px-Touch-Target bleibt durch KoliBri garantiert).

## Testabdeckung

- Keine automatisierten Tests (reiner CSS-Fix, keine Logik-Änderung). Visuelle Regression über manuellen Check/Review.
- Die Sichtbarkeit des Buttons wird bereits durch `frontend/e2e/push-test-button.spec.ts` geprüft (#386 AK1).
