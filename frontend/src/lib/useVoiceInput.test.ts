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
	results: { 0: { 0: { transcript: string }; isFinal?: boolean }; length: number };
	resultIndex: number;
}

/** Baut einen `SpeechRecognitionEvent`-ähnlichen Payload für einen einzelnen Transkript-Text. */
const buildResultEvent = (transcript: string, isFinal = true): MockSpeechRecognitionEvent => ({
	results: { 0: { 0: { transcript }, isFinal }, length: 1 },
	resultIndex: 0,
});

/**
 * Test-Double für `window.SpeechRecognition`. Die zuletzt erzeugte Instanz wird in
 * `MockSpeechRecognition.instances` festgehalten, damit der Test `onresult`/`onend` feuern und
 * `start`/`stop`/`abort` als `vi.fn()` prüfen kann.
 *
 * Realitätsnah wie die echte API (#283):
 *  - `start()` feuert `onstart` (Lausch-Beginn) — abschaltbar über `autoFireOnStart`, um den
 *    asynchronen Warmup der echten Engine zu modellieren,
 *  - `start()` kann via `startThrows` einen Engine-Konflikt (`InvalidStateError`) simulieren,
 *  - `abort()` feuert wie die echte API erst `onerror('aborted')`, dann `onend`.
 */
class MockSpeechRecognition {
	static instances: MockSpeechRecognition[] = [];
	/** `false` → `onstart` wird NICHT automatisch gefeuert (modelliert den Warmup, #283). */
	static autoFireOnStart = true;
	/** `true` → `start()` wirft (modelliert einen Engine-Konflikt / Doppelstart, #283). */
	static startThrows = false;

	lang = '';
	continuous = false;
	interimResults = false;

