import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Pillar, Series, SeriesRhythm, Task } from 'client';
import { ResponseError, TaskStatus } from 'client';
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
	KolAlert: ({ _label, _description, children }: { _label?: string; _description?: string; children?: ReactNode }) => (
		<div role="alert">
			{_label}
			{_description}
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
		_disabled,
		_on,
	}: {
		_label?: string;
		_checked?: boolean;
		_variant?: string;
		_disabled?: boolean;
		_on?: { onChange?: (_e: unknown, v: boolean) => void };
	}) => (
		<input
			type="checkbox"
			role="switch"
			aria-label={_label}
			data-variant={_variant}
			disabled={_disabled}
			checked={_checked ?? false}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.checked)}
		/>
	),
	KolInputDate: ({
		_label,
		_on,
	}: {
		_label?: string;
		_on?: { onChange?: (_e: unknown, v: unknown) => void; onInput?: (_e: unknown, v: unknown) => void };
	}) => (
		<input
			type="date"
			aria-label={_label}
			data-testid={`input-date-${_label}`}
			onChange={(e) => {
				_on?.onChange?.(e.nativeEvent, e.target.value === '' ? '' : new Date(`${e.target.value}T00:00:00Z`));
			}}
		/>
	),
	KolInputRange: ({ _label }: { _label?: string }) => <input type="range" aria-label={_label} />,
	KolSingleSelect: ({
		_label,
		_options,
		_value,
		_on,
	}: {
		_label?: string;
		_options?: { label: string; value: string }[];
		_value?: string;
		_on?: { onChange?: (_e: unknown, v: string) => void };
	}) => (
		<select
			aria-label={_label}
			data-testid={`select-${_label}`}
			value={_value ?? ''}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
		>
			{(_options ?? []).map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	),
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

// #553: Neuer Bestätigungs-Modal für die Serien-Bearbeitungs-Kaskade. Der Mock bildet die
// erwartete (noch nicht existierende) Schnittstelle ab: zwei Buttons „Ja"/„Nein", die den
// gewählten Kaskade-Wert an `onConfirm(cascade)` zurückmelden. Rot, solange TaskForm den
// Modal beim Speichern mit geänderten kaskadierbaren Feldern noch nicht einblendet.
vi.mock('./ConfirmSeriesActionModal', () => ({
	ConfirmSeriesActionModal: ({ onConfirm }: { onConfirm?: (cascade: boolean) => void }) => (
		<div data-testid="confirm-series-modal">
			<button onClick={() => onConfirm?.(true)}>Ja</button>
			<button onClick={() => onConfirm?.(false)}>Nein</button>
		</div>
	),
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
	// #546: Auf den mode-switch-Wrapper scopen, da der Auto-Löschen-Schalter ebenfalls als
	// `role="switch"` (KolInputCheckbox) rendert — unscoped wäre getByRole('switch') mehrdeutig.
	const switchEl = within(screen.getByTestId('mode-switch')).getByRole('switch');
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

		// #553: Eine Title-Änderung ist kaskadierbar und öffnet daher das Kaskade-Bestätigungs-Modal;
		// „Ja" schließt das Speichern ab (Endpoint bleibt `updateSeries`, nicht `updateTask`).
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
		});

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

/**
 * Rote Spec-Tests für #440 (AK2): Bei 0 Säulen zeigt das Task-Formular kein leeres
 * Säulen-Auswahlfeld; stattdessen einen dezenten Hinweis „Keine Säulen definiert".
 * Der Test ist rot, solange TaskForm bei pillars=[] noch die Pillar-Auswahl rendert.
 */
describe('TaskForm — Empty-State bei 0 Säulen (Issue #440, AK2)', () => {
	it('AK2: blendet die Säulen-Auswahl aus, wenn pillars leer ist', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} pillars={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
		});

		// Kein Select für die Säulen-Auswahl, wenn keine Säulen existieren.
		expect(screen.queryByLabelText('Säule hinzufügen')).toBeNull();

		// Stattdessen erscheint ein dezentner Hinweis.
		expect(screen.getByText(/keine säulen definiert/i)).toBeInTheDocument();
	});

	it('AK2: zeigt die Säulen-Auswahl, wenn pillars nicht leer ist', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} pillars={[pillarKoerper]} onClose={vi.fn()} onSaved={vi.fn()} />);
		});

		// Bei vorhandenen Säulen erscheint die Säulen-Auswahl wieder.
		expect(screen.queryByLabelText('Säule hinzufügen')).not.toBeNull();
		expect(screen.queryByText(/keine säulen definiert/i)).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #470 — Serien-Rhythmen: Werktags/Wochenende/Wochentag (Frontend).
 *
 * Das Backend (#469, gemergt) hat `SeriesRhythm` als String-Union mit 12 Werten umgesetzt
 * (`daily`, `weekly`, `monthly`, `weekdays`, `weekend`, `mon`…`sun`). Die Anzeige-Bereiche
 * (`SeriesTab`, `SeriesManagementModal`) kennen die neuen `RHYTHM_LABEL` bereits. Es fehlt
 * **ausschließlich die Erfassung im `TaskForm`**: `RHYTHM_OPTIONS` enthält aktuell nur drei Werte,
 * und der `onChange`-Guard im Rhythmus-Select verwirft alle Werte außer `daily`/`weekly`/`monthly`.
 *
 * Diese Specs prüfen das erwartete Soll-Verhalten und sind rot, solange die Umsetzung fehlt:
 *  - AK1 (Auswahl): alle 12 Rhythmus-Optionen stehen im Serie-Modus zur Verfügung.
 *  - AK2 (Speichern): ein neuer Rhythmus (z. B. `weekdays`) wird beim Speichern korrekt übergeben.
 *  - AK5 (startDate-Konsistenz): bei `mon`…`sun` mit nicht-passendem `startDate` wird client-seitig
 *    gewarnt; eine vom Backend kommende 400 wird verständlich durchgereicht.
 *
 * Der KoliBri-Mock rendert `KolSingleSelect` als natives `<select>` mit echten `<option>`s, sodass
 * die verfügbaren Optionen sowie onChange-Wechsel assertionsfähig sind (verhaltensneutraler Helfer).
 */
describe('TaskForm — Serien-Rhythmen: Werktags/Wochenende/Wochentag (#470)', () => {
	/** Die 12 gültigen `SeriesRhythm`-Werte (Backend ENUM, #469). */
	const ALL_RHYTHMS: SeriesRhythm[] = [
		'daily',
		'weekly',
		'monthly',
		'weekdays',
		'weekend',
		'mon',
		'tue',
		'wed',
		'thu',
		'fri',
		'sat',
		'sun',
	];

	it('AK1 — Serie-Modus: alle 12 Rhythmus-Optionen verfügbar', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();

		// Der Rhythmus-Select bietet alle 12 Werte an (rot, solange RHYTHM_OPTIONS nur 3 enthält).
		const rhythmSelect = screen.getByLabelText('Rhythmus') as HTMLSelectElement;
		const optionValues = Array.from(rhythmSelect.options).map((option) => option.value);
		for (const rhythm of ALL_RHYTHMS) {
			expect(optionValues, `Rhythmus-Option „${rhythm}“ fehlt`).toContain(rhythm);
		}
		expect(optionValues).toHaveLength(ALL_RHYTHMS.length);
	});

	it('AK1 — Serie-Modus: Werktags/Wochenende/Wochentage mit deutschen Bezeichnungen', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();

		const rhythmSelect = screen.getByLabelText('Rhythmus') as HTMLSelectElement;
		const optionLabels = Array.from(rhythmSelect.options).map((option) => option.textContent ?? '');
		// Die neuen Optionen sind mit sprechenden deutschen Bezeichnungen beschriftet (konsistent zu
		// `RHYTHM_LABEL` in SeriesTab.tsx). Rot, solange diese Optionen fehlen.
		for (const label of [
			'Werktags',
			'Wochenende',
			'Montags',
			'Dienstags',
			'Mittwochs',
			'Donnerstags',
			'Freitags',
			'Samstags',
			'Sonntags',
		]) {
			expect(optionLabels, `Bezeichnung „${label}“ fehlt`).toContain(label);
		}
	});

	it('AK2 — Speichern setzt rhythm korrekt für neuen Wert (weekdays)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();
		await fillTitle('Werktags-Serie');

		// Rhythmus auf „Werktags" (weekdays) setzen. Rot, solange der onChange-Guard den neuen
		// Wert verwirft (aktuell nur daily/weekly/monthly zugelassen).
		const rhythmSelect = screen.getByLabelText('Rhythmus');
		await act(async () => {
			fireEvent.change(rhythmSelect, { target: { value: 'weekdays' } });
		});
		await clickSave();

		expect(mockCreateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesCreate }] = mockCreateSeries.mock.calls[0] as [{ seriesCreate: { rhythm: string } }];
		expect(seriesCreate.rhythm).toBe('weekdays');
	});

	it('AK2 — onChange-Guard nimmt jeden gültigen SeriesRhythm-Wert an (kein hartcodierter Drei-Werte-Filter)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateSeries.mockResolvedValue(minimalSeries());

		// Stellvertretend für alle neuen Werte: „weekend" (Wochenende) wählen und speichern.
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();
		await fillTitle('Wochenend-Serie');

		const rhythmSelect = screen.getByLabelText('Rhythmus');
		await act(async () => {
			fireEvent.change(rhythmSelect, { target: { value: 'weekend' } });
		});
		await clickSave();

		expect(mockCreateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesCreate }] = mockCreateSeries.mock.calls[0] as [{ seriesCreate: { rhythm: string } }];
		expect(seriesCreate.rhythm).toBe('weekend');
	});

	/**
	 * AK5 — Wochentag-Rhythmus mit nicht-passendem startDate zeigt Client-Warnung.
	 *
	 * Wählt der Nutzer z. B. `wed` (Mittwoch) und liegt das `startDate` an einem anderen Wochentag,
	 * wird client-seitig frühzeitig gewarnt (Hinweis/Alert). Das Backend lehnt diese Kombination mit
	 * 400 ab (`server/src/express/routes/series.ts`, RHYTHM_WEEKDAY-Map); das Frontend soll den
	 * Nutzer davor bewahren. Rot, solange keine solche Prüfung existiert.
	 *
	 * 2026-09-07 ist ein Montag (getDay() === 1) — passt also nicht zu `wed` (Mittwoch, 3).
	 */
	it('AK5 — Wochentag-Rhythmus mit nicht-passendem startDate zeigt Client-Warnung', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();
		await fillTitle('Mittwoch-Serie');

		// Startdatum auf einen Montag setzen (2026-09-07 = Montag, getDay() === 1).
		const startDateInput = screen.getByLabelText('Startdatum');
		await act(async () => {
			fireEvent.change(startDateInput, { target: { value: '2026-09-07' } });
		});

		// Rhythmus auf Mittwoch (wed) wählen — passt nicht zum Montag-Startdatum.
		const rhythmSelect = screen.getByLabelText('Rhythmus');
		await act(async () => {
			fireEvent.change(rhythmSelect, { target: { value: 'wed' } });
		});

		// Eine client-seitige Warnung erscheint (z. B. KolAlert oder Hinweistext), die auf den
		// Wochentag-Konflikt hinweist. Rot, solange die Umsetzung die Prüfung nicht durchführt.
		const warning = document.querySelector('[role="alert"], .rhythm-weekday-hint');
		expect(warning, 'Client-seitige Warnung bei Wochentag-StartDate-Konflikt fehlt').not.toBeNull();
	});

	/**
	 * AK5 — Backend-400 wird verständlich durchgereicht.
	 *
	 * Schlägt das Speichern (z. B. bei einem `mon`…`sun`/`startDate`-Konflikt) fehlt, leitet das
	 * Frontend die 400-Fehlermeldung verständlich durch (bestehende toApiError-Pipeline). Rot,
	 * solange die Fehlermeldung nicht angezeigt wird.
	 */
	it('AK5 — Backend-400 wird verständlich durchgereicht', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		// Backend lehnt die Kombination (Rhythmus-Wochentag ↔ startDate) mit 400 + deutscher Meldung ab.
		// Wie der generierte API-Client wirft `createSeries` einen echten `ResponseError` (Response-Body
		// `{ message }`), den `toApiError` zu einer verständlichen Meldung auflöst.
		mockCreateSeries.mockRejectedValue(
			new ResponseError(
				new Response(JSON.stringify({ message: 'rhythm "wed" erfordert ein startDate an einem Mittwoch.' }), {
					status: 400,
				}),
			),
		);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();
		await fillTitle('Wochentag-Serie mit Konflikt');

		const rhythmSelect = screen.getByLabelText('Rhythmus');
		await act(async () => {
			fireEvent.change(rhythmSelect, { target: { value: 'wed' } });
		});
		await clickSave();

		// Die vom Backend kommende 400 wird im Fehler-Alert verständlich angezeigt. Rot, solange die
		// 400-Servermeldung nicht durchgereicht wird (z. B. nur ein generisches „Speichern fehlgeschlagen").
		await act(async () => {});
		const alert = screen.queryByRole('alert');
		expect(alert, 'Fehler-Alert fehlt').not.toBeNull();
		expect(alert?.textContent ?? '').toMatch(/mittwoch/);
	});
});

