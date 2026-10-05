import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * #1787 — Paket-Hinweis (`PlanHint`) an den Grenzstellen als `FeaturePopoverButton`.
 * Spezifikation: `docs/spec/issue-1787.md`; Schließen/Persistenz entfallen seit dem Popover-Muster.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolPopoverButton: ({ _label, children, ...rest }: { _label?: string; children?: ReactNode }) =>
		createElement(
			'div',
			{ 'data-testid': (rest as Record<string, string>)['data-testid'], 'aria-label': _label },
			children,
		),
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) =>
		createElement('button', { onClick: () => _on?.onClick?.() }, _label),
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) =>
		createElement('div', { role: 'alert', 'aria-label': _label }, children),
	KolLink: ({ _href, _label }: { _href?: string; _label?: string }) => createElement('a', { href: _href }, _label),
}));
const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate, useInRouterContext: () => true }));

import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';
import { PlanHint } from './PlanHint';

const locked: EntitlementMap = {
	groups: { allowed: false, requiredPlan: 'plus' },
	graph_weight: { allowed: false, requiredPlan: 'plus' },
	location_reminders: { allowed: false, requiredPlan: 'plus' },
};
const renderHint = (feature: 'groups' | 'graph_weight' | 'location_reminders', entitlements: EntitlementMap) =>
	render(createElement(PlanProvider, { value: { plan: 'free', entitlements } }, createElement(PlanHint, { feature })));

afterEach(() => {
	cleanup();
});

describe('PlanHint (#1787)', () => {
	it.each(['groups', 'graph_weight', 'location_reminders'] as const)(
		'AK1: %s nennt Plus, Button „Pakete ansehen“ navigiert auf /settings/pakete',
		(feature) => {
			const { container } = renderHint(feature, locked);
			expect(container.textContent).toContain('Plus');
			fireEvent.click(screen.getByRole('button', { name: 'Pakete ansehen' }));
			expect(navigate).toHaveBeenCalledWith('/settings/pakete');
		},
	);

	it('AK1: allowed:true oder fehlendes Entitlement rendert nichts', () => {
		const allowed = renderHint('groups', { groups: { allowed: true, requiredPlan: 'plus' } });
		expect(allowed.container.textContent).toBe('');
		allowed.unmount();
		const missing = renderHint('groups', {});
		expect(missing.container.textContent).toBe('');
	});

	it('Hinweis ist ein Popover-Button mit Paketnamen im zugänglichen Label und einer Alert-Card darin', () => {
		renderHint('groups', locked);
		expect(screen.getByTestId('plan-badge-groups').getAttribute('aria-label')).toBe('Paket „Plus“ erforderlich');
		expect(screen.getByRole('alert')).toBeTruthy();
	});
});
