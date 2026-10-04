import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api', () => ({
	api: {
		previewTaskImport: vi.fn(),
		importTasks: vi.fn(),
		// #1988: Analyse-Bericht + Dubletten-Merge. Default-Grundform, damit Bestands-Tests
		// nach der Impl nicht an undefined scheitern.
		analyzeTaskImport: vi.fn(async () => ({ total: 3, missingDeadlines: [], duplicates: [], suggestions: [] })),
		mergeTaskImportDuplicate: vi.fn(async () => ({})),
	},
}));

import { api } from '../api';
import { TaskImportCard } from './TaskImportCard';
import '../i18n/config';

// Rote Spec-Tests für #1969 (Spec `docs/spec/issue-1969.md`, AK6): Die Import-Karte in den
// Einstellungen — Datei wählen, Vorschau mit Fehlerliste und Spalten-Mapping prüfen, mit
// Kontext-Label übernehmen. Die Komponente existiert noch nicht → erster roter Zustand ist
// der fehlende Modul-Import. KoliBri-Prüfung über Attribute (jsdom-inert, Muster
// OnboardingFlow.test.tsx).

afterEach(cleanup);

beforeEach(() => {
	vi.clearAllMocks();
});

const apiMock = api as unknown as Record<
	'previewTaskImport' | 'importTasks' | 'analyzeTaskImport' | 'mergeTaskImportDuplicate',
	ReturnType<typeof vi.fn>
>;

const PREVIEW = {
	total: 4,
	valid: 3,
	skippedNonTask: 1,
	samples: [{ row: 1, title: 'Steuererklärung', deadline: '2026-11-02T00:00:00.000Z', priority: 5 }],
	errors: [{ row: 3, reason: 'Titel fehlt' }],
	unmapped: [{ row: 4, field: 'category', value: 'Fremdkategorie' }],
};

const IMPORT_RESULT = { created: 3, skippedNonTask: 1, errors: [] };

const CSV = 'TYPE,CONTENT,PRIORITY,DATE\r\ntask,Steuererklärung,4,2026-11-02';

const chooseFile = async (): Promise<void> => {
	const input = document.body.querySelector('.task-import-card input[type="file"]');
	expect(input, 'Datei-Eingabe muss in der Karte liegen').toBeDefined();
	fireEvent.change(input as Element, { target: { files: [new File([CSV], 'todoist.csv', { type: 'text/csv' })] } });
};

/** Der kol-button-Host mit exakt diesem `_label` (Muster OnboardingFlow.test.tsx). */
const kolButton = (label: RegExp): Element | undefined =>
	[...document.body.querySelectorAll('.task-import-card kol-button')].find((el) =>
		label.test(el.getAttribute('_label') ?? ''),
	);