/**
 * Rote Spec-Tests für #523 (Frontend) — „Automatisches Löschen bei verpasster Deadline".
 *
 * **Erwartete (noch nicht existierende) Schnittstelle** im Task-Modus des TaskForm:
 *  - AK5: eine Checkbox mit dem Label „Automatisch löschen nach 3 Tagen bei verpasster Deadline".
 *  - AK6: wird die Checkbox aktiviert, erscheint ein eigener, sichtbarer Info-Hinweis, der erklärt,
 *    dass die Aufgabe bei verpasster Deadline automatisch gelöscht wird (separates Text-Element, nicht
 *    nur das Checkbox-Label).
 *  - Beim Anlegen/Bearbeiten fließt `autoDeleteAfterDeadline: boolean` ins Create-/Update-Payload.
 *
 * Der KoliBri-Mock rendert `KolInputCheckbox` als echtes `<input type="checkbox">` mit
 * `aria-label={_label}` — die Checkbox ist also per `getByLabelText` assertionsfähig. Das Label steht
 * als aria-label (kein Text-Knoten), daher greift `getByText` für den Info-Hinweis ausschließlich auf
 * den dedizierten Hinweis und nicht auf die Checkbox-Beschriftung.
 *
 * Diese Specs sind rot, solange TaskForm die Checkbox, den Hinweis und das Payload-Feld nicht führt.
 */
