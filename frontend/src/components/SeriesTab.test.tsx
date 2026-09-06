import { act, cleanup, render, screen } from '@testing-library/react';
import type { Pillar, Series } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #470 — Serien-Rhythmen: Anzeige der neuen Werte im `SeriesTab`.
 *
 * AK2/AK3 (Anzeige): Eine gespeicherte Serie mit einem der neuen Rhythmen (`weekdays`, `weekend`,
 * `mon`…`sun`) wird im `SeriesTab` mit der korrekten deutschen Bezeichnung als Badge gelistet.
 * `RHYTHM_LABEL` in `SeriesTab.tsx` enthält bereits alle 12 Werte — diese Specs sichern diesen
 * Vertrag (kein Regression durch eine künftige Reduzierung) und sind verhaltensneutral.
 *
 * Testebene: Vitest-Komponententest mit gemockter API (`api.listSeries`). KoliBri-Komponenten
 * werden durch native HTML-Elemente ersetzt (kein Custom-Element-Registry im jsdom).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
	KolSpin: () => <span aria-busy="true" />,
	// #1222 (AK9): „Für: …"-Empfänger-Badge (Text-Badge, KI-UX: sichtbarer Text statt nur Farbe).
	KolBadge: ({ _label }: { _label?: string }) => <span data-testid="series-badge">{_label}</span>,
	KolToolbar: ({
		_label,
		_items,
	}: {
		_label?: string;
		_items?: Array<{ _label?: string; _on?: { onClick?: () => void } }>;
	}) => (
		<div role="toolbar" aria-label={_label}>
			{(_items ?? []).map((item, index) => (
				<button key={index} onClick={() => item._on?.onClick?.()}>
					{item._label}
				</button>
			))}
		</div>
	),
}));

vi.mock('./DeleteSeriesDialog', () => ({
	DeleteSeriesDialog: () => <div data-testid="delete-series-dialog" />,
}));

vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div data-testid="modal">{children}</div>,
}));

vi.mock('./TaskForm', () => ({
	TaskForm: () => <div data-testid="task-form" />,
}));

// API-Mock: `listSeries` liefert die Fixtures; `generateAllSeries` wird nicht benötigt.
vi.mock('../api', () => ({
	api: {
		listSeries: vi.fn(),
		generateAllSeries: vi.fn(),
	},
}));

import { api } from '../api';
import { SeriesTab } from './SeriesTab';

const mockListSeries = api.listSeries as ReturnType<typeof vi.fn>;

const pillarKoerper: Pillar = { id: 1, name: 'Körper', description: 'Gesundheit', weight: 100 };

