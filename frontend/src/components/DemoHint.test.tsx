import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { DemoHint } from './DemoHint';

/**
 * Spec-Tests für #2471 (docs/spec/issue-2471.md) — AK2 (Card + X mit zugänglichem Namen),
 * AK3 (sessionStorage-Marker überlebt Remount) und AK5 (kein localStorage).
 * KoliBri-Komponenten sind Web Components, deren `_on.onClick` jsdom nicht auslöst → Mock mit
 * nativen Elementen (Muster LaunchBanner.test.tsx). i18n ist im Setup auf 'de' initialisiert,
 * daher ist der zugängliche Name „Schließen“ direkt assertierbar.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children, ...rest }: { _label?: string; children?: ReactNode; 'data-testid'?: string }) => (
		<div role="alert" data-testid={rest['data-testid']}>
			<strong>{_label}</strong>
			{children}
		</div>
	),
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

const MARKER = 'pp_demo_hint_dismissed';

describe('DemoHint (#2471)', () => {
	afterEach(() => {
		cleanup();
		sessionStorage.clear();
	});

	it('AK2: enabled=true → Card mit Hinweistext und X „Schließen“', () => {
		render(<DemoHint enabled />);
		expect(screen.getByTestId('demo-hint')).toBeInTheDocument();
		expect(screen.getByText(/Google-Play-Prüfkonto angemeldet/)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
	});

	it('AK2: enabled=false → keine Card', () => {
		render(<DemoHint enabled={false} />);
		expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
	});

	it('AK3: Klick auf X entfernt die Card und setzt den sessionStorage-Marker', () => {
		render(<DemoHint enabled />);
		fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
		expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
		expect(sessionStorage.getItem(MARKER)).toBe('1');
	});

	it('AK3: gesetzter Marker → Card bleibt auch bei enabled weg (überlebt Reload/Remount)', () => {
		sessionStorage.setItem(MARKER, '1');
		render(<DemoHint enabled />);
		expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
	});

	it('AK5: Ausblendung schreibt nichts in den localStorage', () => {
		render(<DemoHint enabled />);
		fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
		expect(localStorage.getItem(MARKER)).toBeNull();
		expect(Object.keys(localStorage).filter((key) => key.toLowerCase().includes('demo'))).toHaveLength(0);
	});
});