describe('TaskForm — Automatisches Löschen bei verpasster Deadline (#523)', () => {
	it('AK5 — zeigt im Task-Anlegen-Modus eine Checkbox „Automatisch löschen nach 3 Tagen …"', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// rot, solange TaskForm die Auto-Delete-Checkbox (im Task-Modus) noch nicht rendert.
		expect(screen.getByLabelText(/Automatisch löschen nach 3 Tagen bei verpasster Deadline/i)).toBeInTheDocument();
	});

	/* #534 — Test-Pflege-Bedarf (siehe PR-Body): Die beiden folgenden #523-Tests haben den
	   Auto-Löschen-Schalter OHNE gesetzte Deadline angeklickt. Das widerspricht dem neuen #534-Vertrag
	   (AK1: Schalter ohne Deadline disabled; Schalter kann nur true werden, wenn eine Deadline gesetzt ist):
	   - alter AK6 („Hint erscheint nach Aktivieren") und alter AK1 („autoDeleteAfterDeadline im Create-
	     Payload") wären nach der Kopplung nicht mehr anwählbar bzw. true schaltbar.
	   Die Payload-Aussage wird korrekt (MIT Deadline) im #534-Block AK2 neu geprüft; der Hinweis ist
	   ein reines #523-Frontend-Detail und nicht Gegenstand von #534. */
});

