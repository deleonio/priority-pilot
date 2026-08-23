# E2E A11y-Tests mit axe-core und KoliBri Shadow DOM

## Pattern

KoliBri-Komponenten nutzen Shadow DOM — axe-core muss daher explizit konfiguriert werden, um in Shadow Hosts zu scannen. Flächendeckende Scans (`violations: []` über die ganze App) sind zu fragil (False Positives durch externe Shadow-Roots).

**Lösung**: Gezielte Scans pro Komponente/Seite mit `AxeBuilder`.

## AxeBuilder-Setup (Playwright)

```typescript
import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

test('Beispiel: Scan einzelnes Element', async ({ page }) => {
	await page.goto('/');

	// Scan nur das spezifische Element (nicht die ganze App)
	const results = await new AxeBuilder({ page })
		.include('.component-selector') // Scoped Scan
		.withTags(['wcag2a', 'wcag2aa']) // Nur relevante Regeln
		.exclude('#unrelated-host') // Option: Nicht scannbare Hosts ausschließen
		.analyze();

	expect(results.violations).toEqual([]);
});
```

## Shadow DOM mit KoliBri

KoliBri rendert Komponenten in Shadow DOM (`kol-button`, `kol-card`, etc.). axe-core kann standardmäßig in Shadow DOM scannen, aber:

1. **Scoped Scan**: Immer `include()` auf das konkrete Element setzen, nicht die ganze App scannen
2. **Exclude-Regeln**: Externe Shadow Hosts ausschließen, die nicht zum Test gehören
3. **Tags**: `wcag2a`/`wcag2aa` für Level A/AA Regeln, `wcag21a` für WCAG 2.1

### Beispiel für Kontrast-Test (statt measureContrast)

```typescript
test('Kontrast der Dashboard-Panels im Dunkelmodus', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

	const results = await new AxeBuilder({ page })
		.include('.dashboard-next-task')
		.include('.dashboard-suggestions')
		.withTags(['wcag2aa']) // WCAG AA (inkl. 1.4.3 Kontrast)
		.analyze();

	// Nur Kontrast-Verstöße melden (andere A11y-Themen werden separat getestet)
	const contrastViolations = results.violations.filter(
		(v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
	);
	expect(contrastViolations).toEqual([]);
});
```

## Exclude-Regeln für nicht scannbare Shadow Hosts

Falls ein Shadow Host externe Inhalte rendert (z.B. Embedded-Content, Third-Party), kann er ausgeschlossen werden:

```typescript
const results = await new AxeBuilder({ page })
	.include('.my-component')
	.exclude('.third-party-widget') // Nicht scannbar
	.analyze();
```

## Test-Stabilität

- **Scoped Scan**: Immer konkreten Selektor angeben, keine App-weiten Scans
- **Tags**: Nur relevante Tags nutzen (`wcag2aa` statt aller)
- **Ergebnisse**: Verstöße mit `expect(results.violations)` auswerten, nicht leere Arrays erzwingen (zu fragil)
