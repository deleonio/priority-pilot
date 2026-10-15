import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#2082, docs/spec/issue-2082.md): `BalanceHistoryCard` existiert noch nicht.
import { BalanceHistoryCard } from './BalanceHistoryCard';

/** Spec-Tests für den Füllstand-Verlauf (#2082): AK1 Fenster/Punkte, AK3 Trend + Werte, AK4 Zustände. */

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children, ...rest }: { _label?: string; children?: ReactNode } & Record<string, unknown>) => (
		<div data-comp="kol-card" data-label={_label} {...rest}>
			{children}
		</div>
	),
	KolSpin: ({ _label }: { _label?: string }) => <div data-comp="kol-spin">{_label}</div>,
}));

const getBalanceHistory = vi.fn();
vi.mock('../api', () => ({
	api: { getBalanceHistory: (...args: unknown[]) => getBalanceHistory(...args) },
}));

/** 28 Tage bis 2026-10-15; Füllstand linear von `start` nach `ende`. */
const tage = (start: number, ende: number, hatPunkte = true) =>
	Array.from({ length: 28 }, (_, i) => {
		const d = new Date(Date.UTC(2026, 8, 18 + i));
		return {
			tag: d.toISOString().slice(0, 10),
			fuellstandProzent: start + ((ende - start) * i) / 27,
			hatPunkte,
			saeulen: [],
		};
	});

const q = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);

describe('BalanceHistoryCard (#2082)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	it('AK1: lädt 28 Tage bis heute (von = heute − 27) mit Zeitzone und rendert je Tag einen Punkt', async () => {
		vi.useFakeTimers({ now: new Date(2026, 9, 15, 12), shouldAdvanceTime: true });
		getBalanceHistory.mockResolvedValue(tage(40, 60));
		render(<BalanceHistoryCard />);
		await waitFor(() => expect(document.querySelectorAll('[data-testid="balance-history-point"]')).toHaveLength(28));
		expect(getBalanceHistory).toHaveBeenCalledWith(
			expect.objectContaining({
				von: '2026-09-18',
				bis: '2026-10-15',
				tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			}),
		);
	});

	it.each([
		[40, 60, /Aufwärts/i],
		[60, 40, /Abwärts/i],
		[50, 52, /Stabil/i],
	])('AK3: Trend %i → %i steht als Text da, Start- und Endwert in %', async (start, ende, trendText) => {
		getBalanceHistory.mockResolvedValue(tage(start, ende));
		render(<BalanceHistoryCard />);
		await waitFor(() => expect(q('balance-history-trend')).not.toBeNull());
		expect(q('balance-history-trend')!.textContent).toMatch(trendText);
		expect(q('balance-history-start')!.textContent).toContain(String(start));
		expect(q('balance-history-start')!.textContent).toContain('%');
		expect(q('balance-history-end')!.textContent).toContain(String(ende));
		expect(q('balance-history-end')!.textContent).toContain('%');
		expect(q('balance-history-chart')!.getAttribute('role')).toBe('img');
	});

	it('AK4: während des Ladens erscheint der Spinner', () => {
		getBalanceHistory.mockReturnValue(new Promise(() => {}));
		render(<BalanceHistoryCard />);
		expect(document.querySelector('[data-comp="kol-spin"]')).not.toBeNull();
		expect(q('balance-history-trend')).toBeNull();
	});

	it('AK4: bei Fehler erscheint ein Hinweis in der Card, ohne Wurf und ohne Trend', async () => {
		getBalanceHistory.mockRejectedValue(new Error('boom'));
		render(<BalanceHistoryCard />);
		await waitFor(() => expect(q('balance-history-error')).not.toBeNull());
		expect(q('balance-history-card')).not.toBeNull();
		expect(q('balance-history-trend')).toBeNull();
	});

	it('UX: ohne Punkte in allen 28 Tagen zeigt die Card den Leerzustand statt eines Trends', async () => {
		getBalanceHistory.mockResolvedValue(tage(0, 0, false));
		render(<BalanceHistoryCard />);
		await waitFor(() => expect(q('balance-history-empty')).not.toBeNull());
		expect(q('balance-history-trend')).toBeNull();
	});
});
