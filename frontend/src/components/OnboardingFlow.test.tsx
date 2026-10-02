import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * #1986 (Spec in `docs/spec/issue-1986.md`): Schrittfolge des Onboarding-Flows inkl.
 * Startgewichtung vor dem Abschluss (AK4) und Abbruch/Wiedereinstieg ohne Datenverlust (AK6).
 *
 * KoliBri-Webkomponenten sind in jsdom nicht bedienbar — aufgesteckt auf leichtgewichtige Stubs,
 * die die relevanten Props (`_label`, `_on.onInput/onClick`) auf native Elemente abbilden
 * (Muster `PillarWeightsModal.test.tsx`): `KolTextarea` → textarea, `KolInputCheckbox` → checkbox,
 * `KolButton` → button. `PillarWeightsForm` wird als Marker gemockt, weil der Gewichtungs-Schritt
 * hier nur als Schrittgrenze interessiert (Inhalt testet `PillarWeightsForm` selbst).
 */
vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ _label, children }: { _label: string; children: ReactNode }) => (
		<section aria-label={_label}>{children}</section>
	),
	KolHeading: ({ _label }: { _label: string }) => <h2>{_label}</h2>,
	KolTextarea: ({
		_label,
		_value,
		_on,
	}: {
		_label: string;
		_value?: string;
		_on?: { onInput?: (event: Event, value: string) => void };
	}) => (
		<textarea
			aria-label={_label}
			value={_value ?? ''}
			onChange={(event) => _on?.onInput?.(event as unknown as Event, event.currentTarget.value)}
		/>
	),
	KolInputCheckbox: ({
		_label,
		_checked,
		_on,
	}: {
		_label: string;
		_checked?: boolean;
		_on?: { onInput?: (event: Event, value: boolean) => void };
	}) => (
		<input
			type="checkbox"
			aria-label={_label}
			checked={_checked ?? false}
			onChange={(event) => _on?.onInput?.(event as unknown as Event, event.currentTarget.checked)}
		/>
	),
	KolButton: ({ _label, _on }: { _label: string; _on?: { onClick?: () => void } }) => (
		<button onClick={_on?.onClick}>{_label}</button>
	),
	KolSpin: ({ _label }: { _label: string }) => <div role="status">{_label}</div>,
	KolAlert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>,
	KolBadge: ({ _label }: { _label: string }) => <span>{_label}</span>,
	KolProgress: () => <progress />,
}));

vi.mock('./PillarWeightsForm', () => ({
	PillarWeightsForm: () => <div data-testid="pillar-weights-form" />,
}));

const parseSuggest = vi.fn();
vi.mock('../api', () => ({
	api: {
		parseSuggest: (...args: unknown[]) => parseSuggest(...args),
	},
}));

import { OnboardingFlow } from './OnboardingFlow';

afterEach(cleanup);

const SUGGESTIONS = [
	{ title: 'Küche aufräumen', pillarId: 1 },
	{ title: 'Wäsche waschen', pillarId: 1 },
	{ title: 'Steuerunterlagen sortieren', pillarId: 2 },
	{ title: 'Freunde anrufen', pillarId: 3, dependsOnTitle: 'Steuerunterlagen sortieren' },
	{ title: 'Sport einplanen', pillarId: 3 },
];

/** Rendert den Flow und geht bis in den Vorschlags-Schritt (Schritt 3). */
const renderAtSuggestionsStep = async (): Promise<void> => {
	parseSuggest.mockResolvedValue({ suggestions: SUGGESTIONS });
	render(<OnboardingFlow />);
	fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Umzug planen' } });
	fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
	await screen.findByRole('checkbox', { name: 'Küche aufräumen' });
};

describe('OnboardingFlow — Schrittfolge (#1986 AK4)', () => {
	it('AK4: Startgewichtung liegt VOR dem Abschluss-Schritt', async () => {
		await renderAtSuggestionsStep();

		fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));

		// Gewichtungs-Schritt ist erreicht und der Abschluss noch NICHT sichtbar.
		expect(screen.getByTestId('pillar-weights-form')).toBeInTheDocument();
		expect(screen.queryByText('Dein nächster Schritt')).not.toBeInTheDocument();
	});
});

describe('OnboardingFlow — Abbruch & Wiedereinstieg (#1986 AK6)', () => {
	it('AK6: „Später" persistiert den Fortschritt, Remount setzt ohne Datenverlust fort', async () => {
		await renderAtSuggestionsStep();

		fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
		fireEvent.click(screen.getByRole('button', { name: 'Später' }));

		// Fortschritts-Flag persistiert (Schritt + Auswahl + Freitext).
		const stored = window.localStorage.getItem('pp-onboarding-progress');
		expect(stored).not.toBeNull();

		// Wiedereinstieg: Remount setzt im Gewichtungs-Schritt fort — Auswahl erhalten.
		cleanup();
		render(<OnboardingFlow />);
		await waitFor(() => expect(screen.getByTestId('pillar-weights-form')).toBeInTheDocument());
		expect(screen.getByRole('textbox')).toHaveValue('Umzug planen');
	});

	it('AK6: Nach dem Abbruch mit 0 Tasks startet ein Remount im gespeicherten Schritt, nicht vorn', async () => {
		await renderAtSuggestionsStep();
		fireEvent.click(screen.getByRole('button', { name: 'Später' }));

		cleanup();
		render(<OnboardingFlow />);
		await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Küche aufräumen' })).toBeInTheDocument());
	});
});