/**
 * Rote Spec-Tests für #534, Anforderung 2 — „Schalter an Deadline koppeln" (Task-Modus).
 *
 *  - AK1: Ohne Deadline ist der Auto-Löschen-Schalter `disabled` (und lässt sich nicht auf `true` schalten).
 *  - AK2: Mit gesetzter Deadline ist der Schalter `enabled` und darf `true` werden.
 *  - AK3: Wird die Deadline nachträglich entfernt, wird der Schalter `disabled` UND sein Wert auf `false`
 *    zurückgesetzt (kein hängendes `true` ohne Deadline).
 *
 * **Treiber-/Guard-Rolle:** AK1 und AK3 sind ROT (Treiber) — die aktuelle #523-Checkbox ist unbedingt
 * `enabled` und wird beim Entfernen der Deadline nicht zurückgesetzt. AK2 ist der positive Gegenpart
 * (Guard) und heute schon erfüllt; er sichert den positiven Pfad, sobald die Kopplung aus AK1/AK3 die
 * Checkbox `disabled` schaltet. (Vorbild: #530-Commit mit ROT-Treibern + Regression-Guards.)
 */
describe('TaskForm — Auto-Löschen-Schalter an Deadline gekoppelt (#534, Anforderung 2)', () => {
	/** Setzt (oder leert) das Deadline-Datum im Task-Modus. Leerer String entfernt die Deadline. */
	const setDeadline = async (value: string): Promise<void> => {
		const deadlineInput = screen.getByLabelText('Deadline (optional)');
		await act(async () => {
			fireEvent.change(deadlineInput, { target: { value } });
		});
	};

	const autoDeleteToggle = (): HTMLElement => screen.getByLabelText(/Automatisch löschen nach 3 Tagen/i);

	it('AK1 — ohne Deadline ist der Auto-Löschen-Schalter disabled (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// rot, solange die Checkbox nicht an die Deadline-Präsenz gekoppelt (disabled) ist.
		expect(autoDeleteToggle()).toBeDisabled();
	});

	it('AK1b — ohne Deadline lässt sich der Schalter nicht auf true schalten (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// Selbst ein Klick darf den Schalter ohne Deadline nicht aktivieren (Treiber für die Kopplung).
		const toggle = autoDeleteToggle();
		await act(async () => {
			fireEvent.click(toggle);
		});

		expect(toggle).not.toBeChecked();
	});

	it('AK2 — mit gesetzter Deadline ist der Schalter enabled und darf true werden (Guard)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateTask.mockResolvedValue(minimalNewTask());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await setDeadline('2026-09-07');

		// Mit gültiger Deadline ist der Schalter frei anwählbar …
		expect(autoDeleteToggle()).toBeEnabled();

		const toggle = autoDeleteToggle();
		await act(async () => {
			fireEvent.click(toggle);
		});
		// … und bleibt nach dem Aktivieren `true` (kehrt nicht von selbst zurück).
		expect(toggle).toBeChecked();

		await fillTitle('Aufgabe mit Deadline und Auto-Delete');
		await clickSave();

		// Der aktivierte Schalter fließt korrekt ins Create-Payload (ersetzt den entfernten #523-AK1-Test,
		// der dies ohne Deadline geprüft hatte — was #534 AK1 nun verbietet).
		expect(mockCreateTask).toHaveBeenCalledTimes(1);
		const [{ taskCreate }] = mockCreateTask.mock.calls[0] as [{ taskCreate: Record<string, unknown> }];
		expect(taskCreate).toHaveProperty('autoDeleteAfterDeadline', true);
	});

	it('AK3 — Deadline nachträglich entfernt → Schalter disabled UND Wert auf false zurückgesetzt (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateTask.mockResolvedValue(minimalNewTask());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// Erst Deadline setzen und den Schalter aktivieren (positiver Pfad wie AK2).
		await setDeadline('2026-09-07');
		const toggle = autoDeleteToggle();
		await act(async () => {
			fireEvent.click(toggle);
		});
		expect(toggle).toBeChecked();

		// Anschließend die Deadline entfernen — Schalter muss disabled werden …
		await setDeadline('');
		expect(toggle).toBeDisabled();
		// … und sein Wert auf false zurückgesetzt sein (kein hängendes true ohne Deadline).
		expect(toggle).not.toBeChecked();

		await fillTitle('Aufgabe: Deadline wieder entfernt');
		await clickSave();

		// Im Payload darf kein hängendes autoDeleteAfterDeadline:true landen.
		expect(mockCreateTask).toHaveBeenCalledTimes(1);
		const [{ taskCreate }] = mockCreateTask.mock.calls[0] as [{ taskCreate: Record<string, unknown> }];
		expect(taskCreate).toHaveProperty('autoDeleteAfterDeadline', false);
	});
});

