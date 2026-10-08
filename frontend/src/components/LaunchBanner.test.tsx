import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LaunchBanner } from './LaunchBanner';

/**
 * Spec-Tests für #2229 (docs/spec/issue-2229.md) — AK2 (Anzeige abhängig vom Flag) und die
 * Nachschärfung „nicht wegklickbar" (2026-10-08): kein Schließen-Knopf, kein localStorage-Dismiss.
 * KoliBri-Komponenten sind Web Components, deren `_on.onClick` jsdom nicht auslöst → Mock mit
 * nativen Elementen (Muster PushToast.test.tsx).
 */
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

describe('LaunchBanner (#2229)', () => {
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

	it('nicht wegklickbar: kein Schließen-Knopf, Banner bleibt sichtbar', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.queryByTestId('launch-banner-dismiss')).not.toBeInTheDocument();
		expect(screen.getByTestId('launch-banner')).toBeInTheDocument();
	});

	it('nicht wegklickbar: kein localStorage-Key wird geschrieben oder gelesen', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(localStorage.getItem('launch-banner-dismissed')).toBeNull();
	});
});
