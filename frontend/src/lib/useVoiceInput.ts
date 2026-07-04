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

export const useVoiceInput = ({ onTranscript, lang = 'de-DE' }: UseVoiceInputOptions): UseVoiceInputResult => {
	const [isRecording, setIsRecording] = useState(false);
	const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	const isSupported = getSpeechConstructor() !== null;

	const startRecording = useCallback(() => {
		if (recognitionRef.current !== null) return;
		const Constructor = getSpeechConstructor();
		if (Constructor === null) return;

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
			recognitionRef.current = null;
			setIsRecording(false);
		};

		recognitionRef.current = recognition;
		recognition.start();
		setIsRecording(true);
	}, [lang]);

	const stopRecording = useCallback(() => {
		recognitionRef.current?.stop();
		recognitionRef.current = null;
		setIsRecording(false);
	}, []);

	useEffect(() => {
		return () => {
			recognitionRef.current?.abort();
		};
	}, []);

	return { isRecording, startRecording, stopRecording, isSupported };
};
