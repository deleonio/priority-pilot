import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Pillar, Series, Task } from 'client';
import { TaskStatus } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #305 — Auto-Trigger „Säulen vorschlagen" beim Anlegen eines neuen Tasks
 * mit vorbelegtem Titel (mount-basiert, einmalig, nur wenn task === null und Titel nicht leer).
 *
 * Testebene: Vitest-Komponententest mit gemockter API (kein deterministischer LLM-Aufruf).
 * KoliBri-Komponenten werden durch native HTML-Elemente ersetzt (kein Custom-Element-Registry
 * im jsdom). VoiceField wird als Passthrough-Wrapper gemockt.
 */

// KoliBri-Komponenten: nicht jsdom-kompatibel (Custom Elements). Alle für TaskForm relevanten
// Teile durch native HTML-Elemente ersetzen. KolInputText bekommt einen echten input-Knoten,
// damit Titel-Änderungs-Events (AK4) simuliert werden können.
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, _description }: { _label?: string; _description?: string }) => (
		<div role="alert">
			{_label}
			{_description}
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
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void; onBlur?: (_e: unknown) => void };
	}) => (
		<input
			aria-label={_label}
			defaultValue={_value}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
			onBlur={(e) => _on?.onBlur?.(e.nativeEvent)}
		/>
	),
	KolInputCheckbox: ({
		_label,
		_checked,
		_variant,
		_on,
	}: {
		_label?: string;
		_checked?: boolean;
		_variant?: string;
		_on?: { onChange?: (_e: unknown, v: boolean) => void };
	}) => (
		<input
			type="checkbox"
			role="switch"
			aria-label={_label}
			data-variant={_variant}
			checked={_checked ?? false}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.checked)}
		/>
	),
	KolInputDate: ({ _label }: { _label?: string }) => <input type="date" aria-label={_label} />,
	KolInputRange: ({ _label }: { _label?: string }) => <input type="range" aria-label={_label} />,
	KolSingleSelect: ({ _label }: { _label?: string }) => <select aria-label={_label} />,
	KolSpin: () => <span aria-busy="true" />,
	KolTextarea: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void; onInput?: (_e: unknown, v: string) => void };
	}) => (
		<textarea
			aria-label={_label}
			defaultValue={_value}
			onChange={(e) => {
				_on?.onChange?.(e.nativeEvent, e.target.value);
				_on?.onInput?.(e.nativeEvent, e.target.value);
			}}
		/>
	),
}));

