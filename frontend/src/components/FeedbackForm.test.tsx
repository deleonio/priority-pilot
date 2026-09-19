import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResponseError } from 'client';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * #1465 (D): Das Feedback-Formular zeigt den Grund, den der Server nennt — „nicht konfiguriert"
 * (503) und „konnte gerade nicht gespeichert werden" (502) sind unterscheidbar, statt beide hinter
 * einer Pauschalzeile zu verschwinden. Ein Fehlschlag lässt die Eingaben stehen (#1435 AK9).
 *
 * KoliBri modulweit gemockt (Muster `NearbyCard.test.tsx`): Die Web Components sind in jsdom nicht
 * hochgestuft, Label und Wert wären sonst nicht adressierbar.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert" data-label={_label}>
			{children}
		</div>
	),
	KolSelect: ({ _label }: { _label?: string }) => <div data-comp="select" data-label={_label} />,
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (event: unknown, value: unknown) => void };
	}) => (
		<input aria-label={_label} value={_value ?? ''} onChange={(event) => _on?.onInput?.(event, event.target.value)} />
	),
	KolTextarea: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (event: unknown, value: unknown) => void };
	}) => (
		<textarea
			aria-label={_label}
			value={_value ?? ''}
			onChange={(event) => _on?.onInput?.(event, event.target.value)}
		/>
	),
	KolButton: ({ _label, _on }: { _label?: string; _on?: { onClick?: () => void } }) => (
		<button onClick={() => _on?.onClick?.()}>{_label}</button>
	),
}));

const sendFeedback = vi.fn();

vi.mock('../api', () => ({
	api: {
		sendFeedback: (input: unknown) => sendFeedback(input),
	},
}));

import { FeedbackForm } from './FeedbackForm';

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

/** Fehler, wie ihn `api.sendFeedback` wirft: `ResponseError` mit geparstem `{ message }`-Body. */
const apiError = (status: number, message: string): ResponseError =>
	new ResponseError(new Response(JSON.stringify({ message }), { status }), { message });

/** Füllt Titel und Beschreibung und sendet ab. */
const fillAndSubmit = async (): Promise<void> => {
	await act(async () => {
		fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Login hängt' } });
		fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Nach dem Login lädt nichts mehr.' } });
	});
	await act(async () => {
		screen.getByRole('button', { name: 'Senden' }).click();
	});
};

describe('FeedbackForm — Fehlermeldung nennt den Grund des Servers (#1465)', () => {
	it('503 (Feedback nicht konfiguriert) zeigt den Servertext statt einer Pauschalzeile', async () => {
		sendFeedback.mockRejectedValue(
			apiError(503, 'Feedback ist aktuell nicht konfiguriert. Bitte später erneut versuchen.'),
		);

		render(<FeedbackForm />);
		await fillAndSubmit();

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('Feedback ist aktuell nicht konfiguriert.');
		// Die #620-Übersetzung für LLM-Endpunkte darf hier nicht greifen.
		expect(alert).not.toHaveTextContent('KI-Dienst');
	});

	it('502 (Speichern fehlgeschlagen) zeigt den anderen Servertext', async () => {
		sendFeedback.mockRejectedValue(
			apiError(502, 'Feedback konnte gerade nicht gespeichert werden. Bitte später erneut versuchen.'),
		);

		render(<FeedbackForm />);
		await fillAndSubmit();

		const alert = screen.getByRole('alert');
		expect(alert).toHaveTextContent('Feedback konnte gerade nicht gespeichert werden.');
		expect(alert).not.toHaveTextContent('KI-Dienst');
	});

	it('Erfolg bestätigt und leert Titel und Beschreibung (#1435 AK8, unverändert)', async () => {
		sendFeedback.mockResolvedValue(undefined);

		render(<FeedbackForm />);
		await fillAndSubmit();

		expect(screen.getByRole('alert')).toHaveTextContent('Danke!');
		expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('');
		expect((screen.getByLabelText('Beschreibung') as HTMLTextAreaElement).value).toBe('');
	});
});

describe('FeedbackForm — Intro-Text zur neuen Kategorien-Aufteilung (#1475 AK4)', () => {
	/**
	 * Die drei Kategorien heißen jetzt „Fragen und Hilfe", „Wünsche und Ideen", „Fehler melden".
	 * Der Intro-Text darf die Aufteilung weiter beschreiben, aber nicht mehr die alte
	 * Vierer-Formulierung „Fehler, Wünsche, Ideen oder Fragen" verwenden. „Ideen" allein ist
	 * nicht verboten — es steckt im neuen Label „Wünsche und Ideen".
	 */
	it('nennt Fragen, Wünsche und Fehler — nicht mehr die alte Vierer-Formulierung', () => {
		const { container } = render(<FeedbackForm />);
		const intro = container.querySelector('.feedback-form > p');
		// Test-Pflege (#1475, Impl-Phase): Assertion-Nachricht entfernt — die Vitest-Typisierung
		// von `toBeNull` nimmt kein Argument (tsc-Fehler TS2554), die Nachricht ist rein dekorativ.
		expect(intro).not.toBeNull();
		const text = intro!.textContent ?? '';
		expect(text).not.toMatch(/Fehler, Wünsche, Ideen oder Fragen/);
		expect(text).toMatch(/Fragen/);
		expect(text).toMatch(/Wünsche/);
		expect(text).toMatch(/Fehler/);
	});
});
