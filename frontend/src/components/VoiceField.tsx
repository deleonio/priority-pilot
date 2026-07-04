import type { ReactNode } from 'react';
import { useVoiceInput } from '../lib/useVoiceInput';

interface VoiceFieldProps {
	/** Positionierungs-Variante: `textarea` → Mic-Button unten rechts, `input` → rechts vertikal mittig. */
	variant: 'textarea' | 'input';
	/** Sichtbares Feld-Label — macht das aria-label des Mic-Buttons bei mehreren Feldern eindeutig. */
	fieldLabel: string;
	/** Erkannter Text (roh); das Zusammenführen mit dem Bestandswert (Anhängen) macht die Call-Site. */
	onTranscript: (text: string) => void;
	children: ReactNode;
}

/**
 * Wrapper, der ein Textfeld um Audiotranskription per Mikrofon-Button ergänzt (#264). Kapselt für
 * alle Call-Sites das `useVoiceInput`-Wiring, den Supported-Check, den Aufnahme-Button und die
 * Fehleranzeige. Der Button liegt als absolut positioniertes Overlay INNERHALB der Inputbox
 * (Textarea: unten rechts, einzeiliger Input: rechts vertikal mittig — CSS `.voice-field`).
 *
 * KoliBri-Felder sind Shadow-DOM-Komponenten: Der Button kann nicht im Shadow Root liegen und ein
 * Innen-Padding des nativen Inputs ist ohne eigenes Theme nicht setzbar — langer Text kann daher
 * unter den Button laufen. Bewusster, akzeptierter Tradeoff des Overlay-Ansatzes.
 */
export const VoiceField = ({ variant, fieldLabel, onTranscript, children }: VoiceFieldProps) => {
	const { isRecording, startRecording, stopRecording, isSupported, voiceError } = useVoiceInput({ onTranscript });

	return (
		<>
			{/* Der Wrapper bleibt auch ohne Browser-Unterstützung stehen, damit das Grid-Layout stabil ist. */}
			<div className={`voice-field voice-field--${variant}`}>
				{children}
				{isSupported && (
					<button
						type="button"
						aria-label={isRecording ? `Aufnahme stoppen: ${fieldLabel}` : `Aufnahme starten (Mikrofon): ${fieldLabel}`}
						aria-pressed={isRecording}
						className={`mic-button${isRecording ? ' mic-button--recording' : ''}`}
						onClick={() => {
							if (isRecording) stopRecording();
							else startRecording();
						}}
					>
						🎤
					</button>
				)}
			</div>
			{voiceError !== null && (
				<p className="mic-error" role="alert">
					{voiceError}
				</p>
			)}
		</>
	);
};