// VoiceField: kapselt SpeechRecognition, für diesen Test nicht relevant.
vi.mock('./VoiceField', () => ({
	VoiceField: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// API-Mock: suggestPillars (#305) und createTask (#315, AK3c) sind hier relevant. Für #316 kommen
// die Serien-Pfade (createSeries/updateSeries), der Task-Edit-Pfad (updateTask) sowie parseText
// (LLM-Vorbelegung, AK6) hinzu.
vi.mock('../api', () => ({
	api: {
		suggestPillars: vi.fn(),
		createTask: vi.fn(),
		updateTask: vi.fn(),
		createSeries: vi.fn(),
		updateSeries: vi.fn(),
		parseText: vi.fn(),
	},
}));

import { api } from '../api';
import { TaskForm } from './TaskForm';

const mockSuggestPillars = api.suggestPillars as ReturnType<typeof vi.fn>;
const mockCreateTask = api.createTask as ReturnType<typeof vi.fn>;
const mockUpdateTask = api.updateTask as ReturnType<typeof vi.fn>;
const mockCreateSeries = api.createSeries as ReturnType<typeof vi.fn>;
const mockUpdateSeries = api.updateSeries as ReturnType<typeof vi.fn>;

// --- Fixtures ---

const pillarKoerper: Pillar = { id: 1, name: 'Körper', description: 'Gesundheit', weight: 100 };

const minimalNewTask = (): Task => ({
	id: 1,
	title: 'Vorhandener Task',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 0.5,
	isException: false,
	pillars: [],
});

const defaultProps = {
	pillars: [pillarKoerper],
	onClose: vi.fn(),
	onSaved: vi.fn(),
};

/**
 * Serien-Fixture für #316: ein bestehendes Serien-Template. Beim Bearbeiten reicht der Container das
 * Template über die (erwartete) neue Prop `series` an das Formular; der Umschalter startet dann fest
 * im Serie-Modus (gesperrt) und die Serienfelder (`startDate`, `rhythm`) sind statt `deadline` sichtbar.
 */
const minimalSeries = (): Series => ({
	id: 7,
	title: 'Wöchentlicher Sport',
	rhythm: 'weekly',
	priority: 3,
	estimatedEffort: 0.5,
	active: true,
	startDate: new Date('2026-09-07T00:00:00.000Z'),
	pillars: [],
});

/**
 * Rendert TaskForm im (erwarteten) Serien-Edit-Modus mit der noch nicht existierenden `series`-Prop.
 * Der lokale Cast ist die bewusste, einzige Typ-Grenze des TDD-Vertrags: Er hält den Typecheck grün,
 * bis die Umsetzung die `series?: Series | null`-Prop zur `TaskFormProps`-Schnittstelle hinzufügt.
 * Zur Laufzeit sind diese Tests rot, solange TaskForm die Prop (und den Serien-Edit-Modus) ignoriert.
 */
const SeriesEditForm = TaskForm as unknown as (
	props: typeof defaultProps & { task: null; series: Series },
) => ReactNode;

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

// --- Tests ---

describe('TaskForm — Auto-Trigger „Säulen vorschlagen" (#305)', () => {
	it('AK1 — löst suggestPillars genau einmal aus, wenn neuer Task mit vorbelegtem Titel gemountet wird', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} initialValues={{ title: 'Steuererklärung 2025' }} {...defaultProps} />);
		});

		expect(mockSuggestPillars).toHaveBeenCalledTimes(1);
		expect(mockSuggestPillars).toHaveBeenCalledWith(
			expect.objectContaining({
				suggestPillarsInput: expect.objectContaining({ title: 'Steuererklärung 2025' }),
			}),
		);
	});

	it('AK2 — kein Trigger beim Bearbeiten eines bestehenden Tasks (task !== null)', async () => {
		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		expect(mockSuggestPillars).not.toHaveBeenCalled();
	});

	it('AK3 — kein Trigger bei leerem Titel (Überspringen-Pfad: task={null}, kein Titel)', async () => {
		await act(async () => {
			render(<TaskForm task={null} initialValues={{ title: '' }} {...defaultProps} />);
		});

		expect(mockSuggestPillars).not.toHaveBeenCalled();
	});

	it('AK3b — kein Trigger ohne initialValues (leerer Anfangszustand)', async () => {
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		expect(mockSuggestPillars).not.toHaveBeenCalled();
	});

	it('AK4 — kein Trigger bei nachträglich manuell eingetipptem Titel (kein onChange-/onBlur-Trigger)', async () => {
		// Formular öffnet mit leerem Titel (Überspringen-Pfad).
		await act(async () => {
			render(<TaskForm task={null} initialValues={{ title: '' }} {...defaultProps} />);
		});

		// Nutzer tippt erst nach dem Öffnen in das Titelfeld.
		const titleInput = screen.getByRole('textbox', { name: /titel/i });
		await act(async () => {
			fireEvent.change(titleInput, { target: { value: 'Nachträglich eingetippt' } });
			fireEvent.blur(titleInput);
		});

		// Der Auto-Trigger basiert ausschließlich auf dem Mount-Effekt — kein onChange-/onBlur-Pfad.
		expect(mockSuggestPillars).not.toHaveBeenCalled();
	});

	it('AK5 — bleibt bei genau einem Aufruf auch bei Re-Render / StrictMode-Doppelmount (Ref-Guard)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		const { rerender } = render(
			<TaskForm task={null} initialValues={{ title: 'Wiederholungstest' }} {...defaultProps} />,
		);

		// Erster Mount kann noch laufen; anschließend Re-Render simulieren.
		await act(async () => {
			rerender(<TaskForm task={null} initialValues={{ title: 'Wiederholungstest' }} {...defaultProps} />);
		});

		expect(mockSuggestPillars).toHaveBeenCalledTimes(1);
	});

	it('AK6 — vorgeschlagene Säulen erscheinen als editierbare Beitragszeilen nach dem Auto-Trigger', async () => {
		// Mock liefert einen Vorschlag für Säule 1 (Körper) mit hoher Konfidenz.
		mockSuggestPillars.mockResolvedValue([{ pillarId: 1, confidence: 80 }]);

		await act(async () => {
			render(<TaskForm task={null} initialValues={{ title: 'Karriere planen' }} {...defaultProps} />);
		});

		// Nach dem Auto-Trigger soll mindestens eine pillar-row im DOM erscheinen
		// (genau wie nach dem manuellen Klick auf „Säulen vorschlagen").
		const pillarRows = document.querySelectorAll('.pillar-row');
		expect(pillarRows.length).toBeGreaterThan(0);
	});
});

