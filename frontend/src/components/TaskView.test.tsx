import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskStatus } from 'client';
import type { Task } from 'client';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

/**
 * Rote Spec-Tests für #2938 — AK4 (Lade-/Fehlerzustände) und AK6 (Felder ohne Wert,
 * „Mehr Details"). Spezifikation: docs/spec/issue-2938.md.
 * Seit #2940 (Teil 3): Blöcke Ort/Herkunft/Einordnung — Spezifikation: docs/spec/issue-2940.md.
 * Rot, bis `TaskView` existiert (fehlt das Modul, ist das der legitime erste Rot-Zustand).
 */

// API-Fassade (Vertrag: getTask({ id }) → Task, !ok → ResponseError mit response.status 404)
// als Mock über vi.hoisted, weil der echte Export in api.ts erst mit der Umsetzung entsteht.
const { getTaskMock, getPillarsMock, getCategoriesMock, getSeriesMock } = vi.hoisted(() => ({
	getTaskMock: vi.fn(),
	getPillarsMock: vi.fn(),
	getCategoriesMock: vi.fn(),
	getSeriesMock: vi.fn(),
}));
vi.mock('../api', () => ({
	getTask: getTaskMock,
	getPillars: getPillarsMock,
	getCategories: getCategoriesMock,
	getSeries: getSeriesMock,
}));

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
	KolPopoverButton: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-label={_label}>{children}</div>
	),
}));

import { TaskView } from './TaskView';

const sampleTask = (overrides: Partial<Task> = {}): Task =>
	({
		id: 42,
		title: 'Kundenbericht fertigstellen',
		status: TaskStatus.Open,
		priority: 3,
		estimatedEffort: 0.5,
		description: 'Zahlen prüfen und abschicken.',
		deadline: new Date('2030-01-15T12:00:00.000Z'),
		address: null,
		...overrides,
	}) as Task;

const renderView = () => render(<TaskView taskId={42} onBack={vi.fn()} onEdit={vi.fn()} />);

