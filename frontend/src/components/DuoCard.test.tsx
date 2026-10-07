import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#1991, docs/spec/issue-1991.md): `DuoCard` existiert noch nicht — der Import
// schlägt fehl, bis `frontend/src/components/DuoCard.tsx` die Komponente bereitstellt.
import { DuoCard } from './DuoCard';

/** AK1 + AK4: Streak, Namen, Säulenwerte beider Personen; Leerzustand bei Streak 0. */

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
	KolDetails: ({
		_label,
		_open,
		_on,
		children,
	}: {
		_label?: string;
		_open?: boolean;
		_on?: { onToggle?: (event: Event, value: boolean) => void };
		children?: ReactNode;
	}) => (
		<details data-open={String(_open === true)}>
			<summary onClick={() => _on?.onToggle?.(new Event('toggle'), _open !== true)}>{_label}</summary>
			{children}
		</details>
	),
	KolSpin: ({ _label }: { _label?: string }) => <div role="status">{_label}</div>,
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
}));

type Duo = {
	streak: { aktuell: number; best: number };
	members: { userId: number; name: string; saeulen: { pillarId: number; name: string; wert: number }[] }[];
};

const getGroupDuo = vi.fn<(arg: { id: number }) => Promise<Duo>>();
vi.mock('../api', () => ({ api: { getGroupDuo: (arg: { id: number }) => getGroupDuo(arg) } }));

const duo = (aktuell: number): Duo => ({
	streak: { aktuell, best: 9 },
	members: [
		{ userId: 1, name: 'Alice', saeulen: [{ pillarId: 1, name: 'Körper', wert: 72 }] },
		{ userId: 2, name: 'Bob', saeulen: [{ pillarId: 2, name: 'Geist', wert: 41 }] },
	],
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('DuoCard (#1991 AK1/AK4)', () => {
	it('lädt per api.getGroupDuo und zeigt beide Namen mit Säulenname und -wert als Text', async () => {
		getGroupDuo.mockResolvedValue(duo(3));
		render(<DuoCard groupId={5} />);

		await waitFor(() => expect(screen.getAllByTestId('duo-member')).toHaveLength(2));
		expect(getGroupDuo).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
		const [first, second] = screen.getAllByTestId('duo-member');
		expect(first.textContent).toContain('Alice');
		expect(first.textContent).toContain('Körper');
		expect(first.textContent).toContain('72');
		expect(second.textContent).toContain('Bob');
		expect(second.textContent).toContain('Geist');
		expect(second.textContent).toContain('41');
	});

	it('zeigt bei Streak > 0 die gemeinsame Darstellung mit beiden Namen und Streak, ohne Leerzustand', async () => {
		getGroupDuo.mockResolvedValue(duo(3));
		render(<DuoCard groupId={5} />);

		const shared = await screen.findByTestId('duo-streak-shared');
		expect(shared.textContent).toContain('Alice');
		expect(shared.textContent).toContain('Bob');
		expect(shared.textContent).toContain('3');
		expect(screen.queryByTestId('duo-streak-zero')).toBeNull();
	});

	it('zeigt bei Streak 0 einen Leerzustand ohne gemeinsame Darstellung; Bestmarke bleibt sichtbar', async () => {
		getGroupDuo.mockResolvedValue(duo(0));
		render(<DuoCard groupId={5} />);

		const zero = await screen.findByTestId('duo-streak-zero');
		expect(zero.textContent?.trim()).not.toBe('');
		expect(screen.queryByTestId('duo-streak-shared')).toBeNull();
		expect(document.body.textContent).toContain('9');
	});

	it('zeigt mit nur einer Person den Platzhalter „Noch niemand dabei"', async () => {
		const single = duo(0);
		single.members = single.members.slice(0, 1);
		getGroupDuo.mockResolvedValue(single);
		render(<DuoCard groupId={5} />);

		await screen.findByText(/Noch niemand dabei/);
		expect(screen.getAllByTestId('duo-member')).toHaveLength(1);
	});
});

describe('DuoCard Aufklappbereich (#2328 AK3/AK5)', () => {
	it('bleibt nach dem Neuzeichnen offen und schließt per erneutem Klick', async () => {
		getGroupDuo.mockResolvedValue(duo(3));
		const { rerender } = render(<DuoCard groupId={5} />);
		await waitFor(() => expect(screen.getAllByTestId('duo-member')).toHaveLength(2));
		const details = (): HTMLElement => document.querySelector('details') as HTMLElement;
		const summary = (): HTMLElement => details().querySelector('summary') as HTMLElement;

		fireEvent.click(summary());
		expect(details().dataset.open).toBe('true');
		rerender(<DuoCard groupId={5} />);
		expect(details().dataset.open).toBe('true');

		fireEvent.click(summary());
		expect(details().dataset.open).toBe('false');
	});
});
