import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1362, Spec docs/spec/issue-1362.md): `MilestoneBadges` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/MilestoneBadges.tsx` die Komponente bereitstellt.
import { MilestoneBadges } from './MilestoneBadges';

/**
 * Spec-Tests für die Meilenstein-Card (AK7, #1362): rendert alle Stufen aus
 * `GET /scores/milestones`; erreichte und nicht erreichte Badges sind über `data-erreicht`
 * unterscheidbar, nicht erreichte bleiben sichtbar statt ausgeblendet zu werden.
 *
 * KoliBri und `api` werden modulweit gemockt (Muster `StreakCard.test.tsx`).
 */

type Stufe = { schluessel: string; typ: 'streak' | 'punkte'; schwelle: number; erreicht: boolean };

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
	KolBadge: ({ _label, _color }: { _label?: string; _color?: unknown }) => (
		<span data-comp="kol-badge" data-label={_label} data-color={JSON.stringify(_color)} />
	),
}));

const getMilestones = vi.fn<() => Promise<Stufe[]>>();

vi.mock('../api', () => ({
	api: {
		getMilestones: () => getMilestones(),
	},
}));

const card = (): HTMLElement => document.querySelector('[data-comp="kol-card"]') as HTMLElement;
const badges = (): HTMLElement[] => Array.from(document.querySelectorAll('[data-erreicht]'));

const STUFEN: Stufe[] = [
	{ schluessel: 'streak-3', typ: 'streak', schwelle: 3, erreicht: true },
	{ schluessel: 'streak-7', typ: 'streak', schwelle: 7, erreicht: true },
	{ schluessel: 'streak-14', typ: 'streak', schwelle: 14, erreicht: false },
	{ schluessel: 'streak-30', typ: 'streak', schwelle: 30, erreicht: false },
	{ schluessel: 'streak-100', typ: 'streak', schwelle: 100, erreicht: false },
	{ schluessel: 'punkte-50', typ: 'punkte', schwelle: 50, erreicht: true },
	{ schluessel: 'punkte-250', typ: 'punkte', schwelle: 250, erreicht: false },
	{ schluessel: 'punkte-1000', typ: 'punkte', schwelle: 1000, erreicht: false },
	{ schluessel: 'punkte-5000', typ: 'punkte', schwelle: 5000, erreicht: false },
];

describe('MilestoneBadges (#1362 AK7)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('rendert alle Stufen aus GET /scores/milestones', async () => {
		getMilestones.mockResolvedValue(STUFEN);
		render(<MilestoneBadges />);

		await waitFor(() => expect(badges().length).toEqual(STUFEN.length));
	});

	it('erreichte und nicht erreichte Badges sind über data-erreicht unterscheidbar', async () => {
		getMilestones.mockResolvedValue(STUFEN);
		render(<MilestoneBadges />);

		await waitFor(() => expect(badges().length).toEqual(STUFEN.length));
		const erreichtCount = badges().filter((b) => b.getAttribute('data-erreicht') === 'true').length;
		const nichtErreichtCount = badges().filter((b) => b.getAttribute('data-erreicht') === 'false').length;
		expect(erreichtCount).toEqual(STUFEN.filter((s) => s.erreicht).length);
		expect(nichtErreichtCount).toEqual(STUFEN.filter((s) => !s.erreicht).length);
	});

	it('nicht erreichte Badges bleiben im DOM sichtbar statt ausgeblendet (kein hidden/display:none)', async () => {
		getMilestones.mockResolvedValue(STUFEN);
		render(<MilestoneBadges />);

		await waitFor(() => expect(badges().length).toEqual(STUFEN.length));
		const nichtErreicht = badges().filter((b) => b.getAttribute('data-erreicht') === 'false');
		expect(nichtErreicht.length).toBeGreaterThan(0);
		for (const badge of nichtErreicht) {
			expect(badge.hasAttribute('hidden')).toBe(false);
			expect(badge.style.display).not.toEqual('none');
		}
	});

	it('holt die Daten beim Mount per api.getMilestones() (kein hartcodierter Wert)', async () => {
		getMilestones.mockResolvedValue(STUFEN);
		render(<MilestoneBadges />);

		await waitFor(() => expect(getMilestones).toHaveBeenCalledTimes(1));
	});

	it('rendert die Card mit data-testid="milestone-badges-card"', async () => {
		getMilestones.mockResolvedValue(STUFEN);
		render(<MilestoneBadges />);

		await waitFor(() => expect(card()).not.toBeNull());
	});
});
