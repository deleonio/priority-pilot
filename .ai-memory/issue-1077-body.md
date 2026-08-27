### Was ist das Problem?

Die Notifications für Update („Neue Version verfügbar") und Offline („Offline einsatzbereit") kleben am unteren Bildschirmrand über die gesamte Fensterbreite — auf dem Desktop zieht sich die Card dadurch unnötig breit über den Bildschirm.

### Wie soll es sein?

Auf dem Desktop ist die Notification unten rechts positioniert und in ihrer Breite begrenzt (Max-Width), statt über die volle Fensterbreite zu laufen. Auf Mobil bleibt es beim bisherigen Verhalten über die volle Breite.

### Wo tritt es auf?

frontend/src/components/UpdatePrompt.tsx
frontend/src/app.css (`.update-prompt`)
Desktop-Browser (Viewports ≥ 768px), PWA-Update-/Offline-Hinweis

### Woran messen wir das?

- Auf Desktop-Viewports (≥ 768px) ist die Notification unten rechts ausgerichtet und füllt nicht mehr die gesamte Fensterbreite.
- Die Notification hat eine begrenzte Maximalbreite, sodass die Card nicht über den ganzen Schirm zieht.
- Auf Mobil-Viewports (< 768px) bleibt die Notification über die volle Breite wie bisher.
- Die Mobile-Bedienbarkeit bleibt erhalten: Der Aktionsbutton ist auf Mobil weiterhin eine vollbreite Tap-Fläche mit mindestens 44px Höhe.

### Thema (optional)

UX/UI

### Komplexität (optional)

Einfach (klar definierte, isolierte Änderung)

### Screenshots / weitere Hinweise (optional)

![IST-Zustand: Notification über die volle Fensterbreite](https://github.com/user-attachments/assets/37822f58-353a-421d-9a9d-0b3c31121eb9)

<!-- KI-ANALYSE:START stand=2026-08-27T20:51:28Z -->
### Umsetzungskontext
- Betroffene Dateien: `frontend/src/app.css` (`.update-prompt`, ca. Zeilen 1604–1648), `frontend/e2e/pwa-update-prompt.spec.ts`
- Betroffene Komponenten: `.update-prompt`-Container (gerendert von `UpdatePrompt.tsx` — die TSX-Datei selbst bleibt unangetastet, es ist eine reine CSS-Änderung)
- Vorhandenes Muster: `frontend/src/app.css:1638` — der `@media (min-width: 768px)`-Block schaltet für dieselbe Klasse bereits auf Desktop-Styling um; dort erweitern. Test-Muster: CSS-Kontrakt-e2e in `frontend/e2e/pwa-update-prompt.spec.ts` (Stellvertreter-Element mit `.update-prompt` injizieren, `getComputedStyle`/`getBoundingClientRect` auslesen — realer SW-Update-Fluss ist nicht deterministisch, siehe #353/#373-Kommentarblock dort)
- Randbedingungen: Mobile-Verhalten darf nicht brechen — volle Breite < 768px, Aktionsbutton als vollbreite Tap-Fläche ≥ 44px (#1034, `app.css:1628–1636`); bestehende e2e-AK1 (position:fixed) und AK4 (bottom:0) müssen grün bleiben
- Erwartetes Ergebnis: Desktop (≥ 768px) sitzt die Notification unten rechts, `left: auto` statt `left: 0`, Container auf `max-width: 480px` begrenzt und Cards schrumpfen auf Inhaltsbreite (`align-items: flex-end` im Flex-Column-Container); Mobil unverändert volle Breite.
- Lösungsskizze: im bestehenden `@media (min-width: 768px)`-Block ergänzen: `.update-prompt { left: auto; max-width: 480px; align-items: flex-end; }` (`right: 0` und `bottom: 0` stehen bereits in der Basisregel)

### Akzeptanzkriterien
- AK1: Bei Viewport ≥ 768px ist `.update-prompt` rechts ausgerichtet (computed `left: auto`) und nicht mehr vollbreit (Elementbreite laut `getBoundingClientRect()` < Viewportbreite).
- AK2: Bei Viewport ≥ 768px ist die Breite begrenzt: computed `max-width` ≤ 480px.
- AK3: Bei Viewport 375px bleibt `.update-prompt` vollbreit über die Fensterbreite (computed `left: 0px` und `right: 0px`).
- AK4 (Mobile-First): Bei 375px bleibt die Aktionsbutton-Tap-Fläche vollbreit und ≥ 44px hoch — die bestehenden #1034-Tests bleiben grün (Regressionsschutz, kein neuer Test).

### Testfälle
- AK1 + AK2: e2e `frontend/e2e/pwa-update-prompt.spec.ts` — Viewport 1280×800, Stellvertreter-`.update-prompt` injizieren und `left`, `max-width`, `getBoundingClientRect().width` prüfen (Muster wie AK1/AK4 in derselben Datei).
- AK3: e2e wie oben bei 375×812, computed `left`/`right` je `0px`.
- AK4: bestehende #1034-Testfälle in `frontend/e2e/pwa-update-prompt.spec.ts` (Mobile-Bedienbarkeit, ≥44px Tap-Target) — dürfen durch die Änderung nicht rot werden.

### Ampel
- Ampel: 🟢
- Begründung: Isolierte CSS-Ergänzung im bereits vorhandenen 768px-Media-Query; Testmuster (CSS-Kontrakt per Stellvertreter-Element) liegt vor; alle Kriterien verifizierbar formuliert.

### ❓ Offene Fragen
- keine — der konkrete `max-width`-Wert (480px) ist als Empfehlung im Umsetzungskontext hinterlegt und zur Feinjustierung freigegeben, ohne die AKs zu verletzen (Grenze: ≤ 480px).
<!-- KI-ANALYSE:END -->

<!-- ai-phase-routing:START -->
| Phase | Run | Modell | Effort |
| --- | --- | --- | --- |
| ux | ja | haiku | low |
| spec | ja | sonnet | low |
| impl | ja | sonnet | medium |
| review | ja | sonnet | medium |
<!-- ai-phase-routing:END -->