/**
 * Rote Spec-Tests für #534, Anforderung 1 — „Auto-Löschen auch für Serien-Aufgaben".
 *
 * Bei Serien ist stets ein Startdatum gesetzt, daher soll der Auto-Löschen-Schalter frei an- oder
 * abwählbar sein (unabhängig von einer expliziten Deadline) und in den Series-Payloads
 * (`createSeries`/`updateSeries`) als `autoDeleteAfterDeadline` landen.
 *
 * Diese Specs sind ROT, solange TaskForm im Serie-Modus den Auto-Löschen-Schalter weder rendert noch
 * initialisiert noch ins Series-Payload schreibt — die #523-Checkbox steht ausschließlich im Task-Modus.
 */
describe('TaskForm — Auto-Löschen für Serien verfügbar (#534, Anforderung 1)', () => {
	const autoDeleteToggle = (): HTMLElement => screen.getByLabelText(/Automatisch löschen nach 3 Tagen/i);

	it('AK4a — Serie-Modus rendert den Auto-Löschen-Schalter (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();

		// rot, solange der Schalter im Serie-Modus nicht gerendert wird (aktuell nur im Task-Modus).
		expect(autoDeleteToggle()).toBeInTheDocument();
	});

	it('AK4b — Serie-Modus: Schalter frei anwählbar, nicht an eine Deadline gekoppelt (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();

		// Bei Serien ist stets ein Startdatum gesetzt → Schalter stets enabled (ungeachtet einer Deadline).
		const toggle = autoDeleteToggle();
		expect(toggle).toBeEnabled();

		await act(async () => {
			fireEvent.click(toggle);
		});
		expect(toggle).toBeChecked();
	});

	it('AK4c — Serie-Anlegen: aktiver Schalter landet als autoDeleteAfterDeadline im createSeries-Payload (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await switchToSeriesMode();
		await fillTitle('Serien-Aufgabe mit Auto-Delete');

		await act(async () => {
			fireEvent.click(autoDeleteToggle());
		});
		await clickSave();

		// rot, solange das Series-Payload autoDeleteAfterDeadline nicht enthält.
		expect(mockCreateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesCreate }] = mockCreateSeries.mock.calls[0] as [{ seriesCreate: Record<string, unknown> }];
		expect(seriesCreate).toHaveProperty('autoDeleteAfterDeadline', true);
	});

	it('AK4d — Serien-Edit: Schalter wird aus series.autoDeleteAfterDeadline vorbelegt (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(
				<SeriesEditForm task={null} series={{ ...minimalSeries(), autoDeleteAfterDeadline: true }} {...defaultProps} />,
			);
		});

		// rot, solange der Serien-Edit-Modus autoDelete nicht aus series lädt (derzeit nur aus task).
		expect(autoDeleteToggle()).toBeChecked();
	});

	it('AK4e — Serien-Edit: Wert fließt als autoDeleteAfterDeadline ins updateSeries-Payload (ROT, Treiber)', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockUpdateSeries.mockResolvedValue({ ...minimalSeries(), autoDeleteAfterDeadline: true });

		await act(async () => {
			render(
				<SeriesEditForm task={null} series={{ ...minimalSeries(), autoDeleteAfterDeadline: true }} {...defaultProps} />,
			);
		});

		await clickSaveEdit();

		// rot, solange das Series-Update-Payload autoDeleteAfterDeadline nicht enthält.
		expect(mockUpdateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesUpdate }] = mockUpdateSeries.mock.calls[0] as [{ seriesUpdate: Record<string, unknown> }];
		expect(seriesUpdate).toHaveProperty('autoDeleteAfterDeadline', true);
	});
});

