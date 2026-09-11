import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Task } from 'client';
import { TaskStatus } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1361, Spec docs/spec/issue-1361.md): `DayDoneHint` existiert noch nicht.
// Der Import schlägt fehl, bis `frontend/src/components/DayDoneHint.tsx` die Komponente bereitstellt.
import { DayDoneHint } from './DayDoneHint';

/**
 * Spec-Tests für die Abschluss-Hinweis-Komponente (AK1/AK2/AK3/AK5/AK6, #1361): rendert
 * `data-testid="day-done"` nur, wenn keine offene Aufgabe existiert UND `letzterTag` aus
 * `GET /scores/streak` auf heute fällt (Muster `StreakCard.test.tsx`: Self-Load, KoliBri + api
 * modulweit gemockt).
 */

type Streak = { aktuell: number; best: number; letzterTag: string | null };

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => <div data-comp="kol-alert">{children}</div>,
}));

const getStreak = vi.fn<() => Promise<Streak>>();

vi.mock('../api', () => ({
	api: {
		getStreak: () => getStreak(),
	},
}));

const baseTask: Task = {
	id: 1,
	title: 'T',
	status: TaskStatus.Done,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars: [],
};

const doneTask = (id: number): Task => ({ ...baseTask, id, status: TaskStatus.Done });
const openTask = (id: number): Task => ({ ...baseTask, id, status: TaskStatus.Open });

const hint = (): HTMLElement | null => document.querySelector('[data-testid="day-done"]');

describe('DayDoneHint (#1361)', () => {
	afterEach(() => {
		cleanup();
		vi.clearAllMocks();
	});

	it('AK1: keine offenen Aufgaben + letzterTag = heute → Hinweis erscheint', async () => {
		const today = new Date().toISOString().slice(0, 10);
		getStreak.mockResolvedValue({ aktuell: 1, best: 1, letzterTag: today });
		render(<DayDoneHint tasks={[doneTask(1)]} />);

		await waitFor(() => expect(hint()).not.toBeNull());
	});

	it('AK2: eine offene Aufgabe + letzterTag = heute → kein Hinweis', async () => {
		const today = new Date().toISOString().slice(0, 10);
		getStreak.mockResolvedValue({ aktuell: 1, best: 1, letzterTag: today });
		render(<DayDoneHint tasks={[doneTask(1), openTask(2)]} />);

		await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(1));
		expect(hint()).toBeNull();
	});

	it('AK3: keine offenen Aufgaben, aber letzterTag ungleich heute → kein Hinweis', async () => {
		getStreak.mockResolvedValue({ aktuell: 0, best: 3, letzterTag: '2026-01-01' });
		render(<DayDoneHint tasks={[]} />);

		await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(1));
		expect(hint()).toBeNull();
	});

	it('AK3: keine offenen Aufgaben, letzterTag = null → kein Hinweis', async () => {
		getStreak.mockResolvedValue({ aktuell: 0, best: 0, letzterTag: null });
		render(<DayDoneHint tasks={[]} />);

		await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(1));
		expect(hint()).toBeNull();
	});

	it('AK5: eine neu hinzugekommene offene Aufgabe entfernt den Hinweis ohne Reload', async () => {
		const today = new Date().toISOString().slice(0, 10);
		getStreak.mockResolvedValue({ aktuell: 1, best: 1, letzterTag: today });
		const { rerender } = render(<DayDoneHint tasks={[doneTask(1)]} />);

		await waitFor(() => expect(hint()).not.toBeNull());

		rerender(<DayDoneHint tasks={[doneTask(1), openTask(2)]} />);

		await waitFor(() => expect(hint()).toBeNull());
	});

	it('AK6: lädt die Tages-Erkennung ausschließlich über api.getStreak (genau ein Aufruf je Mount)', async () => {
		const today = new Date().toISOString().slice(0, 10);
		getStreak.mockResolvedValue({ aktuell: 1, best: 1, letzterTag: today });
		render(<DayDoneHint tasks={[doneTask(1)]} />);

		await waitFor(() => expect(getStreak).toHaveBeenCalledTimes(1));
	});
});