describe('TaskView (#2938)', () => {
	beforeEach(() => {
		getTaskMock.mockReset();
		getPillarsMock.mockReset();
		getCategoriesMock.mockReset();
		getSeriesMock.mockReset();
	});

	// AK4/TF4a: Während des Ladens Skelett in der Form der Ansicht (Titelbalken + Faktenzeilen),
	// kein Spinner/Alert und noch keine Aufgabe.
	it('AK4: zeigt während des Ladens ein Skelett ohne Spinner', () => {
		getTaskMock.mockReturnValue(new Promise(() => {}));
		const { container } = renderView();

		expect(container.querySelector('.task-view-skeleton')).not.toBeNull();
		expect(container.querySelector('.task-view-skeleton-title')).not.toBeNull();
		expect(container.querySelectorAll('.task-view-skeleton-row').length).toBeGreaterThanOrEqual(2);
		expect(screen.queryByRole('alert')).toBeNull();
		expect(screen.queryByText('Kundenbericht fertigstellen')).toBeNull();
	});

	// AK4/TF4b: Ladefehler → Fehler-KolAlert mit „Erneut laden"; Klick stößt denselben Abruf
	// erneut an.
	it('AK4: Ladefehler zeigt Fehler-Alert und lädt bei „Erneut laden" erneut', async () => {
		getTaskMock.mockRejectedValue(new Error('Netzwerk weg'));
		renderView();

		expect(await screen.findByText('Daten konnten nicht geladen werden')).toBeVisible();
		expect(getTaskMock).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole('button', { name: 'Erneut laden' }));
		await waitFor(() => expect(getTaskMock).toHaveBeenCalledTimes(2));
	});

	// Fixup-Review: TASKS_CHANGED_EVENT (TaskForm löst es nach dem Speichern aus) stößt einen
	// erneuten Abruf an — die Leseseite zeigt danach die gespeicherten Werte, nicht den alten Stand.
	it('lädt nach TASKS_CHANGED_EVENT erneut', async () => {
		getTaskMock.mockResolvedValue(sampleTask());
		renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });
		expect(getTaskMock).toHaveBeenCalledTimes(1);

		act(() => {
			window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
		});
		await waitFor(() => expect(getTaskMock).toHaveBeenCalledTimes(2));
	});

	// AK6/TF6a: Felder ohne Wert erscheinen nicht — ohne Adresse gibt es keinen Ort-Block
	// (auch nicht eingeklappt unter „Mehr Details").
	it('AK6: ohne Adresse erscheint kein Ort-Block', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ address: null }));
		const { container } = renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });
		expect(container.textContent).not.toContain('Ort');
	});

	// AK4 (#2940/TF5): Adresse wird eigener „Ort"-Block (h2) mit Karten-Link bei Koordinaten;
	// „Mehr Details" entfällt ganz. Test-Pflege: ersetzt TF6b aus #2938 (Ort unter „Mehr Details")
	// — AK4 #2940 widerspricht genau diesem alten Verhalten.
	it('AK4: Adresse erscheint als eigener Ort-Block, „Mehr Details" entfällt', async () => {
		getTaskMock.mockResolvedValue(
			sampleTask({ address: 'Mauerstraße 1, 10117 Berlin', latitude: 52.52, longitude: 13.405 }),
		);
		renderView();

		expect(await screen.findByRole('heading', { level: 2, name: 'Ort' })).toBeVisible();
		expect(screen.getByText('Mauerstraße 1, 10117 Berlin')).toBeVisible();
		expect(screen.getByRole('link', { name: 'In Karten öffnen' })).toHaveAttribute(
			'href',
			expect.stringContaining('maps'),
		);
		expect(document.querySelector('details')).toBeNull();
	});

	// AK3 (#2940/TF5): Serien-Instanz → Herkunfts-Block mit Link auf /serien/<id>.
	it('AK3: Serien-Instanz zeigt Herkunfts-Block mit Link auf die Serie', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ seriesId: 5 }));
		getSeriesMock.mockResolvedValue({ id: 5, name: 'Wochenbericht', autoCreate: true });
		renderView();

		expect(await screen.findByRole('heading', { level: 2, name: 'Herkunft' })).toBeVisible();
		expect(screen.getByRole('link', { name: 'Aus Serie „Wochenbericht"' })).toHaveAttribute(
			'href',
			expect.stringContaining('/serien/5'),
		);
		expect(screen.queryByText('Abweichend von der Serie bearbeitet')).toBeNull();
	});

	// AK3 (#2940/TF5): Vorlage (autoCreate = false) → „Aus Vorlage"; isException → Abweichungshinweis.
	it('AK3: Vorlage zeigt „Aus Vorlage", isException den Abweichungshinweis', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ seriesId: 6, isException: true }));
		getSeriesMock.mockResolvedValue({ id: 6, name: 'Monatsplanung', autoCreate: false });
		renderView();

		expect(await screen.findByRole('link', { name: 'Aus Vorlage „Monatsplanung"' })).toBeVisible();
		expect(screen.getByText('Abweichend von der Serie bearbeitet')).toBeVisible();
	});

	// AK3 (#2940/TF5): Serie nicht mehr auflösbar (z. B. nur noch originSeriesId) → Block entfällt.
	it('AK3: Serie nicht auflösbar → Herkunfts-Block entfällt', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ seriesId: 7 }));
		getSeriesMock.mockRejectedValue(new Error('Serie weg (404)'));
		renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });
		expect(screen.queryByRole('heading', { level: 2, name: 'Herkunft' })).toBeNull();
	});

	// AK5 (#2940/TF5): Säulen- und Kategorienamen als Text im Einordnung-Block.
	it('AK5: Säulen- und Kategorienamen erscheinen im Einordnung-Block', async () => {
		getTaskMock.mockResolvedValue(sampleTask({ pillars: [{ pillarId: 7, share: 100 }], categoryId: 3 }));
		getPillarsMock.mockResolvedValue([
			{ id: 7, name: 'Wirksamkeit' },
			{ id: 8, name: 'Körper' },
		]);
		getCategoriesMock.mockResolvedValue([{ id: 3, name: 'Admin' }]);
		renderView();

		expect(await screen.findByRole('heading', { level: 2, name: 'Einordnung' })).toBeVisible();
		expect(screen.getByText('Wirksamkeit')).toBeVisible();
		expect(screen.getByText('Admin')).toBeVisible();
	});

	// AK5 (#2940/TF5): ohne Säule und Kategorie entfällt der Block („Leer bleibt leer").
	it('AK5: ohne Säule und Kategorie entfällt der Einordnung-Block', async () => {
		getTaskMock.mockResolvedValue(sampleTask());
		getPillarsMock.mockResolvedValue([{ id: 7, name: 'Wirksamkeit' }]);
		getCategoriesMock.mockResolvedValue([{ id: 3, name: 'Admin' }]);
		renderView();

		await screen.findByRole('heading', { level: 1, name: 'Kundenbericht fertigstellen' });
		expect(screen.queryByRole('heading', { level: 2, name: 'Einordnung' })).toBeNull();
	});
});
