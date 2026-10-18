import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Spec-Tests #2696 — WebGL-Gerüst und Farb-Packing an genau einer Stelle
 * (docs/spec/issue-2696.md). Quelltext-Spiegel im Muster von pillarPalette.test.ts:
 * Programmaufbau, Fullscreen-Dreieck, Resize-Guard und Packing stehen nur in
 * lib/webglStage.ts; BalanceFigureGL und HeartGlass importieren sie, statt eine
 * Kopie zu pflegen, die still abdriften kann.
 */

const dir = fileURLToPath(new URL('.', import.meta.url));
const stage = `${dir}webglStage.ts`;
const components = ['BalanceFigureGL.tsx', 'HeartGlass.tsx'] as const;

describe('webglStage — geteiltes WebGL-Gerüst (#2696)', () => {
	it('lib/webglStage.ts existiert', () => {
		expect(existsSync(stage), 'frontend/src/lib/webglStage.ts fehlt — Gerüst noch nicht extrahiert').toBe(true);
	});

	it('das Modul trägt das Gerüst: Programmaufbau, Fullscreen-Dreieck, DPR-Klemme und Packing', () => {
		const source = readFileSync(stage, 'utf8');
		expect(source, 'Programmaufbau (Compile) muss im Modul liegen').toMatch(/gl\.createShader\s*\(/);
		expect(source, 'Programmaufbau (Link) muss im Modul liegen').toMatch(/gl\.createProgram\s*\(/);
		expect(source, 'Fullscreen-Dreieck-Puffer muss im Modul liegen').toMatch(/-1,\s*-1,\s*3,\s*-1,\s*-1,\s*3/);
		expect(source, 'Resize-Backing-Guard mit DPR-Klemme 2 muss im Modul liegen').toMatch(
			/Math\.min\(\s*(?:window\.)?devicePixelRatio\s*\|\|\s*1\s*,\s*2\s*\)/,
		);
		expect(source, 'toSlots muss im Modul deklariert sein').toMatch(/export\s+const\s+toSlots\b/);
		expect(source, 'toSlotBands muss im Modul deklariert sein').toMatch(/export\s+const\s+toSlotBands\b/);
	});

	it.each(components)('%s enthält keine eigene Kopie des Gerüsts mehr', (file) => {
		const source = readFileSync(`${dir}../components/${file}`, 'utf8');
		expect(source, `${file} darf parseColor importieren, nicht deklarieren`).not.toMatch(/const\s+parseColor\s*[:=]/);
		expect(source, `${file} darf toSlots importieren, nicht deklarieren`).not.toMatch(/export\s+const\s+toSlots\b/);
		expect(source, `${file} darf toSlotBands importieren, nicht deklarieren`).not.toMatch(
			/export\s+const\s+toSlotBands\b/,
		);
		expect(source, `${file} darf das Fullscreen-Dreieck nicht mehr selbst anlegen`).not.toMatch(
			/-1,\s*-1,\s*3,\s*-1,\s*-1,\s*3/,
		);
		expect(source, `${file} darf den Programmaufbau nicht mehr selbst machen`).not.toMatch(/gl\.createShader\s*\(/);
		expect(source, `${file} darf die DPR-Klemme nicht mehr selbst machen`).not.toMatch(
			/Math\.min\(\s*(?:window\.)?devicePixelRatio\s*\|\|\s*1\s*,\s*2\s*\)/,
		);
		expect(source, `${file} darf den WebGL2-Kontext nicht mehr selbst holen`).not.toMatch(
			/getContext\(\s*['"]webgl2['"]/,
		);
	});
});
