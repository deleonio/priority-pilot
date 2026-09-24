import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Spracheingabe in der Android-App (#1680): Im Kanal `play` nimmt der Hook das Speech-Plugin statt
 * der Web Speech API, eine verweigerte Mikrofon-Berechtigung wird sichtbar gemeldet. Plugin gemockt.
 */

const plugin = vi.hoisted(() => ({
	checkPermissions: vi.fn(),
	requestPermissions: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(() => Promise.resolve()),
}));
vi.mock('@capacitor-community/speech-recognition', () => ({ SpeechRecognition: plugin }));

import { useVoiceInput } from './useVoiceInput';

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

describe('useVoiceInput in der Android-App (#1680)', () => {
	it('play: erkennt über das Plugin und liefert den Satz an onTranscript, ohne Web Speech', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		const webSpeech = vi.fn();
		vi.stubGlobal('SpeechRecognition', webSpeech);
		plugin.checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
		plugin.start.mockResolvedValue({ matches: ['Einkaufen morgen'] });
		const onTranscript = vi.fn();
		const { result } = renderHook(() => useVoiceInput({ onTranscript }));

		act(() => result.current.startRecording());

		await waitFor(() => expect(onTranscript).toHaveBeenCalledWith('Einkaufen morgen'));
		expect(plugin.start).toHaveBeenCalledWith(expect.objectContaining({ language: 'de-DE' }));
		expect(webSpeech).not.toHaveBeenCalled();
		expect(result.current.isRecording).toBe(false);
	});

	it('play: verweigerte Mikrofon-Berechtigung zeigt einen Hinweis und startet nichts', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		plugin.checkPermissions.mockResolvedValue({ speechRecognition: 'prompt' });
		plugin.requestPermissions.mockResolvedValue({ speechRecognition: 'denied' });
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => result.current.startRecording());

		await waitFor(() => expect(result.current.voiceError).toBe('Mikrofon-Zugriff wurde verweigert.'));
		expect(plugin.start).not.toHaveBeenCalled();
	});

	it('play: scheiternder Permission-Aufruf meldet Fehler und lässt den Zustand nicht hängen', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		plugin.checkPermissions.mockRejectedValue(new Error('bridge broken'));
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => result.current.startRecording());

		await waitFor(() => expect(result.current.voiceError).toBe('Spracherkennung fehlgeschlagen.'));
		expect(result.current.isRecording).toBe(false);
	});

	it('play: ein zweites Feld beendet die laufende Aufnahme, ihr spätes Ergebnis löst nichts aus (#264)', async () => {
		vi.stubGlobal('__PP_CHANNEL__', 'play');
		plugin.checkPermissions.mockResolvedValue({ speechRecognition: 'granted' });
		let finishFirst: (value: { matches: string[] }) => void = () => undefined;
		plugin.start.mockImplementationOnce(() => new Promise((resolve) => (finishFirst = resolve)));
		const onTranscript = vi.fn();
		const first = renderHook(() => useVoiceInput({ onTranscript }));
		const second = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => first.result.current.startRecording());
		await waitFor(() => expect(plugin.start).toHaveBeenCalledTimes(1));
		act(() => second.result.current.startRecording());

		expect(first.result.current.isRecording).toBe(false);
		await waitFor(() => expect(plugin.stop).toHaveBeenCalled());
		await act(async () => finishFirst({ matches: ['Zu spät'] }));
		expect(onTranscript).not.toHaveBeenCalled();
		expect(first.result.current.voiceError).toBeNull();
	});

	it('web: nutzt weiter die Web Speech API, nicht das Plugin', () => {
		const start = vi.fn();
		vi.stubGlobal(
			'SpeechRecognition',
			class {
				start = start;
				stop = vi.fn();
				abort = vi.fn();
			},
		);
		const { result } = renderHook(() => useVoiceInput({ onTranscript: vi.fn() }));

		act(() => result.current.startRecording());

		expect(start).toHaveBeenCalled();
		expect(plugin.checkPermissions).not.toHaveBeenCalled();
	});
});