/**
 * Roter TDD-Vertrag für #315 (AK3) — das „Status"-Feld verschwindet aus dem Task-Formular.
 *
 * Der Status wird künftig ausschließlich über den binären Erledigt-Toggle in der Aufgaben-Liste
 * gesetzt (nicht mehr im Formular). Daher darf im Create- wie im Edit-Formular kein „Status"-Select
 * mehr im DOM erscheinen, und das Create-Payload (`taskCreate`) darf kein `status`-Feld mehr
 * enthalten.
 *
 * Der KoliBri-Mock macht aus `<KolSingleSelect _label="Status" />` ein `<select aria-label="Status" />`.
 * Diese Specs sind rot, solange TaskForm das Status-Select noch rendert und `status` ins Payload
 * schreibt.
 */
describe('TaskForm — Status-Feld entfernt (#315, AK3)', () => {
	it('AK3a: kein Status-Feld im Create-Formular', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		expect(screen.queryByLabelText('Status')).toBeNull();
	});

	it('AK3b: kein Status-Feld im Edit-Formular', async () => {
		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		expect(screen.queryByLabelText('Status')).toBeNull();
	});

	it('AK3c: Create-Payload enthält kein status-Feld', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateTask.mockResolvedValue(minimalNewTask());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// Titel setzen (submit bricht bei leerem Titel ab).
		const titleInput = screen.getByRole('textbox', { name: /titel/i });
		await act(async () => {
			fireEvent.change(titleInput, { target: { value: 'Neue Aufgabe ohne Status' } });
			fireEvent.blur(titleInput);
		});

		// Anlegen auslösen (Submit-Button im Create-Modus, #334 AK7).
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
		});

		expect(mockCreateTask).toHaveBeenCalledTimes(1);
		const [{ taskCreate }] = mockCreateTask.mock.calls[0] as [{ taskCreate: Record<string, unknown> }];
		expect(taskCreate).not.toHaveProperty('status');
	});
});

/**
 * Rote TDD-Verträge für #316 (Sub-C2 von #296) — TaskForm bekommt einen Task/Serie-Umschalter und
 * einen Serien-Abschnitt; das Speichern verzweigt je nach Modus zum passenden API-Pfad.
 *
 * **Erwartete (noch nicht existierende) Schnittstelle**, gegen die diese Tests fahren:
 *  - Ein Umschalter mit `data-testid="mode-toggle"`, der zwei bedienbare Optionen „Aufgabe" und
 *    „Serie" (als Buttons) enthält. Klick auf „Serie" wechselt in den Serie-Modus.
 *  - Im Serie-Modus sind die Serienfelder sichtbar: `startDate` (Label „Startdatum") und
 *    `rhythm` (Label „Rhythmus"); das `deadline`-Feld („Deadline (optional)") verschwindet.
 *  - Im Task-Modus ist `deadline` sichtbar, die Serienfelder nicht.
 *  - Beim Bearbeiten ist der Umschalter gesperrt (die Optionen sind `disabled`) und initial korrekt
 *    gesetzt: eine neue Prop `series?: Series | null` startet das Formular im Serie-Modus (Serien-
 *    Edit), ein `task` (ohne `series`) im Task-Modus (Task-Edit).
 *  - Speichern verzweigt: Serie-Anlegen → `api.createSeries`, Task-Anlegen → `api.createTask`,
 *    Serie-Edit → `api.updateSeries`, Task-Edit → `api.updateTask`.
 *
 * Diese Specs sind rot, solange TaskForm weder den Umschalter/Serien-Abschnitt rendert noch die
 * Serien-Pfade aufruft (bzw. die `series`-Prop kennt).
 */

