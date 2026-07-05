import { useEffect, useRef, type ReactNode } from 'react';
import { useVoiceInput } from '../lib/useVoiceInput';

interface VoiceFieldProps {
	/** Positionierungs-Variante: `textarea` → Mic-Button unten rechts, `input` → rechts vertikal mittig. */
	variant: 'textarea' | 'input';
	/** Sichtbares Feld-Label — macht das aria-label des Mic-Buttons bei mehreren Feldern eindeutig. */
	fieldLabel: string;
	/** Erkannter Text (roh); das Zusammenführen mit dem Bestandswert (Anhängen) macht die Call-Site. */
	onTranscript: (text: string) => void;
	/**
	 * Startet die Aufnahme automatisch **einmal** beim Mounten (#272), sofern der Browser Sprache
	 * unterstützt. Wird von den Call-Sites nur für das erste Feld gesetzt, wenn die Allgemein-
	 * Einstellung „Sprachaufnahme automatisch starten" aktiv ist.
	 */
	autoStart?: boolean;
	/**
	 * Optionaler Hinweistext unterhalb des Feldes (#326). Wird bewusst als Geschwister **außerhalb**
	 * des `.voice-field`-Wrappers gerendert, damit der variabel hohe Hinweis die Höhe des
	 * Positionierungs-Kontextes nicht verändert — sonst ankert der `bottom`-positionierte Mic-Button
	 * am Hint-Unterrand statt an der sichtbaren Inputbox. KoliBris eigenes `_hint` würde den Text
	 * innerhalb des Custom-Elements (also im Wrapper) rendern und genau diesen Fehler auslösen.
	 */
	hint?: string;
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
export const VoiceField = ({
	variant,
	fieldLabel,
	onTranscript,
	autoStart = false,
	hint,
	children,
}: VoiceFieldProps) => {
	const { isRecording, startRecording, stopRecording, isSupported, voiceError } = useVoiceInput({ onTranscript });

	// Auto-Start (#272): beim Mount die Aufnahme starten, sofern unterstützt. Der Cleanup setzt das
	// Ein-Schuss-Flag zurück, damit der StrictMode-Zyklus (setup → cleanup → setup) im Dev-Build die
	// zwischenzeitlich abgebrochene Aufnahme im zweiten Setup erneut startet. Ohne
	// Browser-Unterstützung (`isSupported=false`) ist `startRecording` ein No-op → kein Absturz.
	const autoStarted = useRef(false);
	useEffect(() => {
		if (autoStart && isSupported && !autoStarted.current) {
			autoStarted.current = true;
			startRecording();
		}
		return () => {
			autoStarted.current = false;
		};
	}, [autoStart, isSupported, startRecording]);

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
			{hint !== undefined && hint !== '' && <p className="voice-field-hint">{hint}</p>}
			{voiceError !== null && (
				<p className="mic-error" role="alert">
					{voiceError}
				</p>
			)}
		</>
	);
};
