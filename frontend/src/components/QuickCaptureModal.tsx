import { KolAlert, KolButton, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { Pillar, Task } from 'client';
import { useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { Modal } from './Modal';
import { TaskFormModal, type TaskFormInitialValues } from './TaskFormModal';

interface QuickCaptureModalProps {
	/** Beim Anlegen einer Unteraufgabe: die Eltern-Aufgabe (durchgereicht an das reguläre Formular). */
	parentTask?: Task | null;
	/** Verfügbare Lebensbalance-Säulen (durchgereicht an das reguläre Formular). */
	pillars: Pillar[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Zweistufiger Anlege-Flow (#236): Vor dem regulären Formular erscheint ein Schnellerfassungs-Schritt
 * mit einer Freitext-Textarea. Von dort führen zwei Wege zum `TaskFormModal`:
 *  - „Verarbeiten und weiter" schickt den Text an `POST /tasks/parse-text` und füllt das Formular vor,
 *  - „Überspringen" öffnet direkt das leere Formular (ohne LLM-Aufruf).
 * Der Modal-Heading bleibt über beide Schritte hinweg „Neuen Task anlegen".
 */
export const QuickCaptureModal = ({ parentTask = null, pillars, onClose, onSaved }: QuickCaptureModalProps) => {
	const [step, setStep] = useState<'capture' | 'form'>('capture');
	const [prefill, setPrefill] = useState<TaskFormInitialValues>({});
	const [parsing, setParsing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [hasText, setHasText] = useState(false);

	const text = useRef('');

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
			});
			setStep('form');
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setParsing(false);
		}
	};

	if (step === 'form') {
		return (
			<TaskFormModal
				task={null}
				parentTask={parentTask}
				pillars={pillars}
				initialValues={prefill}
				onClose={onClose}
				onSaved={onSaved}
			/>
		);
	}

	return (
		<Modal title="Neuen Task anlegen" onClose={onClose}>
			{error !== null && (
				<KolAlert _type="error" _label="Verarbeitung fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolTextarea
					_label="Beschreibe deinen Task"
					_rows={4}
					_on={{
						onInput: (_event, value) => {
							text.current = readString(value);
							setHasText(text.current.trim().length > 0);
						},
						onChange: (_event, value) => {
							text.current = readString(value);
							setHasText(text.current.trim().length > 0);
						},
					}}
				/>
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
		</Modal>
	);
};
