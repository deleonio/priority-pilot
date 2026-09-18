import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanProvider } from '../lib/usePlan';
import { planLabel } from '../lib/planOffers';

/**
 * Rote Spec-Tests für #1565 — „Paket-Selbstwechsel des Admins zieht in den Tab Pakete um".
 *
 * Spec-Bezug: docs/spec/issue-1565.md (AK1, Verhalten der Karte „Eigenes Paket").
 *
 * Vertrag der neuen Komponente `OwnPlanCard` (frontend/src/components/OwnPlanCard.tsx, existiert
 * noch nicht — roter Zustand über fehlendes Modul): Prop `userId`, Plan + `refresh` aus dem
 * `PlanProvider`-Kontext. Wechsel = `api.updateUserPlan({ id, plan })`, DANACH `refresh()`
 * (/auth/me neu laden — UI und Session sofort aktuell, AK1). Fehler als `KolAlert` IN der Karte.
 *
 * Auswahl-Mock bewusst komponentenagnostisch (Muster AdminUsersSection.test.tsx): `KolSelect` UND
 * `KolSingleSelect` rendern als native Combobox — die Implementierung darf beide KoliBri-Wege
 * nutzen (KI-UX-Block empfiehlt KolSingleSelect, toleriert KolSelect).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<section aria-label={_label}>{children}</section>
	),
	KolSelect: selectMock,
	KolSingleSelect: selectMock,
}));

/** Native Combobox als Double für beide zulässigen KoliBri-Auswahl-Komponenten. */
function selectMock({
	_label,
	_options,
	_value,
	_on,
}: {
	_label?: string;
	_options?: Array<string | { label?: string; value?: string }>;
	_value?: string;
	_disabled?: boolean;
	_on?: { onChange?: (event: Event, value: string) => void };
}) {
	return (
		<select
			aria-label={_label}
			value={_value ?? ''}
			onChange={(event) => _on?.onChange?.(event as unknown as Event, event.currentTarget.value)}
		>
			{_options?.map((option, index) => {
				const label = typeof option === 'string' ? option : (option.label ?? String(option.value));
				const value = typeof option === 'string' ? option : String(option.value);
				return (
					<option key={index} value={value}>
						{label}
					</option>
				);
			})}
		</select>
	);
}

vi.mock('../api', () => ({
	api: {
		updateUserPlan: vi.fn(),
	},
}));

import { api } from '../api';
// #1565: `OwnPlanCard` existiert noch nicht (roter Zustand) — der Default-Import scheitert bis zur
// Implementierung am Modulauflöser; alle Tests dieses Files sind genau dafür rot.
// @ts-expect-error fehlendes Modul ist der erwartete rote Zustand (Spec-Phase)
import { OwnPlanCard } from './OwnPlanCard';

const mockUpdateUserPlan = api.updateUserPlan as ReturnType<typeof vi.fn>;

/** Plan-Kontext der Karte: aktueller Plan + beobachtbarer refresh-Spy (AK1: Refresh nach Wechsel). */
const renderCard = (plan: 'free' | 'pro' | 'max' | 'ultimate', userId = 7) => {
	const refresh = vi.fn().mockResolvedValue(undefined);
	render(
		<PlanProvider value={{ plan, entitlements: {}, refresh }}>
			<OwnPlanCard userId={userId} />
		</PlanProvider>,
	);
	return { refresh };
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('OwnPlanCard — eigene Paket-Karte im Tab Pakete (#1565, Spec AK1)', () => {
	it('AK1: rendert eine Auswahl mit genau den vier Paketen, aktuelles vorausgewählt', () => {
		renderCard('free');

		const select = screen.getByRole('combobox', { name: 'Eigenes Paket wechseln' });
		const options = within(select).getAllByRole('option');
		expect(options.map((option) => option.textContent)).toEqual([
			planLabel('free'),
			planLabel('pro'),
			planLabel('max'),
			planLabel('ultimate'),
		]);
		expect(select, 'aktuelles Paket ist vorausgewählt').toHaveValue('free');
	});

	it('AK1: Wechsel ruft updateUserPlan mit der EIGENEN Id und dem Paket, danach refresh (/auth/me)', async () => {
		const { refresh } = renderCard('free', 7);
		mockUpdateUserPlan.mockResolvedValue({});

		fireEvent.change(screen.getByRole('combobox', { name: 'Eigenes Paket wechseln' }), {
			target: { value: 'pro' },
		});

		await waitFor(() => expect(mockUpdateUserPlan).toHaveBeenCalledTimes(1));
		expect(mockUpdateUserPlan).toHaveBeenCalledWith({ id: 7, plan: 'pro' });
		// Refresh NACH dem PATCH (Reihenfolge ist der Vertrag: erst Server, dann /auth/me neu lesen).
		await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
	});

	it('AK1 (Fehlerpfad): Server-Fehler des Wechsels landet als KolAlert in der Karte', async () => {
		renderCard('free');
		mockUpdateUserPlan.mockRejectedValue(new Error('Das Paket muss eines von free, pro, max, ultimate sein.'));

		fireEvent.change(screen.getByRole('combobox', { name: 'Eigenes Paket wechseln' }), {
			target: { value: 'max' },
		});

		await waitFor(() =>
			expect(screen.getByRole('alert')).toHaveTextContent('Das Paket muss eines von free, pro, max, ultimate sein.'),
		);
	});
});
