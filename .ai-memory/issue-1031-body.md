**IST-Zustand**

<img width="1713" height="182" alt="Image" src="https://github.com/user-attachments/assets/914d4652-e52d-435a-92fe-91d0c966b1fc" />

**Wunsch**

Der Update-Hinweis („Neue Version verfügbar") soll mobil besser bedienbar sein — insbesondere soll
das Bedienelement leicht zu treffen sein. Zusätzlich soll der Text menschlicher und beschreibender
formuliert werden.

<!-- KI-ANALYSE:START stand=2026-08-26T00:38:01Z -->

- UI-Bezug: ja
- Spec nötig: ja
- Aufwandsklasse: sonnet
- Betroffene Dateien: `frontend/src/components/UpdatePrompt.tsx`, `frontend/src/app.css`, `frontend/src/components/UpdatePrompt.test.tsx`, `frontend/e2e/pwa-update-prompt.spec.ts`
- Ampel: 🟢

**Begründungen**

- _UI-Bezug_: Reines Darstellungs-/Bedienbarkeitsthema an einer sichtbaren React-Komponente
  (`UpdatePrompt`) plus Textänderung.
- _Spec nötig_: Es wird Anwendungscode unter `frontend/src/**` und `frontend/e2e/**` geändert.
- _Aufwandsklasse_: Mehrere Dateien (Komponente, globales CSS, Unit- + E2E-Tests) und Zusammenspiel
  mit KoliBri-Hosts (Shadow DOM), aber klarer Lösungsweg.

**Umsetzungskontext**

- _Betroffene Dateien_:
  - `frontend/src/components/UpdatePrompt.tsx` — die „Update Message": `KolCard _label="Update"` mit
    Text „Neue Version verfügbar" und `KolButton _label="Neu laden"`; zweite Card `_label="Offline"`
    („App ist offline-bereit" + „Schließen").
  - `frontend/src/app.css:1548-1573` — Block `.update-prompt` (fixiert unten, `left/right: 0`,
    `padding: 1rem` + `env(safe-area-inset-bottom)`, `pointer-events: none`; nur
    `.update-prompt kol-card` ist interaktiv). Es gibt dort **keine** Regel für `kol-button` — die
    Buttons erben nur die KoliBri-Default-Größe, keine Vollbreite und keine Mindesthöhe.
  - `frontend/src/components/UpdatePrompt.test.tsx` — Vitest-Spec: mockt `virtual:pwa-register/react`
    (Modulvariablen `needRefreshValue`/`offlineReadyValue`) und `@public-ui/react-v19`
    (KolCard/KolButton als schlanke DOM-Stellvertreter mit `data-comp`).
  - `frontend/e2e/pwa-update-prompt.spec.ts` — Playwright: prüft den CSS-Kontrakt von
    `.update-prompt` über ein ins Dokument injiziertes Stellvertreter-Element (kein echter
    SW-Update-Zyklus, weil der in Playwright nicht deterministisch reproduzierbar ist).
- _Komponenten_: KoliBri `KolCard` (`_label`), `KolButton` (`_label`, `_variant="primary"`/`"secondary"`).
  Die Klick-Naht liegt auf einem nativen `<span data-testid="pwa-update-reload">`-Wrapper um den
  Button (JSDOM kann `_on.onClick` eines Web Components nicht auslösen); dieses Muster muss erhalten
  bleiben — der reale Button-Klick blubbert an den Wrapper.
- _Vorhandenes Muster_:
  - Touch-Target 44×44 ist die Repo-Konvention (WCAG 2.5.5 / BITV 9.1.3.3), u. a.
    `frontend/src/app.css:973` (`min-height: 44px`), `:1143` (`min-width`/`min-height: 44px`),
    `:239-249` (`--pp-toolbar-height: 2.75rem`).
  - Mobile-First-Stack → Desktop-Row per `@media (min-width: 768px)`, siehe
    `.settings-switch-row` (`frontend/src/app.css:1463-1497`).
  - Menschlich formulierte Hinweistexte als Vorbild: `frontend/src/components/InstallPrompt.tsx`
    („Möchtest du Priority Pilot als App auf deinem Gerät installieren?").
- _Randbedingungen_:
  - KoliBri-Hosts sind block-level; Breiten in Flex-Kontexten explizit setzen statt `flex-shrink: 0`
    (bekannter Fallstrick, Kommentar bei `.settings-switch-row`).
  - `.update-prompt` hat `pointer-events: none`; jedes neu hinzugefügte interaktive Element braucht
    explizit `pointer-events: auto` (bisher nur für `kol-card` gesetzt).
  - iOS-Safe-Area (`env(safe-area-inset-bottom)`) darf nicht verloren gehen.
  - Bei ≤375px darf kein horizontaler Overflow entstehen; Overflow-AKs sind in dieser App **nicht**
    per `scrollWidth` prüfbar (App-Shell clippt mit `overflow-x: hidden`) — stattdessen
    Bounding-Box messen (`el.x + el.width ≤ viewportWidth`).
  - E2E darf keinen echten Service-Worker-Update-Zyklus voraussetzen (siehe Datei-Kommentar).
- _Erwartetes Ergebnis_: Der Update-Hinweis ist bei 320-375px komfortabel bedienbar (Button volle
  Breite bzw. ≥44px hoch, ausreichend Abstand zum Kartenrand, kein Clipping) und trägt einen
  selbsterklärenden Text statt der Stichwort-Meldung.

**Akzeptanzkriterien**

1. Das Bedienelement der Update-Card („Neu laden") hat auf Mobile (≤767px) eine Trefferfläche von
   mindestens 44×44 px und nimmt die volle verfügbare Kartenbreite ein.
2. Das Bedienelement der Offline-Card („Schließen") erfüllt dasselbe 44×44-Minimum.
3. Der Update-Text ist beschreibend statt stichwortartig und nennt Handlung und Wirkung, z. B.
   „Eine neue Version von Priority Pilot ist da. Lade die App neu, um sie zu verwenden." Der
   Offline-Text analog, z. B. „Priority Pilot ist jetzt auch ohne Internetverbindung nutzbar."
4. Bei 320px und 375px Viewport wird nichts abgeschnitten (`el.x + el.width ≤ viewportWidth` für
   Card und Button) und der Hinweis bleibt am unteren Rand fixiert inkl. iOS-Safe-Area.
5. Auf Desktop (≥768px) bleibt die Darstellung kompakt (Button nicht über die gesamte
   Fensterbreite gestreckt) — keine Regression gegenüber dem IST-Zustand.
6. Die bestehende Klick-Naht bleibt funktionsfähig: ein Klick auf „Neu laden" ruft
   `updateServiceWorker(true)`, ein Klick auf „Schließen" ruft `setOfflineReady(false)` — je genau
   einmal (keine Doppelauslösung).

**Testfälle**

- _Unit (`UpdatePrompt.test.tsx`)_: bei `needRefresh=true` enthält die Update-Card den neuen
  beschreibenden Text (AK3); bei `offlineReady=true` den neuen Offline-Text (AK3);
  `fireEvent.click` auf `pwa-update-reload` ruft `updateServiceWorker` genau einmal mit `true`,
  auf `pwa-offline-close` ruft `setOfflineReady` genau einmal mit `false` (AK6).
- _E2E (`pwa-update-prompt.spec.ts`)_: Stellvertreter-Markup mit `.update-prompt` + Card + Button in
  das geladene Dokument injizieren und bei 375×812 sowie 320×568 messen — Button-Bounding-Box
  `height ≥ 44` und `width ≥ 44` (AK1/AK2), `x + width ≤ viewportWidth` für Card und Button (AK4),
  `position: fixed` und `bottom: 0` unverändert (AK4).
- _E2E Desktop_: bei 1280px Breite ist die Button-Breite deutlich kleiner als die Viewport-Breite
  (AK5).

**Offene Fragen**

- Der IST-Screenshot konnte in dieser Umgebung nicht geladen werden (kein Netzzugriff). Die
  Zuordnung „Update Message" → `UpdatePrompt.tsx` folgt aus dem Ticket-Titel und daraus, dass dies
  die einzige Update-Meldung der App ist; das im Ticket genannte „Schalter" wird als das
  Bedienelement der Card (Button „Neu laden") gelesen. Die UX-Phase möge das am Screenshot
  gegenprüfen.

<!-- KI-ANALYSE:END -->
