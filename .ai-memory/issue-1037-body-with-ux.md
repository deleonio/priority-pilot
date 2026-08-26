Ich möchte, dass sich die Schalter im Tab „KI-Provider" so verhalten, wie sie im Tab „Allgemein" gestylt sind. Dort ist das Styling für Mobil und Desktop gut umgesetzt: mobil volle Breite, auf dem Desktop linksbündig inline.

IST:
<img width="564" height="798" alt="Image" src="https://github.com/user-attachments/assets/b9a3a34b-755a-4b71-9109-7881816815d2" />

SOLL-Beispiel (mobil):
<img width="553" height="525" alt="Image" src="https://github.com/user-attachments/assets/d4ba5ab8-ea81-43ea-a889-5575a02b91b7" />

<!-- KI-ANALYSE:START stand=2026-08-26T07:45:54Z -->

### UI-Bezug

- UI-Bezug: ja
- Begründung: Reines Layout-/Breitenverhalten sichtbarer Bedienelemente im Einstellungen-Tab „KI-Provider" (mobil/desktop).

### Spec

- Spec nötig: ja
- Begründung: Anwendungscode (`frontend/src/**`), von außen per e2e-Geometrie prüfbar — Muster `frontend/e2e/settings-action-buttons.spec.ts` (#1017) existiert bereits.

### Aufwandsklasse

- Aufwandsklasse: sonnet
- Begründung: Eine CSS-Regel plus eine e2e-Datei; Aufwand liegt in der Test-Szene (Custom-Provider anlegen, damit „Bearbeiten"/„Löschen" überhaupt gerendert werden), nicht in der Logik.

### Umsetzungskontext

- Betroffene Dateien: `frontend/src/app.css`, `frontend/src/components/LlmSettings.tsx`, `frontend/e2e/issue-1037-llm-action-buttons.spec.ts` (neu)
- Betroffene Komponenten: `LlmSettings` — Button „Neuer Provider" (`LlmSettings.tsx:298`) und die Aktionsleiste `.llm-provider-admin__actions` mit „Testen"/„Bearbeiten"/„Löschen" (`LlmSettings.tsx:315-337`); CSS-Blöcke `.llm-provider-admin*` (`app.css:1861-1919`).
- Vorhandenes Muster: `frontend/src/app.css:1442-1451` — `.settings-action-btn` löst exakt dieses Verhalten im Tab „Allgemein": mobil `align-self: stretch`, ab `768px` `align-self: flex-start`. Angewendet in `SettingsPage.tsx:206` und `:271` per `class="settings-action-btn"`. Messmuster für die Tests: `frontend/e2e/settings-action-buttons.spec.ts` (Host-BoundingBox gegen Container-Innenbreite aus Computed Style, nicht hartkodiert).
- Randbedingungen:
  - Der KoliBri-Host ist unteilbar (Shadow-DOM ohne CSS-Parts) — gesteuert wird ausschließlich der `kol-button`-Host, kein Eingriff ins Shadow-DOM (#824-ESLint-Guard).
  - Das Desktop-Zeilenlayout der Provider-Liste aus #951 (`.llm-provider-admin__item` als Row, Aktionen rechts) bleibt bestehen; „inline" meint auf dem Desktop Inhaltsbreite statt Vollbreite.
  - Buttons in den Dialogen (`LlmProviderFormDialog`, `LlmProviderDeleteDialog`) sind nicht Teil dieses Tickets.
  - Bestehende Tests `frontend/e2e/llm-settings.spec.ts` und `frontend/src/components/LlmSettings.test.tsx` müssen grün bleiben.
  - Breakpoint einheitlich 768px (= 48rem, wie beide vorhandenen Regeln).
- Erwartetes Ergebnis: Im Tab „KI-Provider" füllt jeder Aktions-Button bei <768px die Container-Innenbreite und steht in einer eigenen Zeile; ab 768px sind alle Aktions-Buttons inhaltsbreit und stehen nebeneinander in einer Zeile — visuell identisch zum Verhalten der Buttons im Tab „Allgemein".

### Akzeptanzkriterien

- AK1: Bei 375px Viewport füllt der Button „Neuer Provider" ≥ 90 % der Innenbreite von `.settings-llm`.
- AK2: Bei 375px Viewport füllen die Buttons einer Provider-Zeile („Testen", bei Custom-Providern zusätzlich „Bearbeiten" und „Löschen") je ≥ 90 % der Innenbreite ihres Containers und stehen untereinander (jeder folgende Button beginnt unterhalb des vorherigen).
- AK3: Bei 1280px Viewport ist der Button „Neuer Provider" inhaltsbreit (< 50 % der Innenbreite von `.settings-llm`) und beginnt an deren linkem Innenrand (±2px).
- AK4: Bei 1280px Viewport stehen die Buttons einer Provider-Zeile nebeneinander (gleiche Zeile, gleiche vertikale Position ±2px) und sind je inhaltsbreit (< 50 % der Zeilenbreite).
- AK5: Kein Button ragt in einem der geprüften Viewports (320px, 375px, 1280px) über den rechten Viewport-Rand hinaus (`x + width ≤ Viewport-Breite`).
- AK6: Die bestehenden Verhaltenstests des Tabs bleiben unverändert grün (`frontend/e2e/llm-settings.spec.ts`, `frontend/src/components/LlmSettings.test.tsx`).

### Testfälle

- Zu AK1/AK2/AK5 (mobil): Akzeptanz-e2e `frontend/e2e/issue-1037-llm-action-buttons.spec.ts`, Viewport 375px (AK5 zusätzlich 320px) — Szene wie `llm-settings.spec.ts`: Custom-Provider per `page.request.post('/api/v1/llm-providers')` anlegen, `/settings/llm` öffnen, Sichtbarkeit der Buttons per `getByRole('button', …)` verifizieren (Schutz gegen die All-Quantor-Falle bei leerer Menge), dann `boundingBox()` der `kol-button`-Hosts gegen die aus Computed Style gelesene Container-Innenbreite messen (Muster `settings-action-buttons.spec.ts`).
- Zu AK3/AK4 (desktop): derselbe Spec-File, Viewport 1280px — Inhaltsbreite und linke Kante bzw. gleiche Zeilenposition der Hosts messen.
- Zu AK6: Bestandstests `pnpm --filter frontend test` (Vitest) und `pnpm --filter frontend exec playwright test llm-settings` unverändert ausführen.
- Mobile-First-Kriterium: AK1/AK2 sind selbst die 375px-Kriterien.

### Ampel

- Ampel: 🟢
- Begründung: Zielverhalten ist durch das vorhandene Muster `.settings-action-btn` exakt definiert, betroffene Dateien sind bekannt, in einem PR umsetzbar, AK und Testfälle sind prüfbar.

### ❓ Offene Fragen

- [ ] Keine.

<!-- KI-ANALYSE:END -->

<!-- KI-UX:START -->

## UX-Beratung

### Mobile-First

Die Spec verfolgt Mobile-First korrekt: Basis ist 375px (≥90% Innenbreite, Buttons gestackt, AK1–AK2), ab 768px Desktop-Layout (inline, AK3–AK4). AK5 prüft auch 320px, was die Reflow-Regel (WCAG 1.4.10) absichert. Kein horizontales Scrollen — bestätigt durch Geometrie-Tests.

### A11y / BITV

- **Touch-Targets:** AK1/AK2 stellen >90% Innenbreite sicher → Click-Fläche ≥44px (Repo-Minimum) und meist deutlich größer, OK.
- **Abstände:** Flex-Layout (`flex-direction: column` auf mobil) schafft automatisch Abstände; Details folgen der Skala (4/8/12/16 px).
- **Fokus:** KoliBri-`kol-button` rendert `:focus-visible` mit `--pp-brand`-Ring (Kontrast gerechnet).
- **Labels:** Buttons haben sichtbare Labels („Neuer Provider", „Testen", „Bearbeiten", „Löschen") oder `aria-label` — Spec prüft per `getByRole('button', { name: … })`.
- **Kontrast:** KoliBri-Buttons erben Farb-Tokens (`--pp-brand`, `--pp-ink`) mit Kontrast ≥4.5:1 (ux-design.md Regel 2).

### KoliBri

`kol-button`-Host wird per `align-self` gesteuert — Shadow-DOM-Ansatz ist sauber (#824). Keine Varianten-Änderungen nötig; Standard `variant="primary"` oder `"secondary"` je nach Kontext. Button-States (hover, active, disabled) liefert KoliBri.

### Design-Sprache

- **Nur Tokens:** `align-self: stretch` (mobil) und `align-self: flex-start` (desktop) sind CSS-Primitives, kein Token-System nötig. Breakpoint **768px** ist bindend (konsistent mit Vorbild `.settings-action-btn`).
- **Spacing:** Flex-Gap/Padding folgt der 4/8/12/16/24/32 px-Skala; Details beim Umsetzungscode.
- **Farben:** Buttons erben `--pp-*`-Rollen aus `app.css` — keine Regel-Änderung nötig.

### Offene UX-Fragen

- Keine. Spec ist klar, Messmuster vorhanden, Randbedingungen dokumentiert.

<!-- KI-UX:END -->
