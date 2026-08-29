import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyCard } from './NearbyCard';
import type { GeoConfig, NearbyTask } from 'client';

/**
 * Spec-Tests (#1110, Spec docs/spec/issue-1110.md) — Card-Titel mit Anzeige-Entfernung.
 *
 * AK1: Das Label lautet `In der Nähe (X km)` mit X = gespeichertem `displayDistanceKm` aus
 * `GET /geo-config` — nicht im Frontend hartcodiert. Heute ist das Label der statische String
 * „In der Nähe" (NearbyCard.tsx) und die Config wird nirgends geladen → rot.
 *
 * KoliBri, useGeolocation und api werden modulweit gemockt (Muster UpdatePrompt.test.tsx):
 * der Hook liefert eine feste Position (jsdom hat kein navigator.geolocation), der KoliBri-Mock
 * spiegelt `_label` als data-label, damit der Titel deterministisch prüfbar ist.
 */

const geoState = {
	supported: true,
	enabled: true,
	pending: false,
	permissionDenied: false,
	unavailable: false,
	position: { latitude: 52.5219, longitude: 13.4132 } as import('../lib/useGeolocation').GeolocationPosition | null,
};

vi.mock('../lib/useGeolocation', () => ({
	useGeolocation: () => geoState,
}));

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
}));

const getGeoConfig = vi.fn<() => Promise<GeoConfig>>();
const listNearbyTasks = vi.fn<() => Promise<NearbyTask[]>>();

vi.mock('../api', () => ({
	api: {
		getGeoConfig: () => getGeoConfig(),
		listNearbyTasks: () => listNearbyTasks(),
	},
}));

const config = (displayDistanceKm: number): GeoConfig =>
	({ displayDistanceKm, alarmDistanceKm: 1, intervalMinutes: 5 }) as GeoConfig;

// Test-Pflege (#1110, Impl-Phase): `getByText('In der Nähe (')` kann nie treffen — der Mock spiegelt
// `_label` ausschließlich als Attribut, und `getNodeText` liest nur direkte Textkinder. Der Locator
// geht daher direkt auf den Mock-Host; die Assertion selbst (data-label) ist unverändert.
const card = (): HTMLElement => document.querySelector('[data-comp="kol-card"]') as HTMLElement;

describe('NearbyCard — Titel mit Anzeige-Entfernung (#1110 AK1)', () => {
	beforeEach(() => {
		getGeoConfig.mockResolvedValue(config(5));
		listNearbyTasks.mockResolvedValue([]);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('baut den Titel aus der gespeicherten Anzeige-Entfernung: „In der Nähe (5 km)" (AK1)', async () => {
		render(<NearbyCard />);

		await waitFor(() => expect(card().getAttribute('data-label')).toBe('In der Nähe (5 km)'));
	});

	it('folgt der Config statt einem Frontend-Default: 12 km → „In der Nähe (12 km)" (AK1)', async () => {
		getGeoConfig.mockResolvedValue(config(12));
		render(<NearbyCard />);

		await waitFor(() => expect(card().getAttribute('data-label')).toBe('In der Nähe (12 km)'));
	});

	it('holt die Config beim Mount per api.getGeoConfig() (kein lokaler Fallback-Wert) (AK1)', async () => {
		render(<NearbyCard />);

		await waitFor(() => expect(getGeoConfig).toHaveBeenCalledTimes(1));
	});

	it('nutzt die Ganzzahl des Config-Werts ohne Nachkommastelle im Titel (AK1)', async () => {
		getGeoConfig.mockResolvedValue(config(7));
		render(<NearbyCard />);

		await waitFor(() => expect(card().getAttribute('data-label')).toBe('In der Nähe (7 km)'));
	});
});
