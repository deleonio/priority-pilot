# Testing Guidelines

## 1. Testarten

### E2E-Tests (Playwright)

- Location: `frontend/e2e/**/*.spec.ts`
- Zweck: Integrationstests gegen echte UI
- Ausführung: `npx playwright test` (oder `pnpm test:e2e`)

### Unit-Tests (Vitest)

- Location: `frontend/src/**/*.test.{ts,tsx}`
- Zweck: Isolierte Komponententests
- Ausführung: `pnpm test` (Vitest)

## 2. Testorganisation

- Struktur: Issue-bezogene Spec-Dateien (z. B. `issue-727-range-inputs-layout.spec.ts`)
- Beschreibung: Jeder Test hat einen klaren AK-Bezug (Akzeptanzkriterium)
- Isolation: Tests räumen in `afterEach` auf

## 3. KoliBri-Komponenten testen

### Erlaubt (Öffentliche Schnittstelle)

- **Host-Locators:** `page.locator('kol-button')`, `page.locator('kol-input-range')`
- **Rollen-Locators:** `getByRole('button')`, `getByRole('textbox')`, `getByRole('checkbox')`
- **Namenens-Locators:** `getByLabel()`, `getByText()`, `getByAccessibleName()`
- **Interaktion:** `click()`, `fill()`, `press()`, `selectOption()`
- **Unit-`_`-Prop-Assertions:** Host-Attributes prüfen (z. B. `_label`, `_variant`)

### Verboten (KoliBri-Interna)

- **`.shadowRoot`-Zugriff:** Kein direkter Schatten-DOM-Zugriff in Tests
- **Interne KoliBri-Klassen:** `.kol-span__label`, `.kol-tooltip__floating`, `.kol-icon`, `kolicon-*`
- **Struktur-/Style-Checks im Schatten:** `getComputedStyle()` am Shadow-DOM, `querySelector()` im Schatten

### Ausnahme

- Hydration-Probe in `e2e/helpers.ts` mit dokumentiertem `eslint-disable` (Infrastruktur, keine Assertion)

## 4. ESLint-Guard

Der ESLint-Guard in `frontend/eslint.config.mjs` verhindert Rückfälle:

```js
{
  files: ['e2e/**/*.ts', 'src/**/*.test.{ts,tsx}'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "MemberExpression[property.name='shadowRoot']",
        message: 'KoliBri nicht intern testen — öffentliche Schnittstelle (Rolle/Name/Host) verwenden.',
      },
      {
        selector: 'Literal[value=/^(kol-span--hide-label|kol-tooltip__|kol-icon|kolicon-)/]',
        message: 'Interne KoliBri-Klasse — nicht in Tests verwenden.',
      },
    ],
  },
}
```

Produktionscode-Piercing (`QuickCaptureModal.tsx`, `lib/focus.ts`, `lib/popoverAlign.ts`, `TaskTree.tsx`) ist vom Guard ausgenommen.

## 5. Beispiele

### Gut (Öffentliche Schnittstelle)

```ts
// Host-Locator + Rolle
await expect(page.locator('kol-button').getByRole('button', { name: 'Speichern' })).toBeVisible();

// Accessible Name
await expect(page.getByRole('button', { name: /entfernen/i })).toHaveAccessibleName(/entfernen/i);

// Fokus-Check
await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
```

### Schlecht (KoliBri-Interna)

```ts
// VERBOTEN - Shadow-DOM-Piercing
const shadowBtn = element.shadowRoot?.querySelector('button');

// VERBOTEN - Interne KoliBri-Klasse
const labelSpan = shadowRoot.querySelector('.kol-span__label');

// VERBOTEN - Icon-Rendering prüfen
const hasIcon = await kolButton.evaluate((el) => el.shadowRoot?.querySelector('i.kol-icon') != null);
```

## 6. Bewusste Verluste

Folgende Checks entfallen bewusst (KoliBri-Rendering-Tests, keine App-Verhalten-Tests):

- Icon-Präsenz-Checks (`.kol-icon`, `kolicon-*`)
- sr-only-„kein sichtbares Label"-Checks (`.kol-span--hide-label`)

Der zugängliche Name und die Funktion bleiben gesichert.
