import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceInput } from './useVoiceInput';

/**
 * Rote Spec-Tests für #251 — „Audiotranskription für die Task-Erstellung" (Weg A: Browser Web Speech API).
 *
 * Vertrag des noch fehlenden Hooks `useVoiceInput` (`frontend/src/lib/useVoiceInput.ts`):
 *
 *   interface UseVoiceInputOptions { onTranscript: (text: string) => void }
 *   interface UseVoiceInputResult {
 *     isRecording: boolean;
 *     startRecording: () => void;
 *     stopRecording: () => void;
 *     isSupported: boolean;
 *   }
 *   export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputResult
 *
 * Der Hook kapselt die Browser-`SpeechRecognition`-API (mit `webkitSpeechRecognition` als Fallback):
 *  - `isSupported` spiegelt, ob eine der beiden Konstruktoren am `window` existiert,
 *  - `startRecording()` startet die Erkennung und setzt `isRecording=true`,
 *  - `stopRecording()` beendet sie und setzt `isRecording=false`,
 *  - ein `onresult`-Event reicht den erkannten Text an `onTranscript` durch,
 *  - beim Unmount während einer laufenden Aufnahme wird `abort()` zur Aufräumung gerufen.
 *
 * Bis der Hook existiert, schlägt bereits der Import (`./useVoiceInput`) fehl — die Spec ist rot,
 * aber syntaktisch/typseitig gültig und wird grün, sobald die Implementierung folgt.
 *
 * Die `SpeechRecognition`-API wird über eine `MockSpeechRecognition`-Klasse mit `vi.fn()`-Methoden
 * gemockt, damit die Tests ohne echte Browser-Spracherkennung deterministisch laufen (jsdom).
 */

/** Minimaler Ergebnis-Event-Shape, wie ihn die Web Speech API an `onresult` reicht. */
interface MockSpeechRecognitionEvent {
	results: { 0: { 0: { transcript: string } }; length: number };
	resultIndex: number;
}

/** Baut einen `SpeechRecognitionEvent`-ähnlichen Payload für einen einzelnen Transkript-Text. */
const buildResultEvent = (transcript: string): MockSpeechRecognitionEvent => ({
	results: { 0: { 0: { transcript } }, length: 1 },
	resultIndex: 0,
});

/**
 * Test-Double für `window.SpeechRecognition`. Die zuletzt erzeugte Instanz wird in
 * `MockSpeechRecognition.instances` festgehalten, damit der Test `onresult`/`onend` feuern und
 * `start`/`stop`/`abort` als `vi.fn()` prüfen kann.
 */
class MockSpeechRecognition {
	static instances: MockSpeechRecognition[] = [];

	lang = '';
	continuous = false;
	interimResults = false;

	onresult: ((event: MockSpeechRecognitionEvent) => void) | null = null;
	onend: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	start = vi.fn();
	stop = vi.fn();
	abort = vi.fn();

	constructor() {
		MockSpeechRecognition.instances.push(this);
	}

	/** Testhilfe: simuliert ein erkanntes Ergebnis (feuert den registrierten `onresult`-Handler). */
	fireResult(transcript: string): void {
		this.onresult?.(buildResultEvent(transcript));
	}
}

type SpeechWindow = typeof globalThis & {
	SpeechRecognition?: unknown;
	webkitSpeechRecognition?: unknown;
};

const speechWindow = window as unknown as SpeechWindow;

describe('useVoiceInput (#251)', () => {
	beforeEach(() => {
		MockSpeechRecognition.instances = [];
		// Standardfall: die Standard-API existiert. Einzelne Tests überschreiben das gezielt.
		speechWindow.SpeechRecognition = MockSpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;
	});

	afterEach(() => {
		delete speechWindow.SpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;
		vi.clearAllMocks();
	});

	it('AK1: isSupported ist true, wenn window.SpeechRecognition existiert', () => {
		speechWindow.SpeechRecognition = MockSpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;

		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		expect(result.current.isSupported).toBe(true);
	});

	it('AK2: isSupported ist false, wenn weder SpeechRecognition noch webkitSpeechRecognition existiert', () => {
		delete speechWindow.SpeechRecognition;
		delete speechWindow.webkitSpeechRecognition;

		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		expect(result.current.isSupported).toBe(false);
	});

	it('AK3: startRecording() setzt isRecording=true und ruft SpeechRecognition.start()', () => {
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		expect(result.current.isRecording).toBe(false);

		act(() => {
			result.current.startRecording();
		});

		expect(result.current.isRecording).toBe(true);
		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();
		expect(instance?.start).toHaveBeenCalledTimes(1);
	});

	it('AK4: stopRecording() setzt isRecording=false und ruft SpeechRecognition.stop()', () => {
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => {
			result.current.startRecording();
		});
		expect(result.current.isRecording).toBe(true);

		act(() => {
			result.current.stopRecording();
		});

		expect(result.current.isRecording).toBe(false);
		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();
		expect(instance?.stop).toHaveBeenCalledTimes(1);
	});

	it('AK5: ein onresult-Event ruft onTranscript mit dem erkannten Text auf', () => {
		const onTranscript = vi.fn();
		const { result } = renderHook(() => useVoiceInput({ onTranscript }));

		act(() => {
			result.current.startRecording();
		});

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();

		act(() => {
			instance?.fireResult('Neue Aufgabe erledigen');
		});

		expect(onTranscript).toHaveBeenCalledTimes(1);
		expect(onTranscript).toHaveBeenCalledWith('Neue Aufgabe erledigen');
	});

	it('AK6: beim Unmount während laufender Aufnahme wird abort() zur Aufräumung gerufen', () => {
		const { result, unmount } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => {
			result.current.startRecording();
		});

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();

		unmount();

		expect(instance?.abort).toHaveBeenCalledTimes(1);
	});

	it('AK7: webkitSpeechRecognition wird als Fallback genutzt, wenn SpeechRecognition fehlt', () => {
		delete speechWindow.SpeechRecognition;
		speechWindow.webkitSpeechRecognition = MockSpeechRecognition;

		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		expect(result.current.isSupported).toBe(true);

		act(() => {
			result.current.startRecording();
		});

		expect(result.current.isRecording).toBe(true);
		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();
		expect(instance?.start).toHaveBeenCalledTimes(1);
	});

	it('AK8: onerror "not-allowed" setzt voiceError auf Mikrofon-Fehlermeldung', () => {
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => {
			result.current.startRecording();
		});

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();

		act(() => {
			instance?.onerror?.({ error: 'not-allowed' });
		});

		expect(result.current.voiceError).toBe('Mikrofon-Zugriff wurde verweigert.');
		expect(result.current.isRecording).toBe(false);
	});

	it('AK9: onerror generisch setzt voiceError auf generische Fehlermeldung', () => {
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => {
			result.current.startRecording();
		});

		const instance = MockSpeechRecognition.instances.at(-1);
		expect(instance).toBeDefined();

		act(() => {
			instance?.onerror?.({ error: 'network' });
		});

		expect(result.current.voiceError).toBe('Spracherkennung fehlgeschlagen.');
		expect(result.current.isRecording).toBe(false);
	});
});