/**
 * Roter TDD-Vertrag für #531 (Frontend) — abhakbare Checkliste im TaskForm (Task-Modus).
 *
 * **Erwartete (noch nicht existierende) Schnittstelle** im Task-Modus:
 *  - Ein Abschnitt `data-testid="checklist-section"` (deckt AK6/T12: Modal/Form enthält Checklist-Section).
 *  - Ein Text-Eingabefeld (Label „Checklisten-Eintrag") + Button „Hinzufügen": legt einen neuen Eintrag
 *    an (generierte UUID, `completed = false`).
 *  - Jeder Eintrag in einer Zeile `data-testid="checklist-item"` mit einer Checkbox (Toggle `completed`,
 *    Label „Erledigt") und einem Button „Entfernen" (löscht den Eintrag).
 *  - Beim Anlegen/Bearbeiten fließt `checklist` (Array aus `{ id, title, completed }`) ins Payload.
 *
 * Die KoliBri-Mocks rendern KolInputText/KolInputCheckbox/KolButton als native Elemente mit aria-label
 * → per getByLabelText/getByRole assertionsfähig. Specs sind rot, solange TaskForm die Checklist-UI und
 * das Payload-Feld nicht führt.
 */
describe('TaskForm — Checklisten-Feld (#531)', () => {
	/** Legt im gerenderten Formular einen Checklisten-Eintrag an (Eingabe + „Hinzufügen"). */
	const addItem = async (title: string): Promise<void> => {
		const addInput = screen.getByLabelText(/Checklisten-Eintrag/i);
		await act(async () => {
			fireEvent.change(addInput, { target: { value: title } });
		});
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
		});
	};

	it('AK6/T12: Task-Anlegen-Modus rendert eine Checklist-Section', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		expect(screen.getByTestId('checklist-section')).toBeInTheDocument();
	});

	it('AK6/T8: „Hinzufügen" erzeugt eine checklist-item-Zeile mit dem Titel', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await addItem('Deployment vorbereiten');

		expect(screen.getByTestId('checklist-item')).toBeInTheDocument();
		expect(screen.getByText('Deployment vorbereiten')).toBeInTheDocument();
	});

	it('AK6/T8: „Entfernen" nimmt den Eintrag aus dem DOM', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await addItem('Weg damit');
		expect(screen.getByTestId('checklist-item')).toBeInTheDocument();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }));
		});
		expect(screen.queryByTestId('checklist-item')).toBeNull();
	});

	it('AK6/T9: Toggle completed — Checkbox schaltet den Eintrag auf erledigt', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		await addItem('Abhaken');
		const toggle = screen.getByRole('switch', { name: /Erledigt/i }) as HTMLInputElement;
		expect(toggle.checked).toBe(false);

		await act(async () => {
			fireEvent.click(toggle);
		});
		expect(toggle.checked).toBe(true);
	});

	it('AK6/T10: Submit sendet checklist (id, title, completed) im Create-Payload', async () => {
		mockSuggestPillars.mockResolvedValue([]);
		mockCreateTask.mockResolvedValue(minimalNewTask());
		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});
		await fillTitle('Aufgabe mit Liste');
		await addItem('Schritt 1');
		await clickSave();

		expect(mockCreateTask).toHaveBeenCalledTimes(1);
		const [{ taskCreate }] = mockCreateTask.mock.calls[0] as [
			{ taskCreate: { checklist?: Array<{ id: unknown; title: string; completed: boolean }> } },
		];
		expect(taskCreate.checklist).toBeDefined();
		expect(taskCreate.checklist).toHaveLength(1);
		expect(typeof taskCreate.checklist![0].id).toBe('string');
		expect(taskCreate.checklist![0].title).toBe('Schritt 1');
		expect(taskCreate.checklist![0].completed).toBe(false);
	});
});

