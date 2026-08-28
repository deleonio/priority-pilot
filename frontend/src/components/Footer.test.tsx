import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGeolocation } from '../lib/useGeolocation';
import { Footer } from './Footer';

vi.mock('../lib/useGeolocation', () => ({
	useGeolocation: vi.fn(),
}));

type MockGeo = {
	enabled: boolean;
	position: { latitude: number; longitude: number } | null;
	address: string | null;
};

const mockUseGeolocation = vi.mocked(useGeolocation) as unknown as {
	mockReturnValue: (value: Partial<ReturnType<typeof useGeolocation>>) => void;
};

const setGeo = (partial: Partial<MockGeo>): void => {
	mockUseGeolocation.mockReturnValue(partial as unknown as ReturnType<typeof useGeolocation>);
};

const POSITION = { latitude: 52.52, longitude: 13.405 };
const ADDRESS = 'Musterstraße 1, 10115 Berlin';

afterEach(cleanup);

beforeEach(() => {
	setGeo({ enabled: false, position: null, address: null });
});

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

/**
 * Rote Spec-Tests (#1073): Footer zeigt die lesbare Adresse statt der Koordinaten.
 * Rot bis Footer.tsx `address` aus useGeolocation konsumiert.
 */
describe('Footer — Adresse statt Koordinaten (#1073)', () => {
	it('AK1: zeigt die Adresse aus useGeolocation, wenn verfügbar', () => {
		setGeo({ enabled: true, position: POSITION, address: ADDRESS });
		const { getByRole } = render(<Footer version="0.1.602" />);
		const footer = getByRole('contentinfo');
		expect(footer.textContent).toContain(ADDRESS);
		// Roh-Koordinaten werden nicht mehr angezeigt, wenn eine Adresse vorliegt
		expect(footer.textContent).not.toContain('° N');
	});

	it('AK2a: zeigt bei address=null die Koordinaten als Fallback', () => {
		setGeo({ enabled: true, position: POSITION, address: null });
		const { getByRole } = render(<Footer version="0.1.602" />);
		const footer = getByRole('contentinfo');
		expect(footer.textContent).toContain('52.5200° N');
		expect(footer.textContent).toContain('13.4050° E');
		expect(footer.textContent).not.toContain(ADDRESS);
	});

	it('AK2b: behandelt eine leere Adresse wie null (Fallback Koordinaten)', () => {
		setGeo({ enabled: true, position: POSITION, address: '' });
		const { getByRole } = render(<Footer version="0.1.602" />);
		const footer = getByRole('contentinfo');
		expect(footer.textContent).toContain('52.5200° N');
		expect(footer.textContent).not.toContain(' |  | ');
	});

	it('AK3a: trennt Adresse und Version mit " | "', () => {
		setGeo({ enabled: true, position: POSITION, address: ADDRESS });
		const { getByRole } = render(<Footer version="0.1.602" />);
		expect(getByRole('contentinfo').textContent).toBe(`${ADDRESS} | Version 0.1.602`);
	});

	it('AK3b: trennt Fallback-Koordinaten und Version mit " | "', () => {
		setGeo({ enabled: true, position: POSITION, address: null });
		const { getByRole } = render(<Footer version="0.1.602" />);
		expect(getByRole('contentinfo').textContent).toBe('52.5200° N, 13.4050° E | Version 0.1.602');
	});
});
