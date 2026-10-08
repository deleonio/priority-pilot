import { KolAlert, KolButton, KolCard, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { ActivityAdvice, Category, Pillar, Series, Task } from 'client';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { AI_FAIR_USE_INTERVAL_SECONDS, fairUseMessage } from '../lib/planOffers';
import { readString } from '../lib/inputValue';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { deepActiveElement } from '../lib/focus';
import { taskFormModalTitle } from '../lib/task';
import { readVoiceAutostartPreference } from '../lib/voiceAutostart';
import { AdvisorResults } from './AdvisorResults';
import { Modal, type ModalHandle } from './Modal';
import { SeriesInstanceDialog } from './SeriesInstanceDialog';
import { TaskForm, type TaskFormHandle, type TaskFormInitialValues } from './TaskForm';
import { VoiceField } from './VoiceField';
import { AiQuotaHint } from './AiQuotaHint';

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
 * einer Textarea. Von dort führen vier Wege weiter (#1335 — Schnellerfassung und Säulen-Berater sind
 * ein einziger Dialog, es gibt keinen eigenen Berater-Dialog mehr):
 *  - „Verarbeiten und weiter" schickt den Text an `POST /tasks/parse-text` und füllt {@link TaskForm} vor,
 *  - „Beraten lassen" schickt ihn an `POST /pillars/advisor` und zeigt die Vorschläge ({@link AdvisorResults})
 *    **im selben Schritt** — ein übernommener Vorschlag landet wieder in derselben Textarea,
 *  - „Überspringen" öffnet direkt das leere Formular (ohne LLM-Aufruf),
 *  - „Aus Vorlage" (#2363) öffnet den Schritt „Vorlage wählen"; die Wahl einer Vorlage (Serie mit
 *    `autoCreate === false`) tauscht den Dialog-Inhalt gegen den {@link SeriesInstanceDialog} —
 *    kein Modal-Stapel, das Schnellerfassen ist dann zu.
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
	const { t } = useTranslation('capture');
	const [step, setStep] = useState<'capture' | 'form' | 'template'>('capture');
	const [prefill, setPrefill] = useState<TaskFormInitialValues>({});
	const [parsing, setParsing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// #1783: Fair-Use-Drossel — eigener Hinweis-State statt `error`, damit kein Fehler-Ton entsteht.
	const [fairUseHint, setFairUseHint] = useState<string | null>(null);
	const [advising, setAdvising] = useState(false);
	const [adviceError, setAdviceError] = useState<string | null>(null);
	// `null` = noch keine Beratung angefragt (kein „Keine Vorschläge"-Hinweis vor der ersten Anfrage).
	const [advice, setAdvice] = useState<ActivityAdvice[] | null>(null);
	const [hasText, setHasText] = useState(false);
	const [voiceAutostart] = useState(readVoiceAutostartPreference);
	// #334: Spiegelt den im TaskForm gewählten Modus (Aufgabe/Serie) für den Dialog-Titel.
	const [formMode, setFormMode] = useState<'task' | 'series'>('task');
	// #2363 (AK1): Vorlagen-Schritt — `null` = lädt, sonst genau die Serien mit `autoCreate === false`
	// (Vorlagen, Muster SeriesTab). Fehler separat, damit der Spinner stoppt statt ewig zu laufen.
	const [templates, setTemplates] = useState<Series[] | null>(null);
	const [templateError, setTemplateError] = useState<string | null>(null);
	// #2363 (AK2): Gewählte Vorlage — ersetzt den Dialog-Inhalt durch den SeriesInstanceDialog (#2359).
	const [templateTarget, setTemplateTarget] = useState<Series | null>(null);

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

	// #1584 (AK8): Der Capture-Schritt (Freitext) schließt weiterhin direkt über X/Escape/Backdrop —
	// unverändertes Verhalten. Erst im Formular-Schritt (`step === 'form'`, dasselbe `TaskForm` wie in
	// `TaskFormModal`) fragt `TaskForm.requestClose()` bei geänderten Werten nach (AK1-AK5).
	const taskFormRef = useRef<TaskFormHandle>(null);
	// Muss den (im Formular-Schritt) bereits selbst geschlossenen Dialog wieder öffnen können, wenn
	// `requestClose()` das Schließen abbricht (s. `Modal.tsx`/`TaskFormModal.tsx`).
	const modalRef = useRef<ModalHandle>(null);

	const process = async (): Promise<void> => {
		setError(null);
		setFairUseHint(null);
		setParsing(true);
		try {
			const parsed = await api.parseText({ text: text.current });
			if (parsed.fairUse === 'throttled') {
				setFairUseHint(fairUseMessage(AI_FAIR_USE_INTERVAL_SECONDS));
			}
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
			if (apiError.throttled === true) {
				setFairUseHint(apiError.message);
			} else {
				setError(apiError.message);
			}
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
		setFairUseHint(null);
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
			if (result.fairUse === 'throttled') {
				setFairUseHint(fairUseMessage(AI_FAIR_USE_INTERVAL_SECONDS));
			}
		} catch (reason) {
			const apiError = await toApiError(reason);
			if (apiError.throttled === true) {
				setFairUseHint(apiError.message);
			} else {
				setAdviceError(apiError.message);
			}
		} finally {
			setAdvising(false);
		}
	};

	/**
	 * „Aus Vorlage" (#2363, AK1): lädt die Serien und öffnet im selben persistenten Dialog den Schritt
	 * „Vorlage wählen" — genau die Einträge mit `autoCreate === false` (Muster SeriesTab.tsx:173);
	 * `autoCreate: true`/undefiniert sind automatische Serien und erscheinen nicht.
	 */
	const openTemplates = async (): Promise<void> => {
		setStep('template');
		setTemplates(null);
		setTemplateError(null);
		try {
			const series = await api.listSeries();
			setTemplates(series.filter((entry) => entry.autoCreate === false));
		} catch (reason) {
			setTemplateError((await toApiError(reason)).message);
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
	const title = step === 'form' ? taskFormModalTitle(null, parentTask, formMode) : t('quickCapture.title');

	// #2363 (AK2): Gewählte Vorlage → SeriesInstanceDialog („Aufgabe anlegen") statt Modal-Stapel —
	// das Schnellerfassen wird unmountet (Muster Schrittwechsel #236, Modal.tsx), der Dialog ist das
	// einzige offene Modal. `onCreated` läuft auf denselben Pfad wie `onSaved` (Dialog zu, Liste neu).
	if (templateTarget !== null) {
		return <SeriesInstanceDialog series={templateTarget} onClose={onClose} onCreated={() => onSaved()} />;
	}

	return (
		<Modal
			ref={modalRef}
			title={title}
			onClose={() => {
				if (step === 'form' && taskFormRef.current !== null) {
					taskFormRef.current.requestClose();
				} else if (step === 'template') {
					// #2363 (AK4): Escape im Vorlagen-Schritt → zurück zum Capture (Freitext bleibt erhalten).
					// Das native `<dialog>` hat sich schon selbst geschlossen — deshalb reopen() (Muster TaskForm).
					setStep('capture');
					modalRef.current?.reopen();
				} else {
					onClose();
				}
			}}
			fallbackFocusRef={triggerRef}
		>
			<AiQuotaHint message={fairUseHint} />
			{step === 'template' ? (
				<>
					{templateError !== null && (
						<KolAlert _type="error" _label={t('quickCapture.templatesLoadError')}>
							{templateError}
						</KolAlert>
					)}
					{templates === null ? (
						<div className="pillar-editor-loading">
							<KolSpin _show _variant="cycle" _label={t('quickCapture.templatesLoading')} />
						</div>
					) : templates.length === 0 ? (
						// #2363 (AK3): Keine Vorlage — Hinweis mit dem Anlage-Weg statt leerer Liste.
						<KolCard _label={t('quickCapture.noTemplatesLabel')} _level={0}>
							<p>{t('quickCapture.noTemplatesText')}</p>
						</KolCard>
					) : (
						<ul className="template-list">
							{templates.map((entry) => (
								<li key={entry.id}>
									<KolButton
										_label={entry.title}
										_variant="secondary"
										_on={{ onClick: () => setTemplateTarget(entry) }}
									/>
								</li>
							))}
						</ul>
					)}
				</>
			) : step === 'form' ? (
				<TaskForm
					ref={taskFormRef}
					task={null}
					parentTask={parentTask}
					pillars={pillars}
					categories={categories}
					initialValues={prefill}
					initialMode={formMode}
					onClose={onClose}
					onSaved={onSaved}
					onModeChange={setFormMode}
					reopenModal={() => modalRef.current?.reopen()}
				/>
			) : (
				<>
					{error !== null && (
						<KolAlert _type="error" _label={t('quickCapture.processFailed')}>
							{error}
						</KolAlert>
					)}
					{adviceError !== null && (
						<KolAlert _type="error" _label={t('quickCapture.adviceFailed')}>
							{adviceError}
						</KolAlert>
					)}
					<div className="form-grid">
						<VoiceField
							variant="textarea"
							fieldLabel={t('quickCapture.describeTask')}
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
								_label={t('quickCapture.describeTask')}
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
							<KolSpin _show _variant="cycle" _label={t('quickCapture.processing')} />
						</div>
					)}
					{advising && (
						<div className="pillar-editor-loading">
							<KolSpin _show _variant="cycle" _label={t('quickCapture.advising')} />
						</div>
					)}
					{/* `aria-live`: Die Vorschläge erscheinen ohne Fokuswechsel im selben Dialog — ohne
					    Live-Region bekäme ein Screenreader-Publikum das Eintreffen nicht mit (WCAG 4.1.3). */}
					<div aria-live="polite">
						{!advising &&
							advice !== null &&
							(pillars.length === 0 ? (
								// #440: Ohne Säulen kann der Berater nichts zuordnen — gestalteter Hinweis statt Liste.
								<KolCard _label={t('quickCapture.noPillarsLabel')} _level={0}>
									<p>
										<Trans
											t={t}
											i18nKey="quickCapture.noPillarsText"
											components={{ link: <a href={`${import.meta.env.BASE_URL}settings`} /> }}
										/>
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
							_label={parsing ? t('quickCapture.processBusy') : t('quickCapture.process')}
							_variant="primary"
							_disabled={parsing || advising || !hasText}
							_on={{ onClick: () => void process() }}
						/>
						{/* Zweiter Weg (#1335): Beratung im selben Dialog. Bewusst `secondary` — die eine
						    Primäraktion bleibt „Verarbeiten und weiter". Der Freitext ist hier optional
						    (ohne Frage berät der Endpunkt über alle Säulen hinweg), daher kein `hasText`-Gate. */}
						<KolButton
							_label={advising ? t('quickCapture.consultBusy') : t('quickCapture.consult')}
							_variant="secondary"
							_disabled={parsing || advising}
							_on={{ onClick: () => void consult() }}
						/>
						<KolButton
							_label={t('quickCapture.skip')}
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
						{/* Vierter Weg (#2363): Aufgabe aus einer Vorlage (Serie ohne „Automatisch anlegen") anlegen.
						    Bewusst `secondary` — die eine Primäraktion bleibt „Verarbeiten und weiter". */}
						<KolButton
							_label={t('quickCapture.fromTemplate')}
							_variant="secondary"
							_disabled={parsing || advising}
							_on={{ onClick: () => void openTemplates() }}
						/>
					</div>
				</>
			)}
		</Modal>
	);
};
