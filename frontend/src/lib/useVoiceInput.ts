import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceInputOptions {
	onTranscript: (text: string) => void;
	lang?: string;
}

interface UseVoiceInputResult {
	isRecording: boolean;
	startRecording: () => void;
	stopRecording: () => void;
	isSupported: boolean;
	voiceError: string | null;
}

interface SpeechRecognitionResult {
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
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	const isSupported = getSpeechConstructor() !== null;

	const startRecording = useCallback(() => {
		setVoiceError(null);
		if (recognitionRef.current !== null) return;
		const Constructor = getSpeechConstructor();
		if (Constructor === null) return;

		// Laufende Aufnahme eines anderen Feldes zuerst beenden (Guard, s. o.).
		stopActiveRecording?.();

		const recognition = new Constructor();
		recognition.lang = lang;
		recognition.continuous = false;
		recognition.interimResults = false;

		recognition.onresult = (event: SpeechRecognitionEvent) => {
			const result = event.results[event.resultIndex];
			const transcript = result[0].transcript;
			if (transcript) {
				onTranscriptRef.current(transcript);
			}
		};

		recognition.onend = () => {
			if (recognitionRef.current === recognition) {
				recognitionRef.current = null;
				setIsRecording(false);
			}
		};

		recognition.onerror = (event: unknown) => {
			const err = event as { error?: string };
			if (recognitionRef.current === recognition) {
				recognitionRef.current = null;
				setIsRecording(false);
			}
			setVoiceError(
				err?.error === 'not-allowed' ? 'Mikrofon-Zugriff wurde verweigert.' : 'Spracherkennung fehlgeschlagen.',
			);
		};

		recognitionRef.current = recognition;
		recognition.start();
		setIsRecording(true);
		stopActiveRecording = () => {
			// Nur wenn DIESE Aufnahme noch aktiv ist — sonst ist der Eintrag veraltet und ein No-op.
			if (recognitionRef.current === recognition) {
				recognitionRef.current = null;
				setIsRecording(false);
				recognition.abort();
			}
		};
	}, [lang]);

	const stopRecording = useCallback(() => {
		recognitionRef.current?.stop();
		recognitionRef.current = null;
		setIsRecording(false);
	}, []);

	useEffect(() => {
		return () => {
			recognitionRef.current?.abort();
			// Ref leeren, damit ein noch registrierter Guard-Eintrag dieser Instanz zum No-op wird.
			recognitionRef.current = null;
		};
	}, []);

	return { isRecording, startRecording, stopRecording, isSupported, voiceError };
};
