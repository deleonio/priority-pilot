import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1360, Spec docs/spec/issue-1360.md): `StreakCard` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/StreakCard.tsx` die Komponente bereitstellt.
import { StreakCard } from './StreakCard';

/**
 * Spec-Tests für die Streak-Card (AK5, #1360): zeigt aktuellen Streak + Bestmarke aus
 * `GET /scores/streak`; bei `aktuell = 0` erscheint ein gestalteter Zustandstext statt einer
 * kontextlosen Zahl, die Bestmarke bleibt sichtbar.
 *
 * KoliBri und `api` werden modulweit gemockt (Muster `NearbyCard.test.tsx`).
 */

type Streak = { aktuell: number; best: number; letzterTag: string | null };

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
}));

const getStreak = vi.fn<() => Promise<Streak>>();

vi.mock('../api', () => ({
	api: {
		getStreak: () => getStreak(),
	},
}));

const card = (): HTMLElement => document.querySelector('[data-comp="kol-card"]') as HTMLElement;

describe('StreakCard (#1360 AK5)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('zeigt den aktuellen Streak und die Bestmarke aus GET /scores/streak', async () => {
		getStreak.mockResolvedValue({ aktuell: 3, best: 7, letzterTag: '2026-09-11' });
		render(<StreakCard />);

		await waitFor(() => expect(card()).not.toBeNull());
		expect(card().textContent).toContain('3');
		expect(card().querySelector('[data-testid="streak-best"]')?.textContent).toContain('7');
		expect(card().querySelector('[data-testid="streak-zero"]')).toBeNull();
	});

	it('holt die Daten beim Mount per api.getStreak() (kein hartcodierter Wert)', async () => {
		getStreak.mockResolvedValue({ aktuell: 1, best: 1, letzterTag: '2026-09-11' });
		render(<StreakCard />);

		await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(1));
	});

	it('bei aktuell=0 erscheint der Zustandstext (streak-zero) statt einer nackten „0", Bestmarke bleibt sichtbar', async () => {
		getStreak.mockResolvedValue({ aktuell: 0, best: 5, letzterTag: '2026-09-01' });
		render(<StreakCard />);

		await waitFor(() => expect(card().querySelector('[data-testid="streak-zero"]')).not.toBeNull());
		expect(card().querySelector('[data-testid="streak-best"]')?.textContent).toContain('5');
	});
});
