import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import i18next from '../i18n/config';
import { DemoHint } from './DemoHint';

/**
 * Spec-Tests für #2471/#2474 (docs/spec/issue-2471.md, docs/spec/issue-2474.md) — #2474 AK1
 * (KolCard statt KolAlert, Nachbarmuster missed-section ohne Statusfarbe) und AK2 (zugänglicher
 * Name des X folgt der App-Sprache, nicht der KoliBri-i18n) sowie die unverändert fortgeltenden
 * #2471-Verträge AK2/AK3/AK5 (Card-Inhalt, sessionStorage-Marker, kein localStorage).
 * KoliBri-Komponenten sind Web Components, deren `_on.onClick` jsdom nicht auslöst → Mock mit
 * nativen Elementen (Muster LaunchBanner.test.tsx). Der KolCard-Mock leitet die DOM-relevanten
 * Props weiter (`...rest`, Muster WeeklyCard-Tests) und sammelt die übrigen Props in
 * `mockCardProps` — daran werden `_level` und die Farb-Disziplin (kein `_type`) geprüft.
 * i18n läuft echt und ist im Setup auf 'de' gepinnt; Sprach-Tests wechseln selbst (Muster
 * CareHint.test.tsx).
 */
const mockCardProps: Array<Record<string, unknown>> = [];

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children, ...rest }: { _label?: string; children?: ReactNode; 'data-testid'?: string }) => (
		<div role="alert" data-testid={rest['data-testid']}>
			<strong>{_label}</strong>
			{children}
		</div>
	),
	KolCard: ({
		_label,
		_level,
		children,
		...rest
	}: {
		_label?: string;
		_level?: number;
		children?: ReactNode;
		'data-testid'?: string;
		className?: string;
		role?: string;
		'aria-label'?: string;
	}) => {
		mockCardProps.push({ _level, ...rest });
		return (
			<section data-kolcard="" {...rest}>
				<h2>{_label}</h2>
				{children}
			</section>
		);
	},
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

describe('DemoHint (#2471/#2474)', () => {
	beforeEach(() => {
		mockCardProps.length = 0;
	});

	afterEach(async () => {
		cleanup();
		sessionStorage.clear();
		await i18next.changeLanguage('de');
	});

	it('AK1 (#2474): rendert KolCard — nicht KolAlert — mit Titel und Hinweistext', () => {
		render(<DemoHint enabled />);
		expect(screen.getByTestId('demo-hint')).toHaveAttribute('data-kolcard');
		expect(screen.getByRole('heading', { name: 'Play-Prüfkonto' })).toBeInTheDocument();
		expect(screen.getByText(/Google-Play-Prüfkonto angemeldet/)).toBeInTheDocument();
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('AK1 (#2474): Card folgt dem missed-section-Nachbarmuster — Region, _level 2, ohne Statusfarbe', () => {
		render(<DemoHint enabled />);
		expect(screen.getByRole('region')).toBeInTheDocument();
		const props = mockCardProps[0] ?? {};
		expect(props._level).toBe(2);
		expect(props._type).toBeUndefined();
	});

	it('AK2 (#2471): enabled=true → Card mit Hinweistext und X „Schließen“ in der Card', () => {
		render(<DemoHint enabled />);
		const card = screen.getByTestId('demo-hint');
		expect(within(card).getByText(/Google-Play-Prüfkonto angemeldet/)).toBeInTheDocument();
		expect(within(card).getByRole('button', { name: 'Schließen' })).toBeInTheDocument();
	});

	it('AK2 (#2474): zugänglicher Name des X folgt der App-Sprache (EN „Close“, nicht KoliBri-i18n)', async () => {
		await i18next.changeLanguage('en');
		render(<DemoHint enabled />);
		expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Schließen' })).not.toBeInTheDocument();
	});

	it('AK2 (#2471): enabled=false → keine Card', () => {
		render(<DemoHint enabled={false} />);
		expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
	});

	it('AK3 (#2471): Klick auf X entfernt die Card und setzt den sessionStorage-Marker', () => {
		render(<DemoHint enabled />);
		fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
		expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
		expect(sessionStorage.getItem(MARKER)).toBe('1');
	});

	it('AK3 (#2471): gesetzter Marker → Card bleibt auch bei enabled weg (überlebt Reload/Remount)', () => {
		sessionStorage.setItem(MARKER, '1');
		render(<DemoHint enabled />);
		expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
	});

	it('AK5 (#2471): Ausblendung schreibt nichts in den localStorage', () => {
		render(<DemoHint enabled />);
		fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
		expect(localStorage.getItem(MARKER)).toBeNull();
		expect(Object.keys(localStorage).filter((key) => key.toLowerCase().includes('demo'))).toHaveLength(0);
	});
});
