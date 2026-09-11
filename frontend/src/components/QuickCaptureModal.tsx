import { KolAlert, KolButton, KolCard, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { ActivityAdvice, Category, Pillar, Task } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { deepActiveElement } from '../lib/focus';
import { taskFormModalTitle } from '../lib/task';
import { readVoiceAutostartPreference } from '../lib/voiceAutostart';
import { AdvisorResults } from './AdvisorResults';
import { Modal } from './Modal';
import { TaskForm, type TaskFormInitialValues } from './TaskForm';
import { VoiceField } from './VoiceField';

interface QuickCaptureModalProps {
	/** Beim Anlegen einer Unteraufgabe: die Eltern-Aufgabe (durchgereicht an das reguläre Formular). */
	parentTask?: Task | null;
	/** Verfügbare Lebensbalance-Säulen (durchgereicht an das reguläre Formular und an den Berater). */
	pillars: Pillar[];
	/** Verfügbare Kategorien (durchgereicht an das reguläre Formular). */
	categories?: Category[];
	/**
	 * Aktuelle Säulen-Verteilung, so wie sie im Dashboard-Widget „Meine Themen" dargestellt ist: je
	 * Säule Soll-Anteil (`weight`, 0–100 %) und Ist-Anteil (`actualShare`, 0–1). Wird — falls
	 * vorhanden — an den Berater mitgeschickt, damit er die Vorschläge primär auf die schwächsten
	 * (am stärksten unterversorgten) Säulen ausrichtet.
	 */
	distribution?: { pillarId: number; weight: number; actualShare: number }[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

/**
 * Zweistufiger Anlege-Flow (#236): Vor dem regulären Formular erscheint ein Freitext-Schritt mit
 * einer Textarea. Von dort führen drei Wege weiter (#1335 — Schnellerfassung und Säulen-Berater sind
 * ein einziger Dialog, es gibt keinen eigenen Berater-Dialog mehr):
 *  - „Verarbeiten und weiter" schickt den Text an `POST /tasks/parse-text` und füllt {@link TaskForm} vor,
 *  - „Beraten lassen" schickt ihn an `POST /pillars/advisor` und zeigt die Vorschläge ({@link AdvisorResults})
 *    **im selben Schritt** — ein übernommener Vorschlag landet wieder in derselben Textarea,
 *  - „Überspringen" öffnet direkt das leere Formular (ohne LLM-Aufruf).
 *
 * **Ein einziger persistenter Dialog:** Alle Schritte rendern in denselben `Modal`/`KolDialog` — beim
 * Schrittwechsel werden nur die Kinder getauscht, der Dialog wird NICHT ab- und neu aufgebaut. Das ist
 * bewusst so (#236): Ein Remount des `KolDialog` beim async Schrittwechsel (nach `await parseText`)
 * ließ das zweite `showModal()` auf dem noch nicht verbundenen Dialog „not in a Document" werfen und riss
 * das ganze Modal ab. Ohne Remount entfällt diese Race vollständig — es gibt nur ein `showModal()`.
 */
export const QuickCaptureModal = ({
	parentTask = null,
	pillars,
	categories,
	distribution,
	onClose,
	onSaved,
}: QuickCaptureModalProps) => {
	const [step, setStep] = useState<'capture' | 'form'>('capture');
	const [prefill, setPrefill] = useState<TaskFormInitialValues>({});
	const [parsing, setParsing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [advising, setAdvising] = useState(false);
	const [adviceError, setAdviceError] = useState<string | null>(null);
	// `null` = noch keine Beratung angefragt (kein „Keine Vorschläge"-Hinweis vor der ersten Anfrage).
	const [advice, setAdvice] = useState<ActivityAdvice[] | null>(null);
	const [hasText, setHasText] = useState(false);
	const [voiceAutostart] = useState(readVoiceAutostartPreference);
	// #334: Spiegelt den im TaskForm gewählten Modus (Aufgabe/Serie) für den Dialog-Titel.
	const [formMode, setFormMode] = useState<'task' | 'series'>('task');

	// Der Dialog startet immer mit leerem Freitext: Seit #1335 gibt es keinen Aufrufer mehr, der Text
	// mitbringt — die Berater-Übernahme (AK3) schreibt in denselben laufenden Dialog statt ihn mit
	// einem Vorbelegungstext neu zu öffnen.
	const text = useRef('');
	// State-Mirror für die Capture-Textarea (#264): KoliBri verwaltet den Anzeigewert selbst, aber
	// ein per Sprach-Transkript geänderter Wert muss über `_value` ins Feld gespiegelt werden.
	const [captureText, setCaptureText] = useState('');
	const textareaRef = useRef<HTMLKolTextareaElement>(null);

	// Autofokus auf die native textarea im Shadow DOM beim Öffnen des Capture-Schritts (#250).
	// 200 ms überbrücken die Rendering-Latenz von showModal() in headless Chromium (CI): KoliBris
	// showModal()-Implementierung führt nach dem Microtask (whenDefined) noch Macrotask-Arbeit aus,
	// die den Dialog-internen Fokus neu setzt — setTimeout(0) feuert davor und verliert den Fokus.
	// 50 ms war auf langsamen CI-Shard-Umgebungen zu knapp (Autofokus-Test flaky); 200 ms sind aus
	// UX-Sicht unmerklich und decken auch langsamere Macrotask-Queues zuverlässig ab.
	useEffect(() => {
		const id = setTimeout(() => {
			textareaRef.current?.shadowRoot?.querySelector('textarea')?.focus();
		}, 200);
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
				address: parsed.address,
				checklist: parsed.checklist,
				// Vom Modell erkannte Kategorie vorbelegen; sie ist bereits gegen die Kategorien des
				// Nutzers geprüft (Server) und im Formular jederzeit änderbar.
				categoryId: parsed.categoryId,
			});
			// #1310: Erkennt das Parsing einen wiederkehrenden Termin, startet das Formular im
			// Serien-Modus. `formMode` ist zugleich der Dialog-Titel-Spiegel (#334) und wird von
			// `TaskForm` beim Umschalten über `onModeChange` weitergepflegt.
			setFormMode(parsed.isSeries === true ? 'series' : 'task');
			setStep('form');
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setParsing(false);
		}
	};

	/**
	 * Berater-Weg (#1335): Der Freitext geht — zusammen mit der Säulen-Verteilung — an
	 * `POST /pillars/advisor`; die Vorschläge erscheinen unter dem Textfeld, ohne Schritt- oder
	 * Dialogwechsel. Der Text bleibt dabei unangetastet, damit von hier aus weiterhin
	 * „Verarbeiten und weiter" möglich ist.
	 */
	const consult = async (): Promise<void> => {
		setAdviceError(null);
		// #440: Ohne Säulen kann der Berater nichts zuordnen — Hinweis statt leerer Anfrage ans LLM.
		if (pillars.length === 0) {
			setAdvice([]);
			return;
		}
		setAdvising(true);
		try {
			const trimmed = text.current.trim();
			const result = await api.advisePillarActivities({
				activityAdvisorInput: {
					...(trimmed === '' ? {} : { question: trimmed }),
					...(distribution && distribution.length > 0 ? { distribution } : {}),
				},
			});
			setAdvice(result.advice);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setAdviceError(apiError.message);
		} finally {
			setAdvising(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst im Capture-Schritt den primären CTA „Verarbeiten und weiter" aus —
	// nur solange dessen `_disabled`-Bedingung nicht greift (kein Parsing, Text vorhanden). Im Formular-
	// Schritt übernimmt der `TaskForm`-eigene Hook, deshalb hier bewusst an `step === 'capture'` gebunden.
	// #1335: bewusst der EINZIGE `useCtrlEnter` im Dialog — „Beraten lassen" bleibt ein reiner Klick-Weg,
	// sonst wäre bei Strg+Enter nicht mehr eindeutig, welcher der beiden LLM-Aufrufe feuert.
	useCtrlEnter(
		() => void process(),
		() => step === 'capture' && !parsing && !advising && text.current.trim().length > 0,
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
					categories={categories}
					initialValues={prefill}
					initialMode={formMode}
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
					{adviceError !== null && (
						<KolAlert _type="error" _label="Beratung fehlgeschlagen">
							{adviceError}
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
					{advising && (
						<div className="pillar-editor-loading">
							<KolSpin _show _variant="cycle" _label="Berater denkt nach" />
						</div>
					)}
					{/* `aria-live`: Die Vorschläge erscheinen ohne Fokuswechsel im selben Dialog — ohne
					    Live-Region bekäme ein Screenreader-Publikum das Eintreffen nicht mit (WCAG 4.1.3). */}
					<div aria-live="polite">
						{!advising &&
							advice !== null &&
							(pillars.length === 0 ? (
								// #440: Ohne Säulen kann der Berater nichts zuordnen — gestalteter Hinweis statt Liste.
								<KolCard _label="Keine Säulen definiert" _level={0}>
									<p>
										Keine Säulen definiert — lege zuerst Säulen in den <a href="/settings">Einstellungen</a> an, damit
										der Berater Vorschläge machen kann.
									</p>
								</KolCard>
							) : (
								<AdvisorResults
									advice={advice}
									pillars={pillars}
									onAdoptActivity={(activity) => {
										// #1335 (AK3): Der Vorschlag ersetzt den Freitext desselben Dialogs — kein Schließen,
										// kein Dialogwechsel. Von hier führt „Verarbeiten und weiter" wie bei jedem Freitext weiter.
										text.current = activity;
										setCaptureText(activity);
										setHasText(activity.trim().length > 0);
									}}
								/>
							))}
					</div>
					<div className="modal-actions">
						<KolButton
							_label={parsing ? 'Verarbeiten…' : 'Verarbeiten und weiter'}
							_variant="primary"
							_disabled={parsing || advising || !hasText}
							_on={{ onClick: () => void process() }}
						/>
						{/* Zweiter Weg (#1335): Beratung im selben Dialog. Bewusst `secondary` — die eine
						    Primäraktion bleibt „Verarbeiten und weiter". Der Freitext ist hier optional
						    (ohne Frage berät der Endpunkt über alle Säulen hinweg), daher kein `hasText`-Gate. */}
						<KolButton
							_label={advising ? 'Beraten…' : 'Beraten lassen'}
							_variant="secondary"
							_disabled={parsing || advising}
							_on={{ onClick: () => void consult() }}
						/>
						<KolButton
							_label="Überspringen"
							_variant="secondary"
							_disabled={parsing || advising}
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
