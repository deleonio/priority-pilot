import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyCard } from './NearbyCard';
import type { GeoConfig, NearbyTask } from 'client';
import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';

// Test-Pflege (#1528 AK3): das nicht-enthaltene Badge ist außerhalb von Modalen ein Router-Link
// (`<a href="/settings/pakete">` + useNavigate). Diese Suite rendert die Host-Komponente ohne
// Router — der Hook wird deshalb auf einen Stub geleitet; das Klick-Verhalten deckt PlanBadge.test.
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

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
	// #1484: `PlanBadge` (T3a, unverändert) nutzt KolBadge/KolButton aus demselben Modul.
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="badge">{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (_e: MouseEvent) => void } }) => (
		<button onClick={(e) => _on?.onClick?.(e.nativeEvent)}>{_label}</button>
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

/**
 * #1465 (A): Auch „In der Nähe" spricht die Aufgabe mit ihrem Titel an — die interne ID steht in
 * keiner Liste mehr. Die Distanz in Klammern (#1098 AK6) bleibt unverändert.
 */
describe('NearbyCard — kein Task-ID-Präfix im Eintrag (#1465)', () => {
	beforeEach(() => {
		getGeoConfig.mockResolvedValue(config(5));
		listNearbyTasks.mockResolvedValue([
			{ id: 380, title: 'Handy-Anbieter für Amira finden', distanceKm: 2.4 } as NearbyTask,
		]);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('zeigt nur den Titel, keine #<ID> — die Distanz bleibt', async () => {
		render(<NearbyCard />);

		await waitFor(() => expect(document.querySelector('.dashboard-nearby-title')).not.toBeNull());
		expect(document.querySelector('.dashboard-nearby-title')?.textContent).toBe('Handy-Anbieter für Amira finden');
		expect(document.querySelector('.dashboard-nearby-distance')?.textContent).toBe('(2,4 km)');
	});
});

// ── #1484 (T3b AK3/AK4): Paket-Badge im Kartenkopf ──────────────────────────────────────────────

/**
 * AK3: `NearbyCard` rendert `<PlanBadge feature="location_reminders" />` im Kartenkopf. AK4: die
 * Badge-Ausgabe kippt ausschließlich mit der gemockten Entitlement-Map, `NearbyCard` selbst wertet
 * keinen Plan-Wert aus (dieselbe Komponente, zwei Entitlement-Zustände). Heute rendert `NearbyCard`
 * kein Badge — rot, bis `PlanBadge` eingebunden ist (docs/spec/issue-1484.md AK3/AK4).
 */
describe('NearbyCard — Paket-Badge im Kartenkopf (#1484 AK3/AK4)', () => {
	beforeEach(() => {
		getGeoConfig.mockResolvedValue(config(5));
		listNearbyTasks.mockResolvedValue([]);
	});

	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	const renderWithEntitlement = (allowed: boolean) => {
		const entitlements: EntitlementMap = {
			location_reminders: { allowed, requiredPlan: 'max' } as EntitlementMap['location_reminders'],
		};
		return render(
			<PlanProvider value={{ plan: allowed ? 'max' : 'free', entitlements }}>
				<NearbyCard />
			</PlanProvider>,
		);
	};

	it('allowed=true → Haken-Badge ohne (i)-Schalter', async () => {
		renderWithEntitlement(true);

		expect(await screen.findByTestId('plan-badge-location_reminders')).toBeInTheDocument();
		expect(screen.queryByTestId('plan-badge-info-location_reminders')).toBeNull();
	});

	// Test-Pflege (#1528 AK2/AK3): (i)-Schalter entfallen — außerhalb des Modals ist das Badge der Link.
	it('allowed=false → Paket-Badge als Link, keine eigene Paketlogik in NearbyCard (#1528)', async () => {
		renderWithEntitlement(false);

		const badge = await screen.findByTestId('plan-badge-location_reminders');
		expect(badge.closest('a')).toHaveAttribute('href', '/settings/pakete');
		expect(screen.queryByTestId('plan-badge-info-location_reminders')).toBeNull();
	});
});