/** Wechselt das Formular über den Switch in den Serie-Modus (klickt den Switch im mode-switch-Wrapper). */
const switchToSeriesMode = async (): Promise<void> => {
	const switchEl = screen.getByRole('switch');
	await act(async () => {
		fireEvent.click(switchEl);
	});
};

/** Setzt den Titel im (bereits gerenderten) Formular — `submit` bricht sonst bei leerem Titel ab. */
const fillTitle = async (value: string): Promise<void> => {
	const titleInput = screen.getByRole('textbox', { name: /titel/i });
	await act(async () => {
		fireEvent.change(titleInput, { target: { value } });
		fireEvent.blur(titleInput);
	});
};

/** Löst den Submit-Button im Anlege-Modus aus („Anlegen", #334 AK7). */
const clickSave = async (): Promise<void> => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name: 'Anlegen' }));
	});
};

/** Löst den Submit-Button im Bearbeiten-Modus aus („Bearbeiten", #334 AK7). */
const clickSaveEdit = async (): Promise<void> => {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten' }));
	});
};

describe('AK4 — Umschalter & Feld-Sichtbarkeit je Modus (#316)', () => {
	it('AK1: Anlegen-Modus zeigt einen Switch (kein Button-Paar) (#334)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// rot bis die Implementierung den Switch mit data-testid="mode-switch" rendert.
		const switchWrapper = screen.getByTestId('mode-switch');
		expect(switchWrapper).toBeInTheDocument();
		const switchEl = within(switchWrapper).getByRole('switch');
		expect(switchEl).toBeEnabled();
		// Kein Button-Paar mehr für die Modus-Auswahl.
		expect(screen.queryByRole('button', { name: /serie/i })).toBeNull();
	});

	it('Anlegen/Task-Modus: `deadline` ist sichtbar', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// Standard beim Anlegen ist der Task-Modus: das Deadline-Feld steht im DOM.
		expect(screen.getByLabelText('Deadline (optional)')).toBeInTheDocument();
		// Serienfelder gibt es (noch) nicht.
		expect(screen.queryByLabelText('Startdatum')).toBeNull();
		expect(screen.queryByLabelText('Rhythmus')).toBeNull();
	});

	it('Serie-Modus: `startDate` + `rhythm` sichtbar, `deadline` ausgeblendet', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await switchToSeriesMode();

		// Serienfelder erscheinen …
		expect(screen.getByLabelText('Startdatum')).toBeInTheDocument();
		expect(screen.getByLabelText('Rhythmus')).toBeInTheDocument();
		// … und das Deadline-Feld verschwindet.
		expect(screen.queryByLabelText('Deadline (optional)')).toBeNull();
	});

	it('AK3: Bearbeiten (Task-Edit): Switch ist nicht im DOM (#334)', async () => {
		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		expect(screen.queryByTestId('mode-switch')).toBeNull();
	});

	it('Bearbeiten (Task-Edit): initial im Task-Modus — `deadline` sichtbar, keine Serienfelder', async () => {
		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		expect(screen.getByLabelText('Deadline (optional)')).toBeInTheDocument();
		expect(screen.queryByLabelText('Startdatum')).toBeNull();
		expect(screen.queryByLabelText('Rhythmus')).toBeNull();
	});

	it('Bearbeiten (Serien-Edit): initial im Serie-Modus — Serienfelder sichtbar, kein `deadline`', async () => {
		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		expect(screen.getByLabelText('Startdatum')).toBeInTheDocument();
		expect(screen.getByLabelText('Rhythmus')).toBeInTheDocument();
		expect(screen.queryByLabelText('Deadline (optional)')).toBeNull();
	});

	it('AK3: Bearbeiten (Serien-Edit): Switch ist nicht im DOM (#334)', async () => {
		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		expect(screen.queryByTestId('mode-switch')).toBeNull();
	});
});

