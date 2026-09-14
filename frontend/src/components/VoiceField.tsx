import { useEffect, useId, useRef, type ReactNode } from 'react';
import { PLAN_REQUIRED_EVENT, type PlanRequiredDetail } from '../lib/apiError';
import { useEntitlement, usePlan } from '../lib/usePlan';
import { useVoiceInput } from '../lib/useVoiceInput';
import { PlanBadge } from './PlanBadge';

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
	/**
	 * Das Feld nutzt den KoliBri built-in Zähler (`_hasCounter`), der eine Zeile UNTER der
	 * Inputbox rendert. Der Wrapper wird dadurch höher — die Modifier-Klasse hebt den
	 * Bottom-Anker des Mic-Buttons um diese Zeile an (#1054 F1). Wirkt für beide Varianten
	 * (`input` über --pp-input-below in der Zentrier-Formel, `textarea` über den Bottom-Anker).
	 */
	counter?: boolean;
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
	counter = false,
	children,
}: VoiceFieldProps) => {
	const { isRecording, startRecording, stopRecording, isSupported, voiceError } = useVoiceInput({ onTranscript });

	// #1484 (T3b AK6): Die Spracheingabe ist die EINZIGE Grenzstelle, die clientseitig sperrt — sie
	// läuft rein lokal im Browser, es gibt keinen Server-Endpunkt, der ablehnen könnte. Ohne
	// geladenes Entitlement (`undefined`) wird NICHT gesperrt: unbekannt ist kein „nein" (PlanBadge
	// AK1, gleiche Regel).
	const { plan } = usePlan();
	const entitlement = useEntitlement('voice_input');
	const blocked = entitlement !== undefined && !entitlement.allowed;
	const openOffer = (): void => {
		if (entitlement === undefined) {
			return;
		}
		const detail: PlanRequiredDetail = {
			feature: 'voice_input',
			requiredPlan: entitlement.requiredPlan,
			currentPlan: plan ?? 'free',
		};
		window.dispatchEvent(new CustomEvent<PlanRequiredDetail>(PLAN_REQUIRED_EVENT, { detail }));
	};

	// Auto-Start (#272): beim Mount die Aufnahme starten, sofern unterstützt. Der Cleanup setzt das
	// Ein-Schuss-Flag zurück, damit der StrictMode-Zyklus (setup → cleanup → setup) im Dev-Build die
	// zwischenzeitlich abgebrochene Aufnahme im zweiten Setup erneut startet. Ohne
	// Browser-Unterstützung (`isSupported=false`) ist `startRecording` ein No-op → kein Absturz.
	const autoStarted = useRef(false);
	const hintId = useId();
	useEffect(() => {
		if (autoStart && isSupported && !blocked && !autoStarted.current) {
			autoStarted.current = true;
			startRecording({ auto: true });
		}
		return () => {
			autoStarted.current = false;
		};
	}, [autoStart, isSupported, blocked, startRecording]);

	return (
		<>
			{/* Der Wrapper bleibt auch ohne Browser-Unterstützung stehen, damit das Grid-Layout stabil ist. */}
			<div className={`voice-field voice-field--${variant}${counter ? ' voice-field--counter' : ''}`}>
				{children}
				{isSupported && (
					<button
						type="button"
						// #522 (AC2c): Das Mikrofon ist ein Overlay-Affordance, das visuell INNERHALB des
						// Feldes verankert ist — konzeptionell Teil des Feld-Widgets, kein eigener Primär-
						// Tab-Stop. `tabIndex={-1}` nimmt es aus der wandernden Tab-Reihenfolge heraus, damit
						// der primäre Formular-Fluss (Textarea → primärer CTA) nicht unterbrochen wird. Er
						// bleibt erreichbar: klickbar (Maus/Touch, siehe Voice-/Transkriptions-Specs) und per
						// `.focus()` — nur eben nicht über Tab. Das schließt die Tab-Freiheits-Lücke im
						// Schnellerfassungs-Dialog (AC2c: Tab aus der Textarea heraus landet auf dem CTA).
						tabIndex={-1}
						aria-label={isRecording ? `Aufnahme stoppen: ${fieldLabel}` : `Aufnahme starten (Mikrofon): ${fieldLabel}`}
						aria-pressed={isRecording}
						className={`mic-button${isRecording ? ' mic-button--recording' : ''}`}
						onClick={() => {
							// AK6: Ohne Entitlement startet keine Aufnahme — stattdessen öffnet das Angebot.
							if (blocked) openOffer();
							else if (isRecording) stopRecording();
							else startRecording();
						}}
					>
						🎤
					</button>
				)}
			</div>
			{/* #1484 (T3b AK3): Grenzstelle `voice_input`. Das Badge liegt als Geschwister AUSSERHALB
			    des `.voice-field`-Wrappers (wie der Hinweistext): der Wrapper ist der
			    Positionierungs-Kontext des Mic-Buttons, ein Kind würde ihn aus der Feldbox drängen. */}
			<PlanBadge feature="voice_input" />
			{hint !== undefined && hint !== '' && (
				<p id={hintId} role="note" className="voice-field-hint">
					{hint}
				</p>
			)}
			{voiceError !== null && (
				<p className="mic-error" role="alert">
					{voiceError}
				</p>
			)}
		</>
	);
};