describe('TaskImportCard (Spec #1969 AK6)', () => {
	it('zeigt nach Datei-Auswahl Vorschau, Fehlerliste mit Zeilennummer+Grund, Mapping-Selects und Kontext-Label', async () => {
		apiMock.previewTaskImport.mockResolvedValue(PREVIEW);
		render(<TaskImportCard />);

		expect(
			document.body.querySelector('.task-import-card input[type="file"]'),
			'Leerzustand lädt zur Datei-Auswahl ein',
		).toBeDefined();

		await chooseFile();

		// Zahlen mit Kontext („3 von 4“) statt nackter Zahl.
		await waitFor(() => expect(document.body.textContent).toMatch(/3 von 4/));
		// Fehlerzeilen dauerhaft als Liste mit Nummer + Grund.
		expect(document.body.textContent).toContain('Zeile 3');
		expect(document.body.textContent).toContain('Titel fehlt');
		// Mapping je Zielfeld als Select.
		const mappingLabels = [...document.body.querySelectorAll('.task-import-card kol-single-select')].map((el) =>
			el.getAttribute('_label'),
		);
		for (const label of ['Titel', 'Frist', 'Priorität', 'Kategorie', 'Säule']) {
			expect(mappingLabels, `Mapping-Select „${label}“ fehlt`).toContain(label);
		}
		// Bestätigung mit Kontext-Label statt nur „Übernehmen“.
		expect(kolButton(/3 Aufgaben übernehmen/)).toBeDefined();
		expect(apiMock.previewTaskImport).toHaveBeenCalledTimes(1);
	});

	it('übernimmt mit dem Kontext-Button und meldet die Anzahl erzeugter Aufgaben als Erfolg', async () => {
		apiMock.previewTaskImport.mockResolvedValue(PREVIEW);
		apiMock.importTasks.mockResolvedValue(IMPORT_RESULT);
		render(<TaskImportCard />);

		await chooseFile();
		const confirmButton = await waitFor(() => {
			const button = kolButton(/Aufgaben übernehmen/);
			expect(button, 'Bestätigungs-Button nach Vorschau').toBeDefined();
			return button as Element;
		});

		await waitFor(async () => {
			(confirmButton as unknown as { _on?: { onClick?: () => void } })._on?.onClick?.();
			expect(apiMock.importTasks).toHaveBeenCalledTimes(1);
		});
		expect(apiMock.importTasks.mock.calls[0]?.[0]).toMatchObject({ csv: CSV });

		// Erfolg als KolAlert mit Anzahl (KI-UX: Erfolg-Zustand, Fokus-Ziel).
		await waitFor(() => {
			const alert = document.body.querySelector('.task-import-card kol-alert');
			expect(alert, 'Erfolgs-Meldung als KolAlert').toBeDefined();
			expect(alert?.getAttribute('_type')).toBe('success');
			expect(alert?.textContent ?? '').toContain('3');
		});
	});
});

// Rote Spec-Tests #1988 (Spec docs/spec/issue-1988.md, AK1/AK5/AK6-UI): Nach dem Übernehmen
// zeigt die Karte den Analyse-Bericht (Anzahl, Aufgaben ohne Frist, exakte Dubletten mit
// Begründung); je Dublette eine Merge-Aktion mit Objekt im accessible name.
const ANALYSIS_1988 = {
	total: 3,
	missingDeadlines: [{ id: 11, title: 'Steuererklärung' }],
	duplicates: [
		{
			keepTaskId: 11,
			duplicateTaskId: 12,
			title: 'Einkaufen',
			reason: 'Identischer Titel wie bestehende Aufgabe „Einkaufen“',
		},
	],
	suggestions: [],
};

describe('TaskImportCard (Spec #1988 AK1/AK6)', () => {
	it('zeigt nach dem Import den Bericht mit Anzahl, ohne-Frist-Liste und Dubletten mit Begründung; Merge-Aktion trägt das Objekt im Namen', async () => {
		apiMock.importTasks.mockResolvedValue(IMPORT_RESULT);
		apiMock.analyzeTaskImport.mockResolvedValue(ANALYSIS_1988);
		render(<TaskImportCard />);

		await chooseFile();
		await waitFor(() => expect(kolButton(/3 Aufgaben übernehmen/)).toBeDefined());
		fireEvent.click(kolButton(/3 Aufgaben übernehmen/)!);

		// Bericht statt nackter Erfolgsmeldung (AK1): Zahlen mit Kontext, Listen mit Inhalt.
		await waitFor(() => expect(document.body.textContent).toContain('3 Aufgaben übernommen'));
		expect(document.body.textContent).toContain('Steuererklärung');
		expect(document.body.textContent).toContain('Identischer Titel');
		expect(apiMock.analyzeTaskImport).toHaveBeenCalledTimes(1);

		// Dubletten-Merge (AK6): Aktion benennt das Objekt, ruft den Merge-Endpunkt auf.
		const mergeBtn = kolButton(/Dublette ‚Einkaufen‘ zusammenführen/);
		expect(mergeBtn, 'Merge-Button mit Objektname fehlt').toBeDefined();
		fireEvent.click(mergeBtn!);
		await waitFor(() =>
			expect(apiMock.mergeTaskImportDuplicate).toHaveBeenCalledWith({ keepTaskId: 11, duplicateTaskId: 12 }),
		);
	});
});
