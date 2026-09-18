import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1484 (T3b, Spec docs/spec/issue-1484.md AK3/AK7) — `GroupFormDialog`.
 *
 * AK3: der Modal-Kopf trägt `<PlanBadge feature="groups" />` — seit #1528 mit `inModal`, also
 * reine Beschriftung ohne Klickziel (AK3, Entscheidung B des Autors).
 *
 * Muster: `DependencyModal.test.tsx` (Modal-Mock ohne Schließverhalten, `useCtrlEnter` gestubbt).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (_e: MouseEvent) => void } }) => (
		<button onClick={(e) => _on?.onClick?.(e.nativeEvent)}>{_label}</button>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="badge">{_label}</span>,
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			defaultValue={_value}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
		/>
	),
	KolTextarea: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<textarea
			aria-label={_label}
			defaultValue={_value}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
		/>
	),
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children?: ReactNode }) => (
		<div data-testid="modal">
			<h2>{title}</h2>
			{children}
		</div>
	),
}));

vi.mock('../lib/useCtrlEnter', () => ({ useCtrlEnter: () => undefined }));

vi.mock('../api', () => ({
	api: { createGroup: vi.fn().mockResolvedValue({}), updateGroup: vi.fn().mockResolvedValue({}) },
}));

import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';
import { GroupFormDialog } from './GroupFormDialog';

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

const renderDialog = (onClose: () => void) => {
	const entitlements: EntitlementMap = {
		groups: { allowed: false, requiredPlan: 'pro' } as EntitlementMap['groups'],
	};
	return render(
		<PlanProvider value={{ plan: 'free', entitlements }}>
			<GroupFormDialog onClose={onClose} onSaved={vi.fn()} />
		</PlanProvider>,
	);
};

// Test-Pflege (#1528): Angebots-Dialog und useClosingOnPlanRequired entfallen (AK1) — der
// Schließen-Test (Entscheidung 7.1) ist gegenstandslos. Entscheidung B des Autors (2026-09-17):
// das Badge ist im Modal reine Beschriftung (`inModal`, kein Klickziel) und schließt nichts.
describe('GroupFormDialog — Paket-Badge im Modal-Kopf (#1484 AK3, #1528)', () => {
	it('zeigt das groups-Badge im Modal-Kopf als Beschriftung ohne Klickziel', () => {
		const onClose = vi.fn();
		renderDialog(onClose);

		const badge = screen.getByTestId('plan-badge-groups');
		expect(badge.closest('a')).toBeNull();

		fireEvent.click(badge);

		expect(onClose).not.toHaveBeenCalled();
	});
});
