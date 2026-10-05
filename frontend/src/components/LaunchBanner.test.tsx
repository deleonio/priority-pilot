import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LaunchBanner } from './LaunchBanner';

/**
 * Rote Spec-Tests für #2229 (docs/spec/issue-2229.md) — AK2 (Anzeige abhängig vom Flag) und
 * AK4 (Schließen merkt sich der Browser). KoliBri-Komponenten sind Web Components, deren
 * `_on.onClick` jsdom nicht auslöst → Mock mit nativen Elementen (Muster PushToast.test.tsx).
 */
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ children }: { children?: ReactNode }) => <div role="status">{children}</div>,
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

const DISMISS_KEY = 'launch-banner-dismissed';

describe('LaunchBanner (#2229)', () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => {
		cleanup();
		localStorage.clear();
	});

	it('AK2: enabled=false → kein Banner im DOM', () => {
		render(<LaunchBanner enabled={false} onFeedback={vi.fn()} />);
		expect(screen.queryByTestId('launch-banner')).not.toBeInTheDocument();
	});

	it('AK2: enabled=true ohne gespeichertes Schließen → Banner sichtbar', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.getByTestId('launch-banner')).toBeInTheDocument();
	});

	it('AK3: Feedback-Knopf ruft onFeedback', () => {
		const onFeedback = vi.fn();
		render(<LaunchBanner enabled onFeedback={onFeedback} />);
		fireEvent.click(screen.getByTestId('launch-banner-feedback'));
		expect(onFeedback).toHaveBeenCalledTimes(1);
	});

	it('AK4: Schließen setzt den localStorage-Key und entfernt den Banner', () => {
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		fireEvent.click(screen.getByTestId('launch-banner-dismiss'));
		expect(localStorage.getItem(DISMISS_KEY)).not.toBeNull();
		expect(screen.queryByTestId('launch-banner')).not.toBeInTheDocument();
	});

	it('AK4: nach Re-Mount bleibt das Banner weg', () => {
		localStorage.setItem(DISMISS_KEY, '1');
		render(<LaunchBanner enabled onFeedback={vi.fn()} />);
		expect(screen.queryByTestId('launch-banner')).not.toBeInTheDocument();
	});
});
