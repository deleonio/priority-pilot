import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { api } from './api';
import { App } from './App';
import type { Task } from 'client';
import { TaskStatus } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `./api` wird vollständig gemockt, damit `App` ohne Backend lädt. Der `vi.mock`-Call wird von
 * Vitest automatisch an den Dateianfang gehoist (vor alle Imports), sodass `App` und `api`
 * bereits die gemockte Fassade erhalten. Die Mock-Rückgabewerte werden bewusst in `beforeEach`
 * gesetzt (nicht in der Factory), weil `vi.mock`-Factories vor der Modul-Initialisierung laufen
 * und dort definierte Variablen (wie `sampleTask`) noch nicht verfügbar sind.
 *
 * `listTasks` liefert genau einen Task, weil `App` das Dashboard nur bei `tasks.length > 0`
 * rendert — sonst greift der EmptyState und die Begrüßung wäre nie sichtbar.
 *
 * #169: Diese Tests sind ROT, weil `App.tsx` den `displayName` noch nicht aus `localStorage`
 * liest und `Dashboard.tsx` keine personalisierte Begrüßung rendert. Sie werden grün, sobald
 * die Kette `localStorage → displayName-Prop → Begrüßungstext` implementiert ist.
 */
vi.mock('./api', () => ({
	api: {
		listTasks: vi.fn(),
		getForest: vi.fn(),
		getNextTask: vi.fn(),
		getSuggestions: vi.fn(),
		listPillars: vi.fn(),
	},
}));

const sampleTask: Task = {
	id: 1,
	title: 'T1',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars: [],
};

beforeEach(() => {
	localStorage.clear();
	vi.mocked(api.listTasks).mockResolvedValue([sampleTask]);
	vi.mocked(api.getForest).mockResolvedValue([]);
	vi.mocked(api.getNextTask).mockResolvedValue(null);
	vi.mocked(api.getSuggestions).mockResolvedValue([]);
	vi.mocked(api.listPillars).mockResolvedValue([]);
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe('App — Personalisierte Begrüßung aus localStorage (#169)', () => {
	// AC3: Name in localStorage → App liest ihn → Dashboard zeigt „Hallo Peter!".
	it('zeigt „Hallo Peter!" wenn displayName in localStorage gesetzt ist', async () => {
		localStorage.setItem('displayName', 'Peter');

		render(<App />);

		await waitFor(() => {
			expect(screen.getByText(/Hallo\s+Peter!/i)).toBeTruthy();
		});
	});

	// AC2 (App-Perspektive): Kein Eintrag → sinnvoller Fallback, keine leere „Hallo !".
	it('zeigt einen Fallback-Namen statt „Hallo !" wenn kein displayName gesetzt ist', async () => {
		render(<App />);

		// Begrüßung mit einem echten (Fallback-)Namen muss erscheinen …
		const greeting = await screen.findByText(/Hallo\s+\w+!/i);
		expect(greeting).toBeTruthy();
		// … und insbesondere KEINE leere „Hallo !" ohne Namen.
		expect(document.body.textContent ?? '').not.toMatch(/Hallo\s*!/);
	});
});
