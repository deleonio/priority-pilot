import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** #1992 AK5: drei Zustände der Challenge-Karte — keine, laufend, beendet. */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => <div role="alert">{children}</div>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button onClick={() => _on?.onClick?.()}>{_label}</button>
	),
	KolHeading: ({ _label }: { _label?: string }) => <h4>{_label}</h4>,
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
}));

vi.mock('../api', () => ({
	api: { getGroupChallenge: vi.fn(), startGroupChallenge: vi.fn() },
}));

import { api } from '../api';
import { GroupChallengeCard } from './GroupChallengeCard';

const mockGet = api.getGroupChallenge as ReturnType<typeof vi.fn>;
const mockStart = api.startGroupChallenge as ReturnType<typeof vi.fn>;
const DAY = 24 * 60 * 60 * 1000;

const challenge = (status: 'laufend' | 'beendet') => ({
	gruppe: 'Team',
	status,
	startsAt: new Date(Date.now() - (status === 'laufend' ? 3 : 8) * DAY).toISOString(),
	endsAt: new Date(Date.now() + (status === 'laufend' ? 4 : -1) * DAY).toISOString(),
	rangfolge: [
		{ name: 'Alice', rang: 1, balance: 0.82 },
		{ name: 'Bob', rang: 2, balance: null },
	],
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('GroupChallengeCard (#1992 AK5)', () => {
	it('ohne Challenge: Start-Button, Start erst nach Bestätigung', async () => {
		mockGet.mockResolvedValue(null);
		mockStart.mockResolvedValue(challenge('laufend'));
		render(<GroupChallengeCard groupId={1} />);
		fireEvent.click(await screen.findByRole('button', { name: '7-Tage-Challenge starten' }));
		expect(mockStart).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Challenge starten' }));
		await waitFor(() => expect(mockStart).toHaveBeenCalledWith({ id: 1 }));
		expect(await screen.findByText(/Noch 4 Tage/)).toBeInTheDocument();
	});

	it('laufend: Restlaufzeit und Rangfolge, kein Start, kein Teilen', async () => {
		mockGet.mockResolvedValue(challenge('laufend'));
		render(<GroupChallengeCard groupId={1} />);
		expect(await screen.findByText(/Noch 4 Tage/)).toBeInTheDocument();
		const zeilen = screen.getAllByRole('listitem');
		expect(zeilen[0]).toHaveTextContent('Platz 1');
		expect(zeilen[0]).toHaveTextContent('82 %');
		expect(zeilen[1]).toHaveTextContent('Noch kein Wert');
		expect(zeilen[1]).not.toHaveTextContent('Platz');
		expect(screen.queryAllByRole('button')).toHaveLength(0);
	});

	it('beendet: Abschluss mit Teilen als Aktion', async () => {
		mockGet.mockResolvedValue(challenge('beendet'));
		render(<GroupChallengeCard groupId={1} />);
		expect(await screen.findByText(/Abgeschlossen/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Teilen' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Neue Challenge starten' })).toBeInTheDocument();
	});
});
