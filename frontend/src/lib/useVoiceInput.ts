import { useCallback, useEffect, useRef, useState } from 'react';
import { isNativeChannel } from './platform';

interface UseVoiceInputOptions {
	onTranscript: (text: string) => void;
	lang?: string;
}

interface UseVoiceInputResult {
	isRecording: boolean;
	startRecording: (options?: { auto?: boolean }) => void;
	stopRecording: () => void;
	isSupported: boolean;
	voiceError: string | null;
}

interface SpeechRecognitionResult {
	/** Fehlt das Flag (idealisierte Test-Doubles), gilt das Ergebnis als final. */
	readonly isFinal?: boolean;
	readonly [index: number]: { readonly transcript: string };
}

interface SpeechRecognitionResultList {
	readonly length: number;
	readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onend: (() => void) | null;
	onerror: ((event: unknown) => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = typeof globalThis & {
	SpeechRecognition?: SpeechRecognitionConstructor;
	webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const getSpeechConstructor = (): SpeechRecognitionConstructor | null => {
	const w = window as unknown as SpeechWindow;
	return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

type NativeResult = { text: string } | { error: 'denied' | 'nothing' | 'failed' };

/**
 * Spracheingabe in der Android-App (#1680): Die Web Speech API fehlt im WebView, das Plugin erkennt
 * genau einen Satz und liefert ihn nach dem Ende der Aufnahme. Es wird erst hier nachgeladen, im
 * Web-Bundle steckt es nicht. „No match"/„No speech input" meldet Android, wenn nichts erkannt wurde.
 */
const recognizeNative = async (lang: string): Promise<NativeResult> => {
	const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
	let { speechRecognition } = await SpeechRecognition.checkPermissions();
	if (speechRecognition !== 'granted') {
		({ speechRecognition } = await SpeechRecognition.requestPermissions());
	}
	if (speechRecognition !== 'granted') {
		return { error: 'denied' };
	}
	try {
		const { matches } = await SpeechRecognition.start({
			language: lang,
			maxResults: 1,
			partialResults: false,
			popup: false,
		});
		const text = matches?.[0]?.trim() ?? '';
		return text === '' ? { error: 'nothing' } : { text };
	} catch (reason) {
		return { error: /no (match|speech)/i.test(String(reason)) ? 'nothing' : 'failed' };
	}
};

const stopNative = async (): Promise<void> => {
	const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
	await SpeechRecognition.stop().catch(() => undefined);
};

let nativeRunCounter = 0;

const NATIVE_ERRORS: Record<'denied' | 'nothing' | 'failed', string> = {
	denied: 'Mikrofon-Zugriff wurde verweigert.',
	nothing: 'Nichts erkannt – bitte erneut sprechen.',
	failed: 'Spracherkennung fehlgeschlagen.',
};

// Modulweiter Guard über alle Hook-Instanzen (#264): Der Browser erlaubt nur EINE aktive
// SpeechRecognition — startet Feld B, während Feld A aufnimmt, bräche der Browser A mit
// `error: 'aborted'` ab und A zeigte fälschlich einen Fehler. Stattdessen „last click wins":
// Ein Start beendet zuerst die laufende Aufnahme des anderen Feldes sauber (ohne Fehlertext).
// Die Funktion ist idempotent (prüft, ob ihre Aufnahme noch aktiv ist) und muss deshalb nie
// explizit ausgetragen werden.
let stopActiveRecording: (() => void) | null = null;

export const useVoiceInput = ({ onTranscript, lang = 'de-DE' }: UseVoiceInputOptions): UseVoiceInputResult => {
	const [isRecording, setIsRecording] = useState(false);
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
	// Laufende Aufnahme über das Plugin; die laufende Nummer unterscheidet Aufnahmen, damit ein spätes
	// Ergebnis einer abgebrochenen Aufnahme nichts mehr auslöst.
	const nativeRunRef = useRef<number | null>(null);
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	const isSupported = isNativeChannel() || getSpeechConstructor() !== null;

	const startRecording = useCallback(
		(options?: { auto?: boolean }) => {
			const isAuto = options?.auto === true;
			setVoiceError(null);
			if (isNativeChannel()) {
				if (nativeRunRef.current !== null) return;
				stopActiveRecording?.();
				const run = ++nativeRunCounter;
				nativeRunRef.current = run;
				setIsRecording(true);
				stopActiveRecording = () => {
					if (nativeRunRef.current === run) {
						nativeRunRef.current = null;
						setIsRecording(false);
						void stopNative();
					}
				};
				void recognizeNative(lang).then((result) => {
					if (nativeRunRef.current !== run) return;
					nativeRunRef.current = null;
					setIsRecording(false);
					if ('text' in result) {
						onTranscriptRef.current(result.text);
					} else if (!isAuto) {
						setVoiceError(NATIVE_ERRORS[result.error]);
					}
				});
				return;
			}
			if (recognitionRef.current !== null) return;
			const Constructor = getSpeechConstructor();
			if (Constructor === null) return;

			// Laufende Aufnahme eines anderen Feldes zuerst beenden (Guard, s. o.).
			stopActiveRecording?.();

			const recognition = new Constructor();
			recognition.lang = lang;
			recognition.continuous = false;
			// Zwischenergebnisse mitlesen (#283): endet die Engine vor dem finalen Ergebnis, wäre der
			// bereits erkannte Text sonst verloren — er wird gepuffert und bei onend nachgeliefert.
			recognition.interimResults = true;

			// Lebenslauf DIESER Aufnahme (#283): Kam schon Text beim Aufrufer an, und was ist das letzte
			// Zwischenergebnis? Entscheidet bei onend zwischen Nachliefern und „Nichts erkannt"-Hinweis.
			let delivered = false;
			let interimTranscript = '';

			// Bei automatischem Start (#379): Fehler/Hinweis bei Stille unterdrücken — der Nutzer hat
			// nichts ausgelöst. Nur ein manueller Mic-Klick zeigt Fehler wie bisher.
			const reportError = (msg: string) => {
				if (!isAuto) setVoiceError(msg);
			};

			recognition.onstart = () => {
				// Erst jetzt lauscht die Engine wirklich (#283): Den Aufnahme-Zustand nicht schon während
				// des Warmups signalisieren, sonst spricht der Nutzer ins Leere (Autostart!).
				if (recognitionRef.current === recognition) {
					setIsRecording(true);
				}
			};

			recognition.onresult = (event: SpeechRecognitionEvent) => {
				let finalTranscript = '';
				let interim = '';
				for (let i = event.resultIndex; i < event.results.length; i += 1) {
					const result = event.results[i];
					const transcript = result[0]?.transcript ?? '';
					if (result.isFinal !== false) {
						finalTranscript += transcript;
					} else {
						interim += transcript;
					}
				}
				if (finalTranscript !== '') {
					delivered = true;
					interimTranscript = '';
					onTranscriptRef.current(finalTranscript);
				} else if (interim !== '') {
					interimTranscript = interim;
				}
			};

			recognition.onend = () => {
				// Nur reagieren, solange DIESE Aufnahme noch aktiv ist — nach manuellem Stopp,
				// Guard-Wechsel, Unmount oder onerror ist die Ref bereits geräumt.
				if (recognitionRef.current !== recognition) return;
				recognitionRef.current = null;
				setIsRecording(false);
				if (!delivered && interimTranscript.trim() !== '') {
					// Engine endete vor dem Finale: letztes Zwischenergebnis übernehmen statt verwerfen.
					delivered = true;
					onTranscriptRef.current(interimTranscript);
					return;
				}
				if (!delivered) {
					// Ende ohne jedes Ergebnis nicht still verschlucken (#283) — sonst wirkt der
					// Button „aus" und der Nutzer erfährt nie, dass nichts ankam.
					reportError('Nichts erkannt – bitte erneut sprechen.');
				}
			};

			recognition.onerror = (event: unknown) => {
				const err = event as { error?: string };
				// Absichtliche Abbrüche (Guard-Wechsel, Unmount, manueller Stopp) haben die Ref bereits
				// geräumt — die echte API feuert dabei onerror('aborted'); das ist kein Fehlerfall und
				// darf keinen Fehlertext erzeugen (#283, verdeckt vom früheren idealisierten Mock).
				if (recognitionRef.current !== recognition) return;
				recognitionRef.current = null;
				setIsRecording(false);
				if (err?.error === 'not-allowed') {
					reportError('Mikrofon-Zugriff wurde verweigert.');
				} else if (err?.error === 'no-speech' || err?.error === 'aborted') {
					// Kein Sprach-Input bzw. engine-seitiger Abbruch einer aktiven Aufnahme: dem Nutzer
					// den Wiederholungsweg zeigen statt einer generischen Fehlermeldung.
					reportError('Nichts erkannt – bitte erneut sprechen.');
				} else {
					reportError('Spracherkennung fehlgeschlagen.');
				}
			};

			recognitionRef.current = recognition;
			try {
				recognition.start();
			} catch {
				// Doppelstart-/Engine-Konflikt (InvalidStateError): Zustand nicht hängen lassen (#283) —
				// mit gesetzter Ref wäre der Mic-Button sonst bis zum Neuladen tot.
				recognitionRef.current = null;
				reportError('Spracherkennung fehlgeschlagen.');
				return;
			}
			stopActiveRecording = () => {
				// Nur wenn DIESE Aufnahme noch aktiv ist — sonst ist der Eintrag veraltet und ein No-op.
				if (recognitionRef.current === recognition) {
					recognitionRef.current = null;
					setIsRecording(false);
					recognition.abort();
				}
			};
		},
		[lang],
	);

	const stopRecording = useCallback(() => {
		if (nativeRunRef.current !== null) {
			// Das Plugin liefert den bis hierher erkannten Satz noch über `start` aus.
			void stopNative();
			return;
		}
		recognitionRef.current?.stop();
		recognitionRef.current = null;
		setIsRecording(false);
	}, []);

	useEffect(() => {
		return () => {
			// Ref VOR abort() leeren: die echte API feuert bei abort() noch onerror('aborted') und
			// onend — mit geräumter Ref sind diese Handler No-ops (kein Fehlertext, kein Hinweis).
			// Außerdem wird ein noch registrierter Guard-Eintrag dieser Instanz damit zum No-op.
			const recognition = recognitionRef.current;
			recognitionRef.current = null;
			recognition?.abort();
			if (nativeRunRef.current !== null) {
				nativeRunRef.current = null;
				void stopNative();
			}
		};
	}, []);

	return { isRecording, startRecording, stopRecording, isSupported, voiceError };
};
