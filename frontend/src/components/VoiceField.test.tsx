import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceField } from './VoiceField';

/**
 * Tests für `VoiceField` (#264) — Wrapper, der ein Textfeld um Audiotranskription per
 * Mikrofon-Button ergänzt (Overlay in der Inputbox; Positionierung selbst ist CSS und wird e2e
 * geprüft). Die `SpeechRecognition`-API wird wie in `useVoiceInput.test.ts` durch ein Test-Double
 * am `window` ersetzt; als Children genügt ein natives `<textarea>` (KoliBri im jsdom vermeiden).
 */

/** Minimaler Ergebnis-Event-Shape, wie ihn die Web Speech API an `onresult` reicht. */
interface MockSpeechRecognitionEvent {
	results: { 0: { 0: { transcript: string }; isFinal?: boolean }; length: number };
	resultIndex: number;
}

/**
 * Test-Double für `window.SpeechRecognition`; die zuletzt erzeugte Instanz ist abfragbar.
 * Realitätsnah wie die echte API (#283): `start()` feuert `onstart` (Lausch-Beginn), `abort()`
 * feuert erst `onerror('aborted')`, dann `onend`.
 */
class MockSpeechRecognition {
	static instances: MockSpeechRecognition[] = [];

	lang = '';
	continuous = false;
	interimResults = false;

	onstart: (() => void) | null = null;
	onresult: ((event: MockSpeechRecognitionEvent) => void) | null = null;
	onend: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	start = vi.fn(() => {
		this.onstart?.();
	});
	stop = vi.fn();
	abort = vi.fn(() => {
		this.onerror?.({ error: 'aborted' });
		this.onend?.();
	});

	constructor() {
		MockSpeechRecognition.instances.push(this);
	}

	/** Testhilfe: simuliert ein erkanntes Ergebnis (feuert den registrierten `onresult`-Handler). */
	fireResult(transcript: string, isFinal = true): void {
		this.onresult?.({ results: { 0: { 0: { transcript }, isFinal }, length: 1 }, resultIndex: 0 });
	}
}

type SpeechWindow = typeof globalThis & {
	SpeechRecognition?: unknown;
	webkitSpeechRecognition?: unknown;
};

const speechWindow = window as unknown as SpeechWindow;

describe('VoiceField (#264)', () => {
	beforeEach(() => {
		MockSpeechRecognition.instances = [];
		speechWindow.SpeechRecognition = MockSpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;
	});

	afterEach(() => {
		// Ohne `globals: true` räumt Testing Library das DOM nicht automatisch auf.
		cleanup();
		delete speechWindow.SpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;
		vi.clearAllMocks();
	});

	it('rendert Children und den Mic-Button mit feldbezogenem aria-label', () => {
		render(
			<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
				<textarea aria-label="Titel" />
			</VoiceField>,
		);

		expect(screen.getByLabelText('Titel')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' })).toBeInTheDocument();
	});

	it('rendert ohne SpeechRecognition-Unterstützung die Children, aber keinen Button', () => {
		delete speechWindow.SpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;

		render(
			<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
				<textarea aria-label="Titel" />
			</VoiceField>,
		);

		expect(screen.getByLabelText('Titel')).toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	it('toggelt per Klick aria-pressed und das aria-label (starten ↔ stoppen)', async () => {
		render(
			<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
				<textarea aria-label="Titel" />
			</VoiceField>,
		);

		const button = screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' });
		fireEvent.click(button);

		expect(button).toHaveAttribute('aria-pressed', 'true');
		expect(button).toHaveAccessibleName('Aufnahme stoppen: Titel');

		fireEvent.click(button);

		expect(button).toHaveAttribute('aria-pressed', 'false');
		expect(button).toHaveAccessibleName('Aufnahme starten (Mikrofon): Titel');
	});

	it('reicht ein onresult-Ergebnis als rohen Text an onTranscript durch', async () => {
		const onTranscript = vi.fn();
		render(
			<VoiceField variant="textarea" fieldLabel="Beschreibung" onTranscript={onTranscript}>
				<textarea aria-label="Beschreibung" />
			</VoiceField>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Beschreibung' }));

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();
		act(() => {
			instance?.fireResult('Neue Aufgabe erledigen');
		});

		expect(onTranscript).toHaveBeenCalledTimes(1);
		expect(onTranscript).toHaveBeenCalledWith('Neue Aufgabe erledigen');
	});

	it('zeigt bei onerror "not-allowed" die Mikrofon-Fehlermeldung als role=alert', async () => {
		render(
			<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
				<textarea aria-label="Titel" />
			</VoiceField>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' }));

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();
		act(() => {
			instance?.onerror?.({ error: 'not-allowed' });
		});

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Mikrofon-Zugriff wurde verweigert.');
	});

	it('setzt die Varianten-Klasse am Wrapper (textarea vs. input)', () => {
		const { container, rerender } = render(
			<VoiceField variant="textarea" fieldLabel="Beschreibung" onTranscript={vi.fn()}>
				<textarea aria-label="Beschreibung" />
			</VoiceField>,
		);

		expect(container.querySelector('.voice-field--textarea')).not.toBeNull();

		rerender(
			<VoiceField variant="input" fieldLabel="Beschreibung" onTranscript={vi.fn()}>
				<textarea aria-label="Beschreibung" />
			</VoiceField>,
		);

		expect(container.querySelector('.voice-field--input')).not.toBeNull();
	});

	it('stoppt beim Start eines zweiten Feldes die laufende Aufnahme des ersten — ohne Fehlermeldung', async () => {
		render(
			<>
				<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
					<textarea aria-label="Titel" />
				</VoiceField>
				<VoiceField variant="textarea" fieldLabel="Beschreibung" onTranscript={vi.fn()}>
					<textarea aria-label="Beschreibung" />
				</VoiceField>
			</>,
		);

		const titleButton = screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' });
		fireEvent.click(titleButton);
		expect(titleButton).toHaveAttribute('aria-pressed', 'true');

		fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Beschreibung' }));

		// „Last click wins": Titel-Aufnahme ist beendet, Beschreibung nimmt auf, kein Fehlertext.
		expect(titleButton).toHaveAttribute('aria-pressed', 'false');
		expect(screen.getByRole('button', { name: 'Aufnahme stoppen: Beschreibung' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		expect(screen.queryByRole('alert')).not.toBeInTheDocument();
	});

	it('zeigt nach einem Ende ohne Ergebnis den Hinweis „Nichts erkannt" als role=alert (#283)', async () => {
		render(
			<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
				<textarea aria-label="Titel" />
			</VoiceField>,
		);

		fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' }));

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();
		// Die Engine endet (z. B. Stille), ohne dass je ein Ergebnis kam.
		act(() => {
			instance?.onend?.();
		});

		const alert = await screen.findByRole('alert');
		expect(alert).toHaveTextContent('Nichts erkannt – bitte erneut sprechen.');
		expect(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' })).toHaveAttribute(
			'aria-pressed',
			'false',
		);
	});
});