/**
 * Rote Spec-Tests für #546 — „Automatisch löschen"-Checkbox auf KolInputCheckbox + KolAlert umstellen.
 *
 * **Ist (rot):** Der Auto-Löschen-Schalter ist eine native `<input type="checkbox">` (role="checkbox"),
 * der Hinweis im aktivierten Zustand ein natives `<p className="hint">`. Beides soll auf KoliBri wechseln:
 *  - AK1+AK3: In allen 4 Formularen (Aufgabe anlegen/bearbeiten, Serie anlegen/bearbeiten) rendert der
 *    Schalter als `KolInputCheckbox`. Der KoliBri-Mock gibt jedem KolInputCheckbox pauschal
 *    `role="switch"` + `aria-label`, eine native Checkbox behält `role="checkbox"` — der Rollen-Wechsel
 *    ist damit assertionsfähig (switch vorhanden, native checkbox verschwunden).
 *  - AK2: Der Hinweis im aktivierten Zustand wird als `KolAlert` (Mock → `role="alert"`) dargestellt,
 *    nicht mehr als `<p>`.
 *  - AK4 (Verhalten erhalten: Wertbindung, Deadline-Kopplung/Pflichtfeld-Logik) ist durch die
 *    bestehenden #523/#534-Tests abgedeckt und wird hier NICHT dupliziert (siehe Test-Pflege-Bedarf
 *    im PR-Body: KolInputCheckbox-Mock muss `_disabled` durchreichen, `switchToSeriesMode` muss auf
 *    `mode-switch` eingeschränkt werden).
 *
 * **Test-Pflege-Bedarf (Folge der AK1-Umsetzung, hier nur dokumentiert, nicht vorgenommen):**
 *  - Sobald der Schalter in den Anlege-Modi ein zweites `role="switch"` neben dem Modus-Umschalter
 *    (#316) ist, wird der unscoped `getByRole('switch')`-Helfer `switchToSeriesMode` (oben) mehrdeutig.
 *  - Der KolInputCheckbox-Mock (oben) leitet `_disabled` nicht durch; die #534-Deadline-Kopplung
 *    (`toBeDisabled()` in AK1/AK3) benötigt das nach dem Wechsel.
 */
describe('TaskForm — Auto-Löschen auf KolInputCheckbox + KolAlert (#546)', () => {
	/** Findet den Auto-Löschen-Schalter als KolInputCheckbox (Mock → role=switch mit aria-label). */
	const autoDeleteSwitch = (): HTMLElement => screen.getByRole('switch', { name: /Automatisch löschen nach 3 Tagen/i });

	/** Eine native Auto-Löschen-Checkbox (role=checkbox) darf nach AK1 nicht mehr existieren. */
	const nativeAutoDeleteCheckbox = (): HTMLElement | null =>
		screen.queryByRole('checkbox', { name: /Automatisch löschen nach 3 Tagen/i });

	it('AK1/AK3 — Aufgabe anlegen: Schalter ist KolInputCheckbox (role=switch), keine native Checkbox', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// rot, solange der Schalter eine native Checkbox (role=checkbox) statt KolInputCheckbox ist.
		expect(autoDeleteSwitch()).toBeInTheDocument();
		expect(nativeAutoDeleteCheckbox()).toBeNull();
	});

	it('AK1/AK3 — Aufgabe bearbeiten: Schalter ist KolInputCheckbox', async () => {
		await act(async () => {
			render(<TaskForm task={minimalNewTask()} {...defaultProps} />);
		});

		expect(autoDeleteSwitch()).toBeInTheDocument();
		expect(nativeAutoDeleteCheckbox()).toBeNull();
	});

	it('AK1/AK3 — Serie anlegen: Schalter ist KolInputCheckbox', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		// initialMode="series" startet direkt im Serie-Anlege-Modus (ohne switchToSeriesMode, das nach
		// AK1 wegen des zweiten Switch mehrdeutig würde — siehe Test-Pflege-Bedarf).
		await act(async () => {
			render(<TaskForm task={null} initialMode="series" {...defaultProps} />);
		});

		expect(autoDeleteSwitch()).toBeInTheDocument();
		expect(nativeAutoDeleteCheckbox()).toBeNull();
	});

	it('AK1/AK3 — Serie bearbeiten: Schalter ist KolInputCheckbox', async () => {
		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		expect(autoDeleteSwitch()).toBeInTheDocument();
		expect(nativeAutoDeleteCheckbox()).toBeNull();
	});

	it('AK2 — Hinweis im aktivierten Zustand wird als KolAlert (role=alert) dargestellt', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(<TaskForm task={null} {...defaultProps} />);
		});

		// Ohne Deadline ist der Schalter disabled (#534) → erst Deadline setzen, dann aktivieren.
		const deadlineInput = screen.getByLabelText('Deadline (optional)');
		await act(async () => {
			fireEvent.change(deadlineInput, { target: { value: '2026-09-07' } });
		});
		await act(async () => {
			fireEvent.click(screen.getByLabelText(/Automatisch löschen nach 3 Tagen/i));
		});

		// rot, solange der Hinweis ein <p className="hint"> statt eines KolAlert (role=alert) ist.
		const hint = screen.getByText(/bei verpasster Deadline automatisch nach 3 Tagen gelöscht/i);
		expect(hint.closest('[role="alert"]'), 'Hinweis ist kein KolAlert').not.toBeNull();
	});
});