const makeSeries = (rhythm: Series['rhythm'], title: string): Series => ({
	id: Math.floor(Math.random() * 1000) + 1,
	title,
	rhythm,
	priority: 3,
	estimatedEffort: 0.5,
	active: true,
	startDate: new Date('2026-09-07T00:00:00.000Z'),
	pillars: [],
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe('SeriesTab — Anzeige der neuen Rhythmus-Werte (#470, AK2/AK3)', () => {
	it('zeigt das Badge „Werktags" für eine Serie mit rhythm: weekdays', async () => {
		mockListSeries.mockResolvedValue([makeSeries('weekdays', 'Werktags-Routine')]);

		await act(async () => {
			render(<SeriesTab pillars={[pillarKoerper]} />);
		});

		expect(screen.getByText('Werktags-Routine')).toBeInTheDocument();
		expect(screen.getByText('Werktags')).toBeInTheDocument();
	});

	it('zeigt das Badge „Wochenende" für eine Serie mit rhythm: weekend', async () => {
		mockListSeries.mockResolvedValue([makeSeries('weekend', 'Wochenend-Entspannung')]);

		await act(async () => {
			render(<SeriesTab pillars={[pillarKoerper]} />);
		});

		expect(screen.getByText('Wochenend-Entspannung')).toBeInTheDocument();
		expect(screen.getByText('Wochenende')).toBeInTheDocument();
	});

	it('zeigt die korrekten Wochentags-Bezeichnungen (Mo–So) als Badge', async () => {
		const cases: Array<{ rhythm: Series['rhythm']; expected: string }> = [
			{ rhythm: 'mon', expected: 'Montags' },
			{ rhythm: 'tue', expected: 'Dienstags' },
			{ rhythm: 'wed', expected: 'Mittwochs' },
			{ rhythm: 'thu', expected: 'Donnerstags' },
			{ rhythm: 'fri', expected: 'Freitags' },
			{ rhythm: 'sat', expected: 'Samstags' },
			{ rhythm: 'sun', expected: 'Sonntags' },
		];

		for (const { rhythm, expected } of cases) {
			cleanup();
			vi.clearAllMocks();
			mockListSeries.mockResolvedValue([makeSeries(rhythm, `Serie-${rhythm}`)]);

			await act(async () => {
				render(<SeriesTab pillars={[pillarKoerper]} />);
			});

			expect(screen.getByText(expected), `Badge für rhythm „${rhythm}“ fehlt`).toBeInTheDocument();
		}
	});
});

// ── #1222 (AK9): Empfänger-Kennzeichen + keine Aktionen für fremde Serien ────────────────────

/**
 * #1222 (AK9, docs/spec/issue-1222.md): Der Ersteller sieht im Serien-Tab eine für ein anderes
 * Gruppenmitglied angelegte Serie mit „Für: <Name>"-Badge (nur wenn `forUserName` vorhanden) und
 * OHNE Bearbeiten/Löschen-Toolbar — diese führt serverseitig in die 404-Sackgasse (AK6), darf
 * also keine fokussierbaren Geister-Buttons liefern (KI-UX). Eigene Serien bleiben unverändert.
 */
describe('SeriesTab — Für-Kennzeichen und fremde Serien (#1222 AK9)', () => {
	const baseSeries = makeSeries('weekly', 'Übergabe-Routine');

	it('fremde Serie: „Für: <Name>"-Badge sichtbar, Bearbeiten/Löschen nicht gerendert', async () => {
		mockListSeries.mockResolvedValue([{ ...baseSeries, forUserId: 2, forUserName: 'Bobi Anderes' }]);

		await act(async () => {
			render(<SeriesTab pillars={[pillarKoerper]} />);
		});

		expect(screen.getByTestId('series-badge')).toHaveTextContent('Für: Bobi Anderes');
		expect(screen.queryByRole('toolbar', { name: /Aktionen für Übergabe-Routine/ })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
	});

	it('eigene Serie: kein Für-Badge, Bearbeiten/Löschen gerendert', async () => {
		mockListSeries.mockResolvedValue([{ ...baseSeries, forUserId: null, forUserName: null }]);

		await act(async () => {
			render(<SeriesTab pillars={[pillarKoerper]} />);
		});

		expect(screen.queryByTestId('series-badge')).toBeNull();
		expect(screen.getByRole('toolbar', { name: /Aktionen für Übergabe-Routine/ })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Löschen' })).toBeInTheDocument();
	});
});

// ── #1251 (AK6): Ruh-Hinweis für stillgelegte Serien ────────────────────────────────────────

/**
 * #1251 (AK6, docs/spec/issue-1251.md): Eine stillgelegte Serie (`active:false`, entsteht durch
 * Gruppenaustritt/-löschung) trägt im Serien-Tab ein Text-Badge „Ruhend" — nie nur Farbe
 * (KI-UX, WCAG 1.4.1). Aktive Serien bekommen kein Badge; die Toolbar (Bearbeiten/Löschen)
 * bleibt für die eigene ruhende Serie erhalten (kein Toggle, kein Sperren).
 * Rot, bis SeriesTab.tsx das Badge rendert. KEIN Produktivcode.
 */
describe('SeriesTab — Ruh-Hinweis für stillgelegte Serien (#1251 AK6)', () => {
	it('ruhende Serie (active:false) zeigt das Text-Badge „Ruhend", Toolbar bleibt', async () => {
		mockListSeries.mockResolvedValue([{ ...makeSeries('weekly', 'Ruhende Routine'), active: false }]);

		await act(async () => {
			render(<SeriesTab pillars={[pillarKoerper]} />);
		});

		expect(screen.getByText('Ruhend')).toBeInTheDocument();
		expect(screen.getByRole('toolbar', { name: /Aktionen für Ruhende Routine/ })).toBeInTheDocument();
	});

	it('aktive Serie zeigt kein „Ruhend"-Badge', async () => {
		mockListSeries.mockResolvedValue([makeSeries('weekly', 'Aktive Routine')]);

		await act(async () => {
			render(<SeriesTab pillars={[pillarKoerper]} />);
		});

		expect(screen.queryByText('Ruhend')).toBeNull();
	});
});
