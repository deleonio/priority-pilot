import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1787 AK1/AK3/AK5 — Inline-Paket-Hinweis (`PlanHint`) an den Grenzstellen.
 * Spezifikation: `docs/spec/issue-1787.md`. Rot, solange `PlanHint.tsx` fehlt.
 */
const alertProps = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: (props: {
		_label?: string;
		_hasCloser?: boolean;
		_on?: { onClose?: () => void };
		children?: ReactNode;
	}) => {
		alertProps.current = props as Record<string, unknown>;
		return createElement(
			'div',
			{ role: 'alert', 'aria-label': props._label, 'data-testid': 'kol-alert' },
			props.children,
			props._hasCloser
				? createElement('button', { 'data-testid': 'closer', onClick: () => props._on?.onClose?.() })
				: null,
		);
	},
	KolLink: ({ _href, _label }: { _href?: string; _label?: string }) => createElement('a', { href: _href }, _label),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';
import { PlanHint } from './PlanHint';

const DAY_MS = 24 * 60 * 60 * 1000;
const locked: EntitlementMap = {
	groups: { allowed: false, requiredPlan: 'plus' },
	graph_weight: { allowed: false, requiredPlan: 'plus' },
	location_reminders: { allowed: false, requiredPlan: 'plus' },
};
const renderHint = (feature: 'groups' | 'graph_weight' | 'location_reminders', entitlements: EntitlementMap) =>
	render(createElement(PlanProvider, { value: { plan: 'free', entitlements } }, createElement(PlanHint, { feature })));

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
	localStorage.clear();
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe('PlanHint (#1787)', () => {
	it.each(['groups', 'graph_weight', 'location_reminders'] as const)(
		'AK1: %s nennt Plus und verlinkt auf /settings/pakete',
		(feature) => {
			const { container } = renderHint(feature, locked);
			expect(container.textContent).toContain('Plus');
			expect(container.querySelector('a')?.getAttribute('href')).toBe('/settings/pakete');
		},
	);

	it('AK1: allowed:true oder fehlendes Entitlement rendert nichts', () => {
		const allowed = renderHint('groups', { groups: { allowed: true, requiredPlan: 'plus' } });
		expect(allowed.container.textContent).toBe('');
		allowed.unmount();
		const missing = renderHint('groups', {});
		expect(missing.container.textContent).toBe('');
	});

	it('AK5: Hinweis hat ein zugängliches Label und einen Schließen-Knopf', () => {
		renderHint('groups', locked);
		expect(screen.getByRole('alert').getAttribute('aria-label')).toBeTruthy();
		expect(alertProps.current._hasCloser).toBe(true);
		expect(screen.getByTestId('closer').tagName).toBe('BUTTON');
	});

	it('AK3: nach dem Schließen 6 Tage 23 h verborgen, nach 7 Tagen wieder sichtbar', () => {
		const first = renderHint('groups', locked);
		act(() => screen.getByTestId('closer').click());
		expect(screen.queryByTestId('kol-alert')).toBeNull();
		first.unmount();

		vi.setSystemTime(Date.now() + 7 * DAY_MS - 60 * 60 * 1000);
		const early = renderHint('groups', locked);
		expect(early.container.textContent).toBe('');
		early.unmount();

		vi.setSystemTime(Date.now() + 60 * 60 * 1000);
		renderHint('groups', locked);
		expect(screen.getByTestId('kol-alert')).toBeTruthy();
	});

	it('AK3: Schließen von groups lässt graph_weight sichtbar', () => {
		const groups = renderHint('groups', locked);
		act(() => screen.getByTestId('closer').click());
		groups.unmount();
		const other = renderHint('graph_weight', locked);
		expect(other.container.textContent).toContain('Plus');
	});
});
