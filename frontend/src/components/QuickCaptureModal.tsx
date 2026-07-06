import { KolAlert, KolButton, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { Pillar, Task } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { deepActiveElement } from '../lib/focus';
import { taskFormModalTitle } from '../lib/task';
import { readVoiceAutostartPreference } from '../lib/voiceAutostart';
import { Modal } from './Modal';
import { TaskForm, type TaskFormInitialValues } from './TaskForm';
import { VoiceField } from './VoiceField';

interface QuickCaptureModalProps {
	/** Beim Anlegen einer Unteraufgabe: die Eltern-Aufgabe (durchgereicht an das reguläre Formular). */
	parentTask?: Task | null;
	/** Verfügbare Lebensbalance-Säulen (durchgereicht an das reguläre Formular). */
	pillars: Pillar[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
	/** Optionaler Vorbelegungstext für die Capture-Textarea (z. B. aus dem Berater übernommen, #327). */
	initialText?: string;
}

/**
 * Zweistufiger Anlege-Flow (#236): Vor dem regulären Formular erscheint ein Schnellerfassungs-Schritt
 * mit einer Freitext-Textarea. Von dort führen zwei Wege zum Task-Formular ({@link TaskForm}):
 *  - „Verarbeiten und weiter" schickt den Text an `POST /tasks/parse-text` und füllt das Formular vor,
 *  - „Überspringen" öffnet direkt das leere Formular (ohne LLM-Aufruf).
 *
 * **Ein einziger persistenter Dialog:** Beide Schritte rendern in denselben `Modal`/`KolDialog` — beim
 * Schrittwechsel werden nur die Kinder getauscht, der Dialog wird NICHT ab- und neu aufgebaut. Das ist
 * bewusst so (#236): Ein Remount des `KolDialog` beim async Schrittwechsel (nach `await parseText`)
 * ließ das zweite `showModal()` auf dem noch nicht verbundenen Dialog „not in a Document" werfen und riss
 * das ganze Modal ab. Ohne Remount entfällt diese Race vollständig — es gibt nur ein `showModal()`.
 */
export const QuickCaptureModal = ({
	parentTask = null,
	pillars,
	onClose,
	onSaved,
	initialText,
}: QuickCaptureModalProps) => {
	const [step, setStep] = useState<'capture' | 'form'>('capture');
	const [prefill, setPrefill] = useState<TaskFormInitialValues>({});
	const [parsing, setParsing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasText, setHasText] = useState(initialText !== undefined && initialText.trim().length > 0);
	const [voiceAutostart] = useState(readVoiceAutostartPreference);
	// #334: Spiegelt den im TaskForm gewählten Modus (Aufgabe/Serie) für den Dialog-Titel.
	const [formMode, setFormMode] = useState<'task' | 'series'>('task');

	const text = useRef(initialText ?? '');
	// State-Mirror für die Capture-Textarea (#264): KoliBri verwaltet den Anzeigewert selbst, aber
	// ein per Sprach-Transkript geänderter Wert muss über `_value` ins Feld gespiegelt werden.
	const [captureText, setCaptureText] = useState(initialText ?? '');
	const textareaRef = useRef<HTMLKolTextareaElement>(null);

	// Autofokus auf die native textarea im Shadow DOM beim Öffnen des Capture-Schritts (#250).
	// 50 ms überbrücken die Rendering-Latenz von showModal() in headless Chromium (CI): KoliBris
	// showModal()-Implementierung führt nach dem Microtask (whenDefined) noch Macrotask-Arbeit aus,
	// die den Dialog-internen Fokus neu setzt — setTimeout(0) feuert davor und verliert den Fokus.
	useEffect(() => {
		const id = setTimeout(() => {
			textareaRef.current?.shadowRoot?.querySelector('textarea')?.focus();
		}, 50);
		return () => clearTimeout(id);
	}, []);

	// Auslöser (den „Neuen Task anlegen"-Button) beim Mount als Fallback-Fokusziel merken. Da der Dialog
	// über beide Schritte hinweg dieselbe Instanz bleibt, greift primär die eigene Fokus-Rückgabe des
	// `Modal`; der Ref ist nur die Absicherung, falls der Auslöser beim Schließen nicht mehr im DOM ist.
	const triggerRef = useRef<HTMLElement | null>(null);
	useEffect(() => {
		const active = deepActiveElement();
		triggerRef.current = active instanceof HTMLElement ? active : null;
	}, []);

	const process = async (): Promise<void> => {
		setError(null);
		setParsing(true);
		try {
			const parsed = await api.parseText({ text: text.current });
			setPrefill({
				title: parsed.title,
				description: parsed.description,
				priority: parsed.priority,
				estimatedEffort: parsed.estimatedEffort,
				deadline: parsed.deadline,
			});
			setStep('form');
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setParsing(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst im Capture-Schritt den primären CTA „Verarbeiten und weiter" aus —
	// nur solange dessen `_disabled`-Bedingung nicht greift (kein Parsing, Text vorhanden). Im Formular-
	// Schritt übernimmt der `TaskForm`-eigene Hook, deshalb hier bewusst an `step === 'capture'` gebunden.
	useCtrlEnter(
		() => void process(),
		() => step === 'capture' && !parsing && text.current.trim().length > 0,
	);

	// Der Modal-Heading bleibt im Capture-Schritt „Neuen Task anlegen"; im Formular-Schritt spiegelt er
	// den Anlege-Kontext (bei einer Unteraufgabe die Eltern-Aufgabe) — dieselbe Beschriftung wie im
	// eigenständigen `TaskFormModal`.
	const title = step === 'capture' ? 'Neuen Task anlegen' : taskFormModalTitle(null, parentTask, formMode);

	return (
		<Modal title={title} onClose={onClose} fallbackFocusRef={triggerRef}>
			{step === 'form' ? (
				<TaskForm
					task={null}
					parentTask={parentTask}
					pillars={pillars}
					initialValues={prefill}
					onClose={onClose}
					onSaved={onSaved}
					onModeChange={setFormMode}
				/>
			) : (
				<>
					{error !== null && (
						<KolAlert _type="error" _label="Verarbeitung fehlgeschlagen">
							{error}
						</KolAlert>
					)}
					<div className="form-grid">
						<VoiceField
							variant="textarea"
							fieldLabel="Beschreibe deinen Task"
							autoStart={voiceAutostart}
							onTranscript={(transcript) => {
								const newVal = text.current ? `${text.current} ${transcript}` : transcript;
								text.current = newVal;
								setCaptureText(newVal);
								// Auch nach reiner Sprach-Eingabe muss „Verarbeiten und weiter" aktiv werden.
								setHasText(newVal.trim().length > 0);
							}}
						>
							<KolTextarea
								ref={textareaRef}
								_label="Beschreibe deinen Task"
								_rows={4}
								_value={captureText}
								_on={{
									onInput: (_event, value) => {
										const newVal = readString(value);
										text.current = newVal;
										setCaptureText(newVal);
										setHasText(newVal.trim().length > 0);
									},
								}}
							/>
						</VoiceField>
					</div>
					{parsing && (
						<div className="pillar-editor-loading">
							<KolSpin _show _variant="cycle" _label="Text wird verarbeitet" />
						</div>
					)}
					<div className="modal-actions">
						<KolButton
							_label={parsing ? 'Verarbeiten…' : 'Verarbeiten und weiter'}
							_variant="primary"
							_disabled={parsing || !hasText}
							_on={{ onClick: () => void process() }}
						/>
						<KolButton
							_label="Überspringen"
							_variant="secondary"
							_disabled={parsing}
							_on={{
								onClick: () => {
									const captured = text.current.trim();
									if (captured) setPrefill({ description: captured });
									setStep('form');
								},
							}}
						/>
					</div>
				</>
			)}
		</Modal>
	);
};
