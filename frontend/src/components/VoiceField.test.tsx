import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceField } from './VoiceField';
import { PLAN_REQUIRED_EVENT } from '../lib/apiError';
import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';

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

	// --- #379: Auto-Start ohne Spracheingabe zeigt keinen role=alert ---
	//
	// Der obige #283-Test („zeigt nach einem Ende ohne Ergebnis den Hinweis …") deckt zugleich
	// AK6 (#379) ab: MANUELLER Mic-Klick ohne Ergebnis → role=alert bleibt sichtbar (Regression).
	// Ergänzt wird hier AK5: Beim AUTO-Start (autoStart-Prop) darf ein ergebnisloses Ende KEINEN
	// role=alert erzeugen — sonst blinkt bei jedem stillen Formular-Öffnen ein Hinweis auf.
	describe('Auto-Start ohne Spracheingabe (#379)', () => {
		it('AK5 (#379): Auto-Start + onend ohne Ergebnis zeigt keinen role=alert', () => {
			render(
				<VoiceField autoStart variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
					<textarea aria-label="Titel" />
				</VoiceField>,
			);

			// autoStart hat die Aufnahme beim Mount automatisch gestartet.
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();

			// Die automatisch gestartete Aufnahme endet ohne jedes Ergebnis (Stille).
			act(() => {
				instance?.onend?.();
			});

			expect(screen.queryByRole('alert')).not.toBeInTheDocument();
		});

		it('AK6 (#379, Regression): manueller Mic-Klick ohne Ergebnis zeigt weiterhin role=alert', async () => {
			// Ohne autoStart: bewusste Nutzeraktion → Hinweis bleibt erhalten (deckt sich mit dem
			// #283-Test oben, hier als explizite Abgrenzung zum Auto-Start wiederholt).
			render(
				<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()}>
					<textarea aria-label="Titel" />
				</VoiceField>,
			);

			fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' }));

			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();
			act(() => {
				instance?.onend?.();
			});

			const alert = await screen.findByRole('alert');
			expect(alert).toHaveTextContent('Nichts erkannt – bitte erneut sprechen.');
		});
	});
});

// ── #1484 (T3b AK3/AK6): Paket-Badge und Entitlement-Gate der Aufnahme ─────────────────────────

/**
 * AK3: `VoiceField` rendert `<PlanBadge feature="voice_input" />` (Analyse-Block: Grenzstelle
 * VoiceField.tsx). AK6: ohne `voice_input`-Entitlement löst der Mic-Button `startRecording` NICHT
 * aus (auch `autoStart` startet nicht) — stattdessen öffnet ein `pp:plan-required`-Event. Mit
 * Entitlement bleibt das Verhalten aus #264/#283 unverändert (genau 1× `startRecording`). Heute
 * gibt es weder Badge noch Entitlement-Gate — rot (docs/spec/issue-1484.md AK3/AK6).
 */
describe('VoiceField — Paket-Badge und Entitlement-Gate (#1484 AK3/AK6)', () => {
	beforeEach(() => {
		MockSpeechRecognition.instances = [];
		speechWindow.SpeechRecognition = MockSpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;
	});

	afterEach(() => {
		cleanup();
		delete speechWindow.SpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;
		vi.clearAllMocks();
	});

	const renderWithEntitlement = (allowed: boolean, extraProps: Partial<Parameters<typeof VoiceField>[0]> = {}) => {
		const entitlements: EntitlementMap = {
			voice_input: { allowed, requiredPlan: 'pro' } as EntitlementMap['voice_input'],
		};
		return render(
			<PlanProvider value={{ plan: allowed ? 'pro' : 'free', entitlements }}>
				<VoiceField variant="input" fieldLabel="Titel" onTranscript={vi.fn()} {...extraProps}>
					<textarea aria-label="Titel" />
				</VoiceField>
			</PlanProvider>,
		);
	};

	it('zeigt das voice_input-Badge', () => {
		renderWithEntitlement(false);

		expect(screen.getByTestId('plan-badge-voice_input')).toBeInTheDocument();
	});

	it('ohne Entitlement: Klick auf den Mic-Button startet keine Aufnahme, sondern öffnet das Angebot', () => {
		renderWithEntitlement(false);
		const handler = vi.fn();
		window.addEventListener(PLAN_REQUIRED_EVENT, handler);

		fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' }));

		expect(MockSpeechRecognition.instances).toHaveLength(0);
		expect(handler).toHaveBeenCalledTimes(1);
		const event = handler.mock.calls[0][0] as CustomEvent<{ feature: string }>;
		expect(event.detail.feature).toBe('voice_input');
		window.removeEventListener(PLAN_REQUIRED_EVENT, handler);
	});

	it('ohne Entitlement startet auch autoStart keine Aufnahme', () => {
		renderWithEntitlement(false, { autoStart: true });

		expect(MockSpeechRecognition.instances).toHaveLength(0);
	});

	it('mit Entitlement bleibt das bisherige Verhalten: Klick startet genau 1× die Aufnahme', () => {
		renderWithEntitlement(true);

		fireEvent.click(screen.getByRole('button', { name: 'Aufnahme starten (Mikrofon): Titel' }));

		expect(MockSpeechRecognition.instances).toHaveLength(1);
		expect(MockSpeechRecognition.instances[0]?.start).toHaveBeenCalledTimes(1);
	});
});
