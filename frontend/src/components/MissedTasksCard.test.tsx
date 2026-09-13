import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MissedTasksCard } from './MissedTasksCard';

/**
 * Tests für die „Verpasste Aufgaben"-Card: zeigt die Anzahl der vom Auto-Delete-Cron
 * gelöschten Aufgaben aus `GET /scores/missed`. Bei `anzahl = 0` erscheint ein neutraler
 * Zustandstext statt einer kontextlosen Zahl (Muster `StreakCard.test.tsx`).
 *
 * KoliBri und `api` werden modulweit gemockt (Muster `StreakCard.test.tsx`).
 */

type MissedTask = { taskId: number; title: string; deadline: string; verpasstAm: string };
type MissedTasksSummary = { anzahl: number; eintraege: MissedTask[] };

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
}));

const getMissedTasks = vi.fn<() => Promise<MissedTasksSummary>>();

vi.mock('../api', () => ({
	api: {
		getMissedTasks: () => getMissedTasks(),
	},
}));

const card = (): HTMLElement => document.querySelector('[data-comp="kol-card"]') as HTMLElement;

describe('MissedTasksCard', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('zeigt den neutralen Zustandstext bei anzahl=0', async () => {
		getMissedTasks.mockResolvedValue({ anzahl: 0, eintraege: [] });
		render(<MissedTasksCard />);

		await waitFor(() => expect(card().querySelector('[data-testid="missed-tasks-zero"]')).not.toBeNull());
		expect(card().querySelector('[data-testid="missed-tasks-count"]')).toBeNull();
	});

	it('zeigt die Anzahl und die jüngsten Titel aus GET /scores/missed', async () => {
		getMissedTasks.mockResolvedValue({
			anzahl: 2,
			eintraege: [
				{
					taskId: 1,
					title: 'Müll rausbringen',
					deadline: '2026-09-01T00:00:00.000Z',
					verpasstAm: '2026-09-04T00:00:00.000Z',
				},
				{
					taskId: 2,
					title: 'Steuererklärung',
					deadline: '2026-08-01T00:00:00.000Z',
					verpasstAm: '2026-08-04T00:00:00.000Z',
				},
			],
		});
		render(<MissedTasksCard />);

		await waitFor(() => expect(card().querySelector('[data-testid="missed-tasks-count"]')).not.toBeNull());
		expect(card().textContent).toContain('2');
		expect(card().textContent).toContain('Müll rausbringen');
		expect(card().querySelector('[data-testid="missed-tasks-zero"]')).toBeNull();
	});

	it('holt die Daten beim Mount per api.getMissedTasks() (kein hartcodierter Wert)', async () => {
		getMissedTasks.mockResolvedValue({ anzahl: 0, eintraege: [] });
		render(<MissedTasksCard />);

		await waitFor(() => expect(getMissedTasks).toHaveBeenCalledTimes(1));
	});
});
