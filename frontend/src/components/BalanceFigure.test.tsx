import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18next from '../i18n/config';
import type { Pillar } from 'client';
import { buildHeartBalance } from '../lib/heartBalance';
import { BalanceFigure } from './BalanceFigure';

/**
 * Spec-Tests #2496 AK1 (docs/spec/issue-2496.md): Der Arc-`<title>` der BalanceFigure ist
 * übersetzt — bei englischer Oberfläche kein deutsches „von“, die Zahlen bleiben. jsdom hat
 * kein WebGL2, die Komponente fällt daher auf den SVG-Pfad zurück, in dem die Titel liegen.
 */

const PILLS: Pillar[] = [
	{ id: 1, name: 'Körper', description: '', weight: 1 },
	{ id: 2, name: 'Beziehungen', description: '', weight: 1 },
	{ id: 3, name: 'Arbeit', description: '', weight: 1 },
	{ id: 4, name: 'Sinn', description: '', weight: 1 },
];
const BALANCE = buildHeartBalance(
	PILLS,
	new Map([
		[1, 9],
		[2, 7],
		[3, 5],
		[4, 3],
	]),
);

describe('BalanceFigure — Ring-<title> übersetzt (#2496 AK1)', () => {
	afterEach(async () => {
		cleanup();
		await i18next.changeLanguage('de');
	});

	it('AK1: mit englischer Oberfläche enthält kein Arc-<title> ein deutsches „von“, die Zahlen bleiben', async () => {
		await i18next.changeLanguage('en');
		const { container } = render(
			<BalanceFigure balance={BALANCE} figure="ringe" animated={false} beatSeconds={2} ariaLabel="Testbild" />,
		);
		const titles = Array.from(container.querySelectorAll('title'));
		expect(titles.length, 'die Ringe-Figur zeichnet je Säule einen Arc mit Titel').toBeGreaterThan(0);
		for (const title of titles) {
			expect(title.textContent).toMatch(/\d/);
			expect(title.textContent, 'kein deutsches „von“ in der englischen Oberfläche').not.toContain('von');
		}
	});
});
