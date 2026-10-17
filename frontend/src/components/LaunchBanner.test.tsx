import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchBanner } from './LaunchBanner';

/**
 * Spec-Tests für #2229/#2480 (docs/spec/issue-2229.md) — AK2 (Anzeige abhängig vom Flag), AK1/AK2
 * (Schließen-Knopf + localStorage-Dismiss, 2026-10-11) und AK3/AK4 (Feedback unberührt).
 * KoliBri-Komponenten sind Web Components, deren `_on.onClick` jsdom nicht auslöst → Mock mit
 * nativen Elementen (Muster PushToast.test.tsx). i18n läuft echt, auf 'de' gepinnt — der
 * zugängliche Name des Schließ-Knopfs ist „Schließen“.
 */
import i18next from '../i18n/config';
vi.mock('@public-ui/react-v19', () => ({
	KolButton: ({
		_label,
		_on,
		...rest
	}: {
		_label?: string;
		_on?: { onClick?: () => void };
		'data-testid'?: string;
	}) => (
		<button data-testid={rest['data-testid']} onClick={() => _on?.onClick?.()}>
			{_label}
		</button>
	),
}));

describe('LaunchBanner (#2229/#2480)', () => {
	beforeEach(async () => {
		await i18next.changeLanguage('de');
	});

	afterEach(() => {
		cleanup();
		localStorage.clear();
	});

	it('AK2: enabled=false → kein Banner im DOM', () => {
		render(<LaunchBanner enabled={false} onFeedback={vi.fn()} />);
		expect(screen.queryByTestId('launch-banner')).not.toBeInTheDocument();
	});

	it('AK2: enabled=true → Banner sichtbar', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.getByTestId('launch-banner')).toBeInTheDocument();
	});

	it('AK3: Feedback-Knopf ruft onFeedback', () => {
		const onFeedback = vi.fn();
		render(<LaunchBanner enabled onFeedback={onFeedback} />);
		fireEvent.click(screen.getByTestId('launch-banner-feedback'));
		expect(onFeedback).toHaveBeenCalledTimes(1);
	});

	it('AK1 (#2480): Schließen-Knopf mit zugänglichem Namen aus der App-Sprache', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.getByRole('button', { name: 'Schließen' })).toHaveAttribute('data-testid', 'launch-banner-dismiss');
	});

	it('AK2 (#2480): Klick auf Schließen setzt den localStorage-Key und entfernt den Banner', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		fireEvent.click(screen.getByTestId('launch-banner-dismiss'));
		expect(localStorage.getItem('pp-launch-banner-dismissed')).not.toBeNull();
		expect(screen.queryByTestId('launch-banner')).not.toBeInTheDocument();
	});

	it('AK2 (#2480): Remount bleibt weg; nach localStorage.clear() (neuer Login) erscheint der Banner wieder', () => {
		localStorage.setItem('pp-launch-banner-dismissed', '1');
		const { unmount } = render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.queryByTestId('launch-banner')).not.toBeInTheDocument();
		unmount();
		localStorage.clear();
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.getByTestId('launch-banner')).toBeInTheDocument();
	});
});
