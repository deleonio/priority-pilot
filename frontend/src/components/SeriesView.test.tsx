import { act, render, screen, waitFor } from '@testing-library/react';
import { ResponseError, type Series } from 'client';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

/**
 * Rote Spec-Tests für #2942 — AK5 (Lade-/404-Zustand, Abruf nach dem Speichern im
 * Bearbeiten-Dialog). Spezifikation: docs/spec/issue-2942.md.
 * Rot, bis `SeriesView` existiert (fehlt das Modul, ist das der legitime erste Rot-Zustand).
 */

// API-Mock (Vertrag: `api.getSeries({ id })` → Series, `api.listTasks`; nicht ok → echte
// `ResponseError` aus `client`, daran unterscheidet SeriesView 404 via `instanceof`).
const { getSeriesMock, listTasksMock } = vi.hoisted(() => ({ getSeriesMock: vi.fn(), listTasksMock: vi.fn() }));
vi.mock('../api', () => ({ api: { getSeries: getSeriesMock, listTasks: listTasksMock } }));

vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _type, children }: { _type?: string; children?: ReactNode }) => (
		<div role="alert" data-type={_type}>
			{children}
		</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button onClick={() => _on?.onClick?.()}>{_label}</button>
	),
	KolDetails: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<details>
			<summary>{_label}</summary>
			{children}
		</details>
	),
	KolHeading: ({ _level, children }: { _level?: number; children?: ReactNode }) => {
		const Tag = `h${_level ?? 1}` as 'h1';
		return <Tag>{children}</Tag>;
	},
	KolLink: ({ _label, _href }: { _label?: string; _href?: string }) => <a href={_href}>{_label}</a>,
}));

import { SeriesView } from './SeriesView';

const sampleSeries = (overrides: Partial<Series> = {}): Series =>
	({
		id: 42,
		title: 'Wochenputz',
		rhythm: 'weekly',
		priority: 4,
		estimatedEffort: 0.5,
		active: true,
		startDate: new Date('2030-01-15T00:00:00.000Z'),
		autoCreate: true,
		description: 'Putzplan',
		address: null,
		checklist: [],
		pillars: [],
		...overrides,
	}) as Series;

const renderView = () => render(<SeriesView seriesId={42} onBack={vi.fn()} onEdit={vi.fn()} />);

describe('SeriesView (#2942)', () => {
	beforeEach(() => {
		getSeriesMock.mockReset();
		listTasksMock.mockReset().mockResolvedValue([]);
	});

	// AK5/TF5: Während des Ladens Skelett in der Form der Ansicht — kein Spinner, kein Alert,
	// noch keine Seriendaten.
	it('AK5: zeigt während des Ladens ein Skelett ohne Spinner', () => {
		getSeriesMock.mockReturnValue(new Promise(() => {}));
		const { container } = renderView();

		expect(container.querySelector('.series-view-skeleton')).not.toBeNull();
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText('Wochenputz')).toBeNull();
	});

	// AK5/TF5: 404 (unbekannte oder fremde ID) → KolAlert „Diese Serie gibt es nicht mehr." mit
	// Rettungslink „Zu den Serien" → /app/serien; kein Redirect, kein Formular.
	it('AK5: 404 zeigt Nicht-gefunden-Alert mit Link zu den Serien', async () => {
		getSeriesMock.mockRejectedValue(new ResponseError(new Response(null, { status: 404 })));
		renderView();

		expect(await screen.findByText('Diese Serie gibt es nicht mehr.')).toBeVisible();
		const link = screen.getByRole('link', { name: 'Zu den Serien' });
		expect(link).toHaveAttribute('href', '/app/serien');
	});

	// AK5/TF5: Nach dem Speichern im Bearbeiten-Dialog (TASKS_CHANGED_EVENT) stößt die Ansicht
	// denselben Abruf erneut an — Werte übernehmen ohne Neuladen.
	it('lädt nach TASKS_CHANGED_EVENT erneut', async () => {
		getSeriesMock.mockResolvedValue(sampleSeries());
		renderView();

		await screen.findByRole('heading', { level: 1, name: 'Wochenputz' });
		expect(getSeriesMock).toHaveBeenCalledTimes(1);

		act(() => {
			window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
		});
		await waitFor(() => expect(getSeriesMock).toHaveBeenCalledTimes(2));
	});
});
