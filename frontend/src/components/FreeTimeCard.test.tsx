import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FreeTimeCard } from './FreeTimeCard';

/**
 * Rote Spec-Tests für #1990 (Spec docs/spec/issue-1990.md) — AK4/AK5: ohne Lücke (leere Liste oder
 * Fehler) wird nichts gerendert; mit Lücke zeigt die Karte „Freie Zeit" Zeitraum und Aufgabentitel.
 * Rot, bis `FreeTimeCard` existiert. KoliBri und api werden gemockt (Muster NearbyCard.test.tsx).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
}));

type Slot = { start: string; end: string; tasks: { id: number; title: string }[] };
const listFreeSlots = vi.fn<() => Promise<Slot[]>>();

vi.mock('../api', () => ({ api: { listFreeSlots: () => listFreeSlots() } }));

const slot = (): Slot => ({
	start: new Date(2026, 9, 7, 17, 30).toISOString(),
	end: new Date(2026, 9, 7, 18, 0).toISOString(),
	tasks: [{ id: 7, title: 'Steuerbelege sortieren' }],
});

describe('FreeTimeCard (#1990 AK4/AK5)', () => {
	// Test-Pflege #1990: Block-Body — Vitest 4 ruft eine aus beforeEach zurückgegebene Funktion (hier der Mock) als Teardown auf.
	beforeEach(() => {
		listFreeSlots.mockReset();
	});
	afterEach(cleanup);

	it('AK5: zeigt Karte „Freie Zeit" mit Zeitraum und Aufgabentitel', async () => {
		listFreeSlots.mockResolvedValue([slot()]);
		render(<FreeTimeCard />);
		await waitFor(() =>
			expect(document.querySelector('[data-comp="kol-card"]')?.getAttribute('data-label')).toBe('Freie Zeit'),
		);
		expect(screen.getByText(/17:30.18:00/)).toBeTruthy();
		expect(screen.getByText('Steuerbelege sortieren')).toBeTruthy();
	});

	it('AK4: leere Liste → nichts gerendert', async () => {
		listFreeSlots.mockResolvedValue([]);
		const { container } = render(<FreeTimeCard />);
		await waitFor(() => expect(listFreeSlots).toHaveBeenCalled());
		expect(container.querySelector('[data-comp="kol-card"]')).toBeNull();
		expect(container.textContent).toBe('');
	});

	it('AK4: Abruffehler → nichts gerendert, kein Fehlertext', async () => {
		listFreeSlots.mockRejectedValue(new Error('boom'));
		const { container } = render(<FreeTimeCard />);
		await waitFor(() => expect(listFreeSlots).toHaveBeenCalled());
		expect(container.textContent).toBe('');
	});
});