describe('AK5 — Speichern verzweigt korrekt (#316)', () => {
	it('Serie-Anlegen → api.createSeries (nicht api.createTask)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await switchToSeriesMode();
		await fillTitle('Neue Serie über TaskForm');
		await clickSave();

		expect(mockCreateSeries).toHaveBeenCalledTimes(1);
		expect(mockCreateTask).not.toHaveBeenCalled();
	});

	it('Serie-Anlegen: leeres startDate fällt auf UTC-Mitternacht des heutigen Tages zurück', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateSeries.mockResolvedValue(minimalSeries());

		const todayUTC = new Date().toISOString().slice(0, 10);
		const expectedStartDate = new Date(todayUTC + 'T00:00:00Z');

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await switchToSeriesMode();
		await fillTitle('Serie ohne explizites Startdatum');
		await clickSave();

		expect(mockCreateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesCreate }] = mockCreateSeries.mock.calls[0] as [{ seriesCreate: Record<string, unknown> }];
		expect(seriesCreate).toHaveProperty('startDate');
		expect((seriesCreate['startDate'] as Date).getTime()).toBe(expectedStartDate.getTime());
	});

	it('Serie-Anlegen → createSeries erhält pillars + description + priority + estimatedEffort', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<TaskForm task={null} initialValues={{ description: 'Serienbeschreibung' }} {...defaultProps} />);
		});

		await switchToSeriesMode();
		await fillTitle('Serie mit Feldern');
		await clickSave();

		expect(mockCreateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesCreate }] = mockCreateSeries.mock.calls[0] as [{ seriesCreate: Record<string, unknown> }];
		expect(seriesCreate).toHaveProperty('pillars');
		expect(seriesCreate).toHaveProperty('description');
		expect(seriesCreate).toHaveProperty('priority');
		expect(seriesCreate).toHaveProperty('estimatedEffort');
	});

	it('Task-Anlegen → api.createTask (nicht api.createSeries)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateTask.mockResolvedValue(minimalNewTask());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await fillTitle('Neue Aufgabe (Task-Modus)');
		await clickSave();

		expect(mockCreateTask).toHaveBeenCalledTimes(1);
		expect(mockCreateSeries).not.toHaveBeenCalled();
	});

	it('Serien-Edit → api.updateSeries (nicht api.updateTask)', async () => {
		mockUpdateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		await fillTitle('Serie umbenannt');
		await clickSaveEdit();

		expect(mockUpdateSeries).toHaveBeenCalledTimes(1);
		expect(mockUpdateTask).not.toHaveBeenCalled();
		const [{ id }] = mockUpdateSeries.mock.calls[0] as [{ id: number }];
		expect(id).toBe(minimalSeries().id);
	});

	it('Task-Edit → api.updateTask (nicht api.updateSeries)', async () => {
		mockUpdateTask.mockResolvedValue(minimalNewTask());

		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		await fillTitle('Aufgabe umbenannt');
		await clickSaveEdit();

		expect(mockUpdateTask).toHaveBeenCalledTimes(1);
		expect(mockUpdateSeries).not.toHaveBeenCalled();
	});
});

describe('AK6 — QuickCapture/LLM + Säulen-Vorschlag in Serie-Modus (#316)', () => {
	it('Serie-Modus: „Säulen vorschlagen" löst /tasks/suggest-pillars aus', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await switchToSeriesMode();
		await fillTitle('Serie mit Säulen-Vorschlag');

		// Der „Säulen vorschlagen"-Button funktioniert auch im Serie-Modus (gleicher Endpoint wie im Task-Modus).
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: /Säulen vorschlagen/i }));
		});

		expect(mockSuggestPillars).toHaveBeenCalled();
		expect(mockSuggestPillars).toHaveBeenLastCalledWith(
			expect.objectContaining({
				suggestPillarsInput: expect.objectContaining({ title: 'Serie mit Säulen-Vorschlag' }),
			}),
		);
	});

	it('Serie-Modus: LLM-Vorbelegung (initialValues) füllt Titel/Beschreibung', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(
				<TaskForm
					task={null}
					initialValues={{ title: 'Aus LLM', description: 'LLM-Beschreibung' }}
					{...defaultProps}
				/>,
			);
		});

		await switchToSeriesMode();

		// Die aus dem LLM-Parsing (#236) vorbelegten Werte stehen auch im Serie-Modus in den Feldern.
		expect((screen.getByRole('textbox', { name: /titel/i }) as HTMLInputElement).value).toBe('Aus LLM');
		expect((screen.getByLabelText(/Beschreibung/i) as HTMLTextAreaElement).value).toBe('LLM-Beschreibung');
	});
});