/**
 * Rote Spec-Tests für #553 — Serien-Kaskade beim Bearbeiten (Frontend).
 *
 * Beim Speichern der Series-Form mit GEÄNDERTEN kaskadierbaren Feldern blendet TaskForm ein
 * neues Bestätigungs-Modal (`ConfirmSeriesActionModal`) ein, das nur über die Kaskade
 * entscheidet: „Änderungen auf alle N Instanzen übernehmen?" mit Ja-/Nein-Buttons
 * (Default = Nein = nur Serie). Die Wahl steuert das `applyToInstances`-Flag im
 * `updateSeries`-Payload (Ja → true, Nein → false). Ohne geändertes kaskadierbares Feld
 * erscheint kein Modal (normales Speichern).
 *
 * Der Mock für `./ConfirmSeriesActionModal` (oben) bildet die erwartete Schnittstelle
 * `onConfirm(cascade: boolean)` ab und exponiert Ja-/Nein-Buttons. Specs sind rot, solange
 * TaskForm das Modal beim Serien-Edit-Speichern nicht einblendet bzw. kein `applyToInstances`
 * an `updateSeries` übergibt.
 */
describe('TaskForm — Serien-Kaskade-Bestätigung beim Bearbeiten (#553)', () => {
	it('AK1/AK6 — bei geändertem kaskadierbaren Feld erscheint das Ja/Nein-Kaskade-Modal', async () => {
		mockUpdateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		// Titel (kaskadierbares Feld) ändern und speichern → Bestätigungs-Modal erscheint.
		await fillTitle('Geänderter Serientitel');
		await clickSaveEdit();

		// rot, solange TaskForm das Kaskade-Modal beim Speichern nicht einblendet.
		expect(screen.getByTestId('confirm-series-modal')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Ja' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Nein' })).toBeInTheDocument();
	});

	it('AK2 — "Ja" im Modal → updateSeries mit applyToInstances: true (auf alle Instanzen)', async () => {
		mockUpdateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});
		await fillTitle('Geänderter Serientitel');
		await clickSaveEdit();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Ja' }));
		});

		expect(mockUpdateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesUpdate }] = mockUpdateSeries.mock.calls[0] as [{ seriesUpdate: Record<string, unknown> }];
		expect(seriesUpdate).toHaveProperty('applyToInstances', true);
	});

	it('AK1/AK6 — "Nein" im Modal → updateSeries mit applyToInstances: false (nur Serie, sicherer Default)', async () => {
		mockUpdateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});
		await fillTitle('Geänderter Serientitel');
		await clickSaveEdit();

		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Nein' }));
		});

		expect(mockUpdateSeries).toHaveBeenCalledTimes(1);
		const [{ seriesUpdate }] = mockUpdateSeries.mock.calls[0] as [{ seriesUpdate: Record<string, unknown> }];
		expect(seriesUpdate).toHaveProperty('applyToInstances', false);
	});

	it('AK6 — ohne geändertes kaskadierbares Feld erscheint kein Kaskade-Modal (Guard)', async () => {
		mockUpdateSeries.mockResolvedValue(minimalSeries());

		await act(async () => {
			render(<SeriesEditForm task={null} series={minimalSeries()} {...defaultProps} />);
		});

		// Keine Feldänderung → Speichern ohne Kaskade-Modal (normale Template-Aktualisierung).
		await clickSaveEdit();

		expect(screen.queryByTestId('confirm-series-modal')).toBeNull();
	});
});
