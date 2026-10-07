import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { JournalEntry } from 'client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { JournalTab } from './JournalTab';

vi.mock('../api', () => ({
	api: {
		listJournalEntries: vi.fn(),
		getJournalStats: vi.fn().mockResolvedValue(undefined),
	},
}));

const entry = (id: number, text: string): JournalEntry =>
	({ id, text, date: '2026-10-07', pillarId: null }) as JournalEntry;

const setVisibility = (state: 'visible' | 'hidden'): void => {
	Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
	document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
	cleanup();
	delete (document as { visibilityState?: unknown }).visibilityState;
	vi.clearAllMocks();
});

/** #2399 AK1: ein gemountetes Journal lädt bei Rückkehr in den Vordergrund neu (Spec docs/spec/issue-2399.md). */
describe('JournalTab — Refetch bei Rückkehr in den Vordergrund (#2399, AK1)', () => {
	it('lädt die Einträge bei visibilitychange → visible neu und zeigt die neue Liste', async () => {
		vi.mocked(api.listJournalEntries).mockResolvedValueOnce([entry(1, 'Alter Eintrag')]);
		render(<JournalTab pillars={[]} />);
		await screen.findByText('Alter Eintrag');
		expect(api.listJournalEntries).toHaveBeenCalledTimes(1);

		vi.mocked(api.listJournalEntries).mockResolvedValueOnce([entry(2, 'Von anderem Gerät'), entry(1, 'Alter Eintrag')]);
		act(() => setVisibility('visible'));

		await screen.findByText('Von anderem Gerät');
		expect(api.listJournalEntries).toHaveBeenCalledTimes(2);
	});

	it('lädt bei hidden nicht neu', async () => {
		vi.mocked(api.listJournalEntries).mockResolvedValue([entry(1, 'Alter Eintrag')]);
		render(<JournalTab pillars={[]} />);
		await screen.findByText('Alter Eintrag');

		act(() => setVisibility('hidden'));

		await waitFor(() => expect(api.listJournalEntries).toHaveBeenCalledTimes(1));
	});
});