	onstart: (() => void) | null = null;
	onresult: ((event: MockSpeechRecognitionEvent) => void) | null = null;
	onend: (() => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	start = vi.fn(() => {
		if (MockSpeechRecognition.startThrows) {
			throw new Error('InvalidStateError');
		}
		if (MockSpeechRecognition.autoFireOnStart) {
			this.onstart?.();
		}
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
		this.onresult?.(buildResultEvent(transcript, isFinal));
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
		MockSpeechRecognition.autoFireOnStart = true;
		MockSpeechRecognition.startThrows = false;
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

	// --- #283: Aufnahme-Lebenslauf härten — kein stiller Ausfall, kein verlorenes Ergebnis ---

	describe('Stabilität der Aufnahme (#283)', () => {
		it('AK1 (#283): onend ohne jedes Ergebnis setzt den Hinweis „Nichts erkannt" statt still zu enden', () => {
			const onTranscript = vi.fn();
			const { result } = renderHook(() => useVoiceInput({ onTranscript }));

			act(() => {
				result.current.startRecording();
			});
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();

			// Die Engine endet (z. B. Stille), OHNE dass je ein onresult kam.
			act(() => {
				instance?.onend?.();
			});

			expect(result.current.isRecording).toBe(false);
			expect(result.current.voiceError).toBe('Nichts erkannt – bitte erneut sprechen.');
			expect(onTranscript).not.toHaveBeenCalled();
		});

		it('AK2 (#283): endet die Engine nach einem Zwischenergebnis ohne Finale, wird das Zwischenergebnis übernommen', () => {
			const onTranscript = vi.fn();
			const { result } = renderHook(() => useVoiceInput({ onTranscript }));

			act(() => {
				result.current.startRecording();
			});
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();

			// Nur ein Zwischenergebnis (isFinal=false) kommt an, dann endet die Engine abrupt.
			act(() => {
				instance?.fireResult('Neue Aufgabe erledigen', false);
			});
			expect(onTranscript).not.toHaveBeenCalled();

			act(() => {
				instance?.onend?.();
			});

			expect(onTranscript).toHaveBeenCalledTimes(1);
			expect(onTranscript).toHaveBeenCalledWith('Neue Aufgabe erledigen');
			expect(result.current.voiceError).toBeNull();
		});

		it('AK3 (#283): nach einem Finale wird ein früheres Zwischenergebnis nicht doppelt geliefert', () => {
			const onTranscript = vi.fn();
			const { result } = renderHook(() => useVoiceInput({ onTranscript }));

			act(() => {
				result.current.startRecording();
			});
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();

			act(() => {
				instance?.fireResult('Neue Auf', false);
				instance?.fireResult('Neue Aufgabe erledigen', true);
				instance?.onend?.();
			});

			expect(onTranscript).toHaveBeenCalledTimes(1);
			expect(onTranscript).toHaveBeenCalledWith('Neue Aufgabe erledigen');
			expect(result.current.voiceError).toBeNull();
		});

		it('AK4 (#283): onerror "no-speech" zeigt den Hinweis statt der generischen Fehlermeldung', () => {
			const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

			act(() => {
				result.current.startRecording();
			});
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();

			act(() => {
				instance?.onerror?.({ error: 'no-speech' });
			});

			expect(result.current.voiceError).toBe('Nichts erkannt – bitte erneut sprechen.');
			expect(result.current.isRecording).toBe(false);
		});

		it('AK5 (#283): ein Guard-Abbruch (Feldwechsel) erzeugt trotz onerror("aborted")/onend keinen Fehler- oder Hinweistext', () => {
			// Zwei Hook-Instanzen wie zwei VoiceFields im selben Formular (Titel + Beschreibung).
			const first = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));
			const second = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

			act(() => {
				first.result.current.startRecording();
			});
			const firstInstance = MockSpeechRecognition.instances.at(-1);
			expect(first.result.current.isRecording).toBe(true);

			// „Last click wins": Start am zweiten Feld bricht das erste ab — der Mock feuert dabei
			// wie die echte API onerror('aborted') + onend am ersten Feld.
			act(() => {
				second.result.current.startRecording();
			});

			expect(firstInstance?.abort).toHaveBeenCalledTimes(1);
			expect(first.result.current.isRecording).toBe(false);
			expect(first.result.current.voiceError).toBeNull();
			expect(second.result.current.isRecording).toBe(true);
		});

		it('AK6 (#283): isRecording wird erst mit onstart true (Warmup) — ein früh eintreffendes Ergebnis geht nicht verloren', () => {
			MockSpeechRecognition.autoFireOnStart = false;
			const onTranscript = vi.fn();
			const { result } = renderHook(() => useVoiceInput({ onTranscript }));

			act(() => {
				result.current.startRecording();
			});
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance?.start).toHaveBeenCalledTimes(1);

			// Vor onstart lauscht die Engine noch nicht — der Zustand darf das nicht vorgaukeln.
			expect(result.current.isRecording).toBe(false);

			// Ein dennoch früh geliefertes Ergebnis wird nicht verworfen.
			act(() => {
				instance?.fireResult('Früh gesprochen');
			});
			expect(onTranscript).toHaveBeenCalledWith('Früh gesprochen');

			act(() => {
				instance?.onstart?.();
			});
			expect(result.current.isRecording).toBe(true);
		});

		it('AK7 (#283): wirft start() (Engine-Konflikt), bleibt der Hook bedienbar statt dauerhaft tot', () => {
			const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

			MockSpeechRecognition.startThrows = true;
			act(() => {
				result.current.startRecording();
			});

			expect(result.current.isRecording).toBe(false);
			expect(result.current.voiceError).toBe('Spracherkennung fehlgeschlagen.');

			// Der nächste Startversuch funktioniert wieder (kein hängender interner Zustand).
			MockSpeechRecognition.startThrows = false;
			act(() => {
				result.current.startRecording();
			});

			expect(result.current.isRecording).toBe(true);
			expect(result.current.voiceError).toBeNull();
		});

		it('AK8 (#283): engine-seitiges "aborted" während aktiver Aufnahme zeigt den Hinweis (kein stiller Ausfall)', () => {
			const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

			act(() => {
				result.current.startRecording();
			});
			const instance = MockSpeechRecognition.instances.at(-1);
			expect(instance).toBeDefined();

			// Kein Guard/Unmount hat die Aufnahme geräumt — die Engine bricht selbst ab.
			act(() => {
				instance?.onerror?.({ error: 'aborted' });
			});

			expect(result.current.isRecording).toBe(false);
			expect(result.current.voiceError).toBe('Nichts erkannt – bitte erneut sprechen.');
		});
	});
});
