# Issue 718 — Avatar im Header auf Mobile wiederherstellen

**Stand:** 2026-08-17  
**Issue:** #718 "Avatar im Header auf Mobile wiederherstellen (unter 48rem ausgeblendet)"

## Ziel

Der Avatar (Benutzerbild im Header) ist über alle Bildschirmgrößen hinweg sichtbar — auch auf schmalen Viewports (< 768px / 48rem). Mobil darf ggf. nur der Klartextname entfallen, der Avatar selbst soll erhalten bleiben.

## Vorbedingung

- App ist gestartet und geladen
- Benutzer ist angemeldet (Fixture: { displayName: 'Test User', email: 'test@example.com' })

## Schritte

1. **Avatar bei Mobile-Breite (<48rem) prüfen**
   - Viewport auf 375×812 setzen
   - App laden (/) → Header sichtbar
   - `kol-avatar` im Header sichtbar

2. **Avatar bei Tablet-Breite (48rem–64rem) prüfen**
   - Viewport auf 768×1024 setzen
   - App laden (/) → Header sichtbar
   - `kol-avatar` im Header sichtbar

3. **Avatar bei Desktop-Breite (>64rem) prüfen**
   - Viewport auf 1280×800 setzen
   - App laden (/) → Header sichtbar
   - `kol-avatar` im Header sichtbar

4. **Header-Einzeiligkeit prüfen**
   - Bei allen Viewports: Header-Höhe < Summe der einzelnen Elemente (kein Umbruch)

5. **Bestehende Avatar-Maße prüfen**
   - Avatar = 1,25 × Toolbar-Button-Höhe (aus #485 AK3)
   - Logo, Toolbar-Button, Avatar auf gemeinsamer Mittellinie (aus #485 AK4)

## Erwartetes Ergebnis

- Avatar (`kol-avatar`) ist bei **allen** Viewports sichtbar: Mobile (<48rem), Tablet (48rem–64rem), Desktop (>64rem)
- Header bleibt einzeilig (kein Umbruch) bei allen Breiten
- Avatar-Maße aus #485 bleiben erfüllt (1,25× Toolbar-Button-Höhe, gemeinsame Mittellinie)
- Klartextname `.user-display-name` darf mobil ausgeblendet sein
- E2E `header-appearance.spec.ts` AK3 (Avatar-Sichtbarkeit) läuft weiter

## Testfälle (abgeleitete Akzeptanzkriterien)

| Viewport           | Erwartetes Verhalten                | Assertion                                         |
| ------------------ | ----------------------------------- | ------------------------------------------------- |
| Mobile (375×812)   | `kol-avatar` sichtbar               | `page.locator('header kol-avatar').toBeVisible()` |
| Tablet (768×1024)  | `kol-avatar` sichtbar               | `page.locator('header kol-avatar').toBeVisible()` |
| Desktop (1280×800) | `kol-avatar` sichtbar               | `page.locator('header kol-avatar').toBeVisible()` |
| Alle Viewports     | Header einzeilig                    | `header.height < logo.height + avatar.height`     |
| Desktop (#485 AK3) | Avatar = 1,25 × Toolbar-Button-Höhe | `avatar.height ≈ button.height * 1.25`            |

## Hinweise zur Test-Strategie

- **NUR Anwendungscode-Pfade:** Frontend-e2e Tests unter `frontend/e2e/`
- **UI-Änderung:** Visuelle Verifikation (Avatar-Platzierung, Header-Höhe) im PR-Body durch Screenshots begründen
- **Mutations-Resistenz:** Tests prüfen Avatar-Sichtbarkeit direkt am Selektor `kol-avatar`, nicht nur an CSS-Klassen
- **All-Quantor-Test-Falle:** Sicherstellen, dass überhaupt Avatar-Elemente gefunden werden (nicht dauerhaft grün über leere Menge)

## Konflikt mit bestehenden Tests

⚠️ **Test-Pflege-Bedarf**: `frontend/e2e/header-appearance.spec.ts` AK6 (Zeile 232) erwartet aktuell, dass `.user-info` auf 375px **HIDDEN** ist:

```typescript
await expect(header.locator('.user-info')).toBeHidden();
```

Dies widerspricht Issue 718 (Avatar soll sichtbar sein). Der betreffende Test muss **entfernt** werden, da #718 #691 (ursprüngliche Begründung für Ausblendung) teilweise revidiert.

---

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #718. Avatar im Header auf Mobile wiederherstellen spezifiziert.
- **v1.1** (2026-08-17): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits implementiert: Avatar (.user-display-name) ist sichtbar in App.tsx, keine Ausblendung mehr bei Mobile.

---

## Status

**ABGESCHLOSSEN** — Avatar-Sichtbarkeit auf Mobile ist implementiert und in Produktion.
