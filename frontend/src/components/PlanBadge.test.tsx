import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1528 AK2/AK3 — Paket-Badge als Beschriftung/Verweis statt Angebots-Dialog.
 *
 * Spezifikation: `docs/spec/issue-1528.md`. Außerhalb von Modalen ist das Badge ein Navigationsziel
 * auf den Pakete-Reiter (Entscheidung B des Autors), innerhalb von Modalen reine Beschriftung ohne
 * Klickziel. Der (i)-Schalter (`plan-badge-info-{feature}`) entfällt. Die Tests sind rot, solange
 * `PlanBadge` noch den (i)-Schalter rendert und `pp:plan-required` dispatched.
 *
 * Review #1564 F2: KolBris `_color` akzeptiert nur Hex — `var(…)` wird still verworfen und das
 * Badge bliebe ungefärbt. Der Mock fängt `_color` mit ab, damit AK2s Farben (grünes „enthalten",
 * graues Status-Badge) testabgedeckt sind statt nur sichtbar zu sein.
 */
const badgeColors = vi.hoisted(() => [] as string[]);

vi.mock('@public-ui/react-v19', () => ({
	KolBadge: ({ _label, _color }: { _label?: string; _color?: string }) => {
		badgeColors.push(_color ?? '(ohne _color)');
		return createElement('span', { 'data-testid': 'badge' }, _label);
	},
	KolButton: ({ _label }: { _label?: string }) => createElement('button', null, _label),
}));

const getPlansCatalog = vi.fn();
vi.mock('../api', () => ({ api: { getPlansCatalog: () => getPlansCatalog() } }));

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

import type { EntitlementMap, Plan } from '../lib/planOffers';
import { featureOffer, planLabel } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';
import { PlanBadge } from './PlanBadge';

const withPlan = (plan: Plan | null, entitlements: EntitlementMap, children: ReactNode) =>
	createElement(PlanProvider, { value: { plan, entitlements } }, children);

beforeEach(() => {
	getPlansCatalog.mockResolvedValue({
		features: [{ feature: 'groups', allowedPlans: ['pro', 'max', 'ultimate'] }],
		prices: { free: { monthly: 0, yearly: 0 }, pro: { monthly: 799, yearly: 7670 } },
	});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
	badgeColors.length = 0;
});

describe('PlanBadge Beschriftung (#1528 AK2, Spec issue-1528.md)', () => {
	it('allowed=true → nennt Funktion und Paket und zeigt ein Häkchen; kein (i)-Schalter', () => {
		render(
			withPlan(
				'pro',
				{ groups: { allowed: true, requiredPlan: 'pro' } },
				createElement(PlanBadge, { feature: 'groups' }),
			),
		);

		const badge = screen.getByTestId('plan-badge-groups');
		expect(badge.textContent).toContain(featureOffer('groups').title);
		expect(badge.textContent).toContain(planLabel('pro'));
		// Häkchen (Text + Icon, WCAG 1.4.1 — UX-Block) statt nacktem Farb-Marker
		expect(badge.textContent.toLowerCase()).toContain('enthalten');
		expect(screen.queryByTestId('plan-badge-info-groups')).toBeNull();
		// #1564 F2: „enthalten" ist Erfolgs-Grün als Hex (KoliBri verwirft var(…) still)
		expect(badgeColors).toContain('#1a7f37');
	});

	it('allowed=false → nennt Funktion und nötiges Paket; kein (i)-Schalter', () => {
		render(
			withPlan(
				'free',
				{ groups: { allowed: false, requiredPlan: 'pro' } },
				createElement(PlanBadge, { feature: 'groups' }),
			),
		);

		const badge = screen.getByTestId('plan-badge-groups');
		expect(badge.textContent).toContain(featureOffer('groups').title);
		expect(badge.textContent).toContain(planLabel('pro'));
		expect(screen.queryByTestId('plan-badge-info-groups')).toBeNull();
		// #1564 F2: Verweis-Badge in der neutralen Status-Farbe (Hex statt var)
		expect(badgeColors).toContain('#3f4a5c');
	});

	it('ohne Entitlement rendert das Badge nichts (kein falscher Zustand vor der Antwort)', () => {
		render(withPlan(null, {}, createElement(PlanBadge, { feature: 'groups' })));

		expect(screen.queryByTestId('plan-badge-groups')).toBeNull();
	});
});

describe('PlanBadge Klick-Verhalten (#1528 AK3, Entscheidung B)', () => {
	it('außerhalb von Modalen: Klick navigiert auf den Pakete-Reiter', () => {
		render(
			withPlan(
				'free',
				{ groups: { allowed: false, requiredPlan: 'pro' } },
				createElement(PlanBadge, { feature: 'groups' }),
			),
		);

		fireEvent.click(screen.getByTestId('plan-badge-groups'));

		expect(navigate).toHaveBeenCalledWith('/settings/pakete');
	});

	it('in Modal-Kontext (inModal): kein Klickziel — Klick navigiert nicht', () => {
		render(
			withPlan(
				'free',
				{ groups: { allowed: false, requiredPlan: 'pro' } },
				createElement(PlanBadge, { feature: 'groups', inModal: true }),
			),
		);

		fireEvent.click(screen.getByTestId('plan-badge-groups'));

		expect(navigate).not.toHaveBeenCalled();
	});
});
