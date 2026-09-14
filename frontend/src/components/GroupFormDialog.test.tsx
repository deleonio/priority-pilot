import { act, cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1484 (T3b, Spec docs/spec/issue-1484.md AK3/AK7) — `GroupFormDialog`.
 *
 * AK3: der Modal-Kopf trägt `<PlanBadge feature="groups" />`.
 * AK7: `GroupFormDialog` ruft (anders als heute) `useClosingOnPlanRequired(onClose)` wie
 * `DependencyModal.tsx:124`/`QuickCaptureModal.tsx:179` — ein `pp:plan-required`-Event während der
 * Dialog offen ist, schließt ihn (kein Modal-in-Modal, docs/mobile-ui-rules.md).
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

import { PLAN_REQUIRED_EVENT } from '../lib/apiError';
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

describe('GroupFormDialog — Paket-Badge und Schließen vor dem Angebot (#1484 AK3/AK7)', () => {
	it('zeigt das groups-Badge im Modal-Kopf', () => {
		renderDialog(vi.fn());

		expect(screen.getByTestId('plan-badge-groups')).toBeInTheDocument();
	});

	it('ruft onClose genau einmal, sobald ein Paket-Angebot angefordert wird (kein Modal-in-Modal)', () => {
		const onClose = vi.fn();
		renderDialog(onClose);

		expect(onClose).not.toHaveBeenCalled();

		act(() => {
			window.dispatchEvent(
				new CustomEvent(PLAN_REQUIRED_EVENT, {
					detail: { feature: 'groups', requiredPlan: 'pro', currentPlan: 'free' },
				}),
			);
		});

		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
