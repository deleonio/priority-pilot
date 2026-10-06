import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// ROTER Spec-Test (#2221, docs/spec/issue-2221.md): `WelcomeSteps` existiert noch nicht.
import { WelcomeSteps, startWelcomeSteps } from './WelcomeSteps';

vi.mock('@public-ui/react-v19', () => ({
	KolCard: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: (event: MouseEvent) => void } }) => (
		<button type="button" onClick={() => _on?.onClick?.(new MouseEvent('click'))}>
			{_label}
		</button>
	),
}));

const einTask = [{ id: 1, title: 'A' }] as never;
const stepOf = (name: string): HTMLElement => document.querySelector(`li[data-step="${name}"]`) as HTMLElement;

const renderSteps = (tasks: never[] | never = [] as never[]) => {
	const onOpenPillars = vi.fn();
	const onOpenSuggestion = vi.fn();
	const view = render(<WelcomeSteps tasks={tasks} onOpenPillars={onOpenPillars} onOpenSuggestion={onOpenSuggestion} />);
	return { ...view, onOpenPillars, onOpenSuggestion };
};

describe('WelcomeSteps (#2221)', () => {
	beforeEach(() => window.localStorage.clear());
	afterEach(() => {
		cleanup();
		window.localStorage.clear();
	});

	it('AK4: ohne Marker (Bestandskonto) rendert nichts, auch mit Aufgaben', () => {
		renderSteps(einTask);
		expect(screen.queryByTestId('welcome-steps')).toBeNull();
	});

	it('AK1: mit Marker zeigt der Einstieg 2–3 Schritte', () => {
		startWelcomeSteps();
		renderSteps();
		expect(screen.getByTestId('welcome-steps')).toBeTruthy();
		const schritte = document.querySelectorAll('[data-testid="welcome-steps"] li[data-step]');
		expect(schritte.length).toBeGreaterThanOrEqual(2);
		expect(schritte.length).toBeLessThanOrEqual(3);
	});

	it('AK2: Schritt „task“ ist erst mit mindestens einer Aufgabe erledigt', () => {
		startWelcomeSteps();
		const { unmount } = renderSteps();
		expect(stepOf('task').getAttribute('data-done')).toBe('false');
		unmount();
		renderSteps(einTask);
		expect(stepOf('task').getAttribute('data-done')).toBe('true');
		expect(within(stepOf('task')).getByText(/erledigt/i)).toBeTruthy();
	});

	it('AK2: Öffnen von „pillars“ ruft den Callback und hakt den Schritt ab', () => {
		startWelcomeSteps();
		const { onOpenPillars } = renderSteps();
		fireEvent.click(within(stepOf('pillars')).getByRole('button'));
		expect(onOpenPillars).toHaveBeenCalledTimes(1);
		expect(stepOf('pillars').getAttribute('data-done')).toBe('true');
	});

	it('AK3: Schließen ist endgültig — auch nach Remount (Reload) kein Einstieg', () => {
		startWelcomeSteps();
		const { unmount } = renderSteps();
		fireEvent.click(screen.getByRole('button', { name: /Einstieg schließen/i }));
		expect(screen.queryByTestId('welcome-steps')).toBeNull();
		unmount();
		renderSteps();
		expect(screen.queryByTestId('welcome-steps')).toBeNull();
	});

	it('AK3: sind alle Schritte erledigt, verschwindet der Einstieg und kommt nicht wieder', () => {
		startWelcomeSteps();
		const { unmount } = renderSteps(einTask);
		fireEvent.click(within(stepOf('pillars')).getByRole('button'));
		const suggestion = stepOf('suggestion');
		if (suggestion) fireEvent.click(within(suggestion).getByRole('button'));
		expect(screen.queryByTestId('welcome-steps')).toBeNull();
		unmount();
		renderSteps(einTask);
		expect(screen.queryByTestId('welcome-steps')).toBeNull();
	});
});