/**
 * Roter TDD-Vertrag für #334 (AK7) — der Submit-Button benennt den Vorgang statt eines generischen
 * „Speichern": Anlegen → „Anlegen", Bearbeiten (Task wie Serie) → „Bearbeiten".
 *
 * Diese Specs sind rot, solange TaskForm den Submit-Button noch „Speichern" nennt.
 */
describe('AK7 — Submit-Button benennt den Vorgang (#334)', () => {
	it('Anlegen-Modus: Submit-Button heißt „Anlegen"', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		expect(screen.getByRole('button', { name: 'Anlegen' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
	});

	it('Task-Edit-Modus: Submit-Button heißt „Bearbeiten"', async () => {
		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
	});

	it('Serien-Edit-Modus: Submit-Button heißt „Bearbeiten"', async () => {
		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		expect(screen.getByRole('button', { name: 'Bearbeiten' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #343 — „Serien speichern nicht die Säulenzuordnung".
 *
 * **Bug:** Im Serien-Edit-Modus ist `task === null`, deshalb bleibt der `contributions`-State beim
 * Mount leer, obwohl `series.pillars` bereits eine Säulenzuordnung enthält. Beim erneuten Speichern
 * geht die Zuordnung damit verloren (das `updateSeries`-Payload enthält `pillars: []`).
 *
 * **Erwartetes Soll (Fix, hier NICHT umgesetzt):** Der `contributions`-Initialwert fällt im
 * Serien-Edit-Modus auf `series?.pillars` zurück, sodass die bestehende Zuordnung ins Formular
 * geladen und beim Speichern erhalten bleibt.
 *
 * Diese Specs sind rot, solange TaskForm `series.pillars` beim Mount ignoriert.
 */
describe('AK — Säulenzuordnung im Serien-Edit-Modus (#343)', () => {
	it('AK1 — Vorbelegung: bestehende Säulenzuordnung wird ins Formular geladen', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(
				<SeriesEditForm
					task={null}
					series={{ ...minimalSeries(), pillars: [{ pillarId: 1, share: 100, confidence: 90 }] }}
					{...defaultProps}
				/>,
			);
		});

		// Die aus `series.pillars` vorbelegte Zuordnung erscheint als Beitragszeile mit dem Säulennamen.
		// Der Säulenname steht (über den KoliBri-Mock als `aria-label`) im Anteils-Slider der Zeile.
		const pillarRows = document.querySelectorAll('.pillar-row');
		expect(pillarRows.length).toBeGreaterThan(0);
		expect(screen.getByLabelText(/Körper/)).toBeInTheDocument();
	});

	it('AK2 — Erhalt beim Speichern: updateSeries behält die Säulenzuordnung', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockUpdateSeries.mockResolvedValue({ ...minimalSeries(), pillars: [{ pillarId: 1, share: 100, confidence: 90 }] });

		await act(async () => {
			render(
				<SeriesEditForm
					task={null}
					series={{ ...minimalSeries(), pillars: [{ pillarId: 1, share: 100, confidence: 90 }] }}
					{...defaultProps}
				/>,
			);
		});

		// Kein fillTitle nötig — series.title ist bereits vorbelegt.
		// Serien-Edit-Modus: Der Submit-Button heißt „Bearbeiten" (#334 AK7).
		await clickSaveEdit();

		expect(mockUpdateSeries).toHaveBeenCalledTimes(1);
		const [{ id, seriesUpdate }] = mockUpdateSeries.mock.calls[0] as [
			{ id: number; seriesUpdate: { pillars: Array<{ pillarId: number; share: number; confidence: number }> } },
		];
		expect(id).toBe(7);
		expect(seriesUpdate.pillars).toHaveLength(1);
		expect(seriesUpdate.pillars[0].pillarId).toBe(1);
		expect(seriesUpdate.pillars[0].confidence).toBe(90);
		expect(seriesUpdate.pillars[0].share).toBeCloseTo(100);
	});
});
