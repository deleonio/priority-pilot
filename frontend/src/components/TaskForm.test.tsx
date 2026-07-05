import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Pillar, Task } from 'client';
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
		_on,
	}: {
		_label?: string;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => <button onClick={(e) => _on?.onClick?.(e.nativeEvent)}>{_label}</button>,
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
	KolInputDate: ({ _label }: { _label?: string }) => <input type="date" aria-label={_label} />,
	KolInputRange: ({ _label }: { _label?: string }) => (
		<input type="range" aria-label={_label} />
	),
	KolSingleSelect: ({ _label }: { _label?: string }) => <select aria-label={_label} />,
	KolSpin: () => <span aria-busy="true" />,
	KolTextarea: ({ _label }: { _label?: string }) => <textarea aria-label={_label} />,
}));

// VoiceField: kapselt SpeechRecognition, für diesen Test nicht relevant.
vi.mock('./VoiceField', () => ({
	VoiceField: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// API-Mock: suggestPillars ist der einzige hier relevante Endpoint.
vi.mock('../api', () => ({
	api: {
		suggestPillars: vi.fn(),
	},
}));

import { api } from '../api';
import { TaskForm } from './TaskForm';

const mockSuggestPillars = api.suggestPillars as ReturnType<typeof vi.fn>;

// --- Fixtures ---

const pillarKoerper: Pillar = { id: 1, name: 'Körper', description: 'Gesundheit', weight: 100 };

const minimalNewTask = (): Task => ({
	id: 1,
	title: 'Vorhandener Task',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 0.5,
	pillars: [],
});

const defaultProps = {
	pillars: [pillarKoerper],
	onClose: vi.fn(),
	onSaved: vi.fn(),
};

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

// --- Tests ---

describe('TaskForm — Auto-Trigger „Säulen vorschlagen" (#305)', () => {
	it('AK1 — löst suggestPillars genau einmal aus, wenn neuer Task mit vorbelegtem Titel gemountet wird', async () => {
		mockSuggestPillars.mockResolvedValue([]);

		await act(async () => {
			render(
				<TaskForm
					task={null}
					initialValues={{ title: 'Steuererklärung 2025' }}
					{...defaultProps}
				/>,
			);
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
			rerender(
				<TaskForm task={null} initialValues={{ title: 'Wiederholungstest' }} {...defaultProps} />,
			);
		});

		expect(mockSuggestPillars).toHaveBeenCalledTimes(1);
	});

	it('AK6 — vorgeschlagene Säulen erscheinen als editierbare Beitragszeilen nach dem Auto-Trigger', async () => {
		// Mock liefert einen Vorschlag für Säule 1 (Körper) mit hoher Konfidenz.
		mockSuggestPillars.mockResolvedValue([{ pillarId: 1, confidence: 80 }]);

		await act(async () => {
			render(
				<TaskForm task={null} initialValues={{ title: 'Karriere planen' }} {...defaultProps} />,
			);
		});

		// Nach dem Auto-Trigger soll mindestens eine pillar-row im DOM erscheinen
		// (genau wie nach dem manuellen Klick auf „Säulen vorschlagen").
		const pillarRows = document.querySelectorAll('.pillar-row');
		expect(pillarRows.length).toBeGreaterThan(0);
	});
});
