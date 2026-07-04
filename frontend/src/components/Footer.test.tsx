import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Footer } from './Footer';

afterEach(cleanup);

/**
 * Rote Spec-Tests (#290): Footer-Komponente zeigt die App-Version.
 * Rot bis Footer.tsx existiert und ein <footer role="contentinfo"> mit der Version rendert.
 */
describe('Footer — App-Version anzeigen (#290)', () => {
	it('AK1: rendert ein contentinfo-Element mit der übergebenen Version', () => {
		const { getByRole } = render(<Footer version="1.2.3" />);
		const footer = getByRole('contentinfo');
		expect(footer).toBeDefined();
		expect(footer.textContent).toContain('1.2.3');
	});

	it('AK1b: Version-Text entspricht dem Semver-Muster', () => {
		const { getByRole } = render(<Footer version="0.1.0" />);
		const footer = getByRole('contentinfo');
		expect(footer.textContent).toMatch(/\d+\.\d+\.\d+/);
	});

	it('AK1c: enthält keinen fest verdrahteten Versions-String — nur die prop', () => {
		const { getByRole } = render(<Footer version="9.9.9" />);
		const footer = getByRole('contentinfo');
		expect(footer.textContent).toContain('9.9.9');
		// Wenn der String hartkodiert wäre, würde dieser Test fehlschlagen
		expect(footer.textContent).not.toContain('0.1.0');
	});
});
