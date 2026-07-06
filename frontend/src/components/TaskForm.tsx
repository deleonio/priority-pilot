import {
	KolAlert,
	KolButton,
	KolInputCheckbox,
	KolInputDate,
	KolInputRange,
	KolInputText,
	KolSingleSelect,
	KolSpin,
	KolTextarea,
} from '@public-ui/react-v19';
import type {
	Pillar,
	Series,
	SeriesCreate,
	SeriesRhythm,
	SeriesUpdate,
	Task,
	TaskCreate,
	TaskPillarContribution,
	TaskUpdate,
} from 'client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readNumber, readString } from '../lib/inputValue';
import { readVoiceAutostartPreference } from '../lib/voiceAutostart';
import { VoiceField } from './VoiceField';
import {
	ADD_PILLAR_PLACEHOLDER,
	addPillarOptions,
	isRawDistributionValid,
	normalizeToTotalWeight,
	RAW_WEIGHT_MAX,
	RAW_WEIGHT_MIN,
	RAW_WEIGHT_STEP,
	suggestionsToContributions,
	sumWeights,
	weightToRaw,
} from '../lib/pillar';
import { deadlineToDateInput, formatNumber } from '../lib/task';

/** Vorbelegung der Formularfelder beim Anlegen, z. B. aus der Schnellerfassung per LLM (#236). */
export interface TaskFormInitialValues {
	title?: string;
	description?: string;
	priority?: number;
	estimatedEffort?: number;
	/** Deadline als ISO-8601-Datum/Zeit-String (aus dem LLM-Parsing, #236) — z. B. „2026-07-31T00:00:00.000Z". */
	deadline?: string;
}

/** Auswahl-Optionen des Serien-Rhythmus (Vertrag `SeriesRhythm`). */
const RHYTHM_OPTIONS: { label: string; value: SeriesRhythm }[] = [
	{ label: 'Täglich', value: 'daily' },
	{ label: 'Wöchentlich', value: 'weekly' },
	{ label: 'Monatlich', value: 'monthly' },
];

interface TaskFormProps {
	/** Zu bearbeitender Task; `null` legt einen neuen Task an. */
	task: Task | null;
	/**
	 * Zu bearbeitendes Serien-Template (#316). Wird eine Serie übergeben, startet das Formular im
	 * (gesperrten) Serie-Modus (Serien-Edit) und ruft beim Speichern `updateSeries` statt `updateTask`.
	 */
	series?: Series | null;
	/**
	 * Vorgewählter Formularmodus beim Anlegen (`task`/`series` sind `null`). Beim Bearbeiten ohne
	 * Wirkung — dort steht der Modus über `series`/`task` fest. Standard: `'task'`.
	 */
	initialMode?: 'task' | 'series';
	/**
	 * Beim Anlegen optional die Eltern-Aufgabe: Die neue Aufgabe wird nach dem Speichern als deren
	 * Vorgänger verknüpft (Unteraufgabe über das bestehende Abhängigkeits-/Aufgabenwald-Konzept).
	 */
	parentTask?: Task | null;
	/** Verfügbare Lebensbalance-Säulen für die Zuordnung (`GET /pillars`). */
	pillars: Pillar[];
	/**
	 * Vorbelegung der Formularfelder beim Anlegen (`task === null`), z. B. aus der Schnellerfassung
	 * per LLM (#236). Greift nur, wenn `task` selbst keinen Wert liefert.
	 */
	initialValues?: TaskFormInitialValues;
	/** Schließt den Dialog (Abbrechen-Button); wird vom Modal-Container bereitgestellt. */
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
	/** Meldet einen Moduswechsel (Aufgabe/Serie) an den Container — z. B. für den Dialog-Titel (#334). */
	onModeChange?: (mode: 'task' | 'series') => void;
}

/** Liefert für `KolInputDate` ein `date`-Input-taugliches `YYYY-MM-DD` aus einem ISO-String, sonst ''. */
const isoToDateInput = (iso: string | undefined): string => {
	if (iso === undefined || iso.trim() === '') {
		return '';
	}
	const parsed = new Date(iso);
	return Number.isNaN(parsed.getTime()) ? '' : deadlineToDateInput(parsed);
};

/** Wandelt ein `Date` (Serien-`startDate`, UTC) in den Wert eines `<input type="date">` (YYYY-MM-DD). */
const startDateToInput = (startDate: Date | undefined): string => {
	if (startDate === undefined || Number.isNaN(startDate.getTime())) {
		return '';
	}
	const year = startDate.getUTCFullYear().toString().padStart(4, '0');
	const month = (startDate.getUTCMonth() + 1).toString().padStart(2, '0');
	const day = startDate.getUTCDate().toString().padStart(2, '0');
	return `${year}-${month}-${day}`;
};

/**
 * Formular-Body für das Anlegen/Bearbeiten eines Tasks — **ohne** eigenen Dialog-Rahmen. Der Rahmen
 * (`Modal`/`KolDialog`) wird vom Container gestellt: `TaskFormModal` (Bearbeiten, eigenständig) bzw.
 * `QuickCaptureModal` (Anlegen, gemeinsamer persistenter Dialog über den Schnellerfassungs-Schritt
 * hinweg, #236). Diese Trennung vermeidet den Remount des `KolDialog` beim Schrittwechsel capture→form
 * — genau die Race, die `showModal()` „not in a Document" werfen ließ und das Modal abriss.
 */
export const TaskForm = ({
	task,
	series = null,
	initialMode = 'task',
	parentTask = null,
	pillars,
	initialValues,
	onClose,
	onSaved,
	onModeChange,
}: TaskFormProps) => {
	// #316: Serien-Edit (bearbeiten einer Serie) vs. Task-Edit (bearbeiten eines Tasks). `isEdit`
	// gilt für beide Bearbeiten-Fälle (Umschalter gesperrt); im Anlege-Fall ist beides `false`.
	const seriesEdit = series != null;
	const taskEdit = task !== null;
	const isEdit = taskEdit || seriesEdit;

	// Aktiver Formularmodus: „Serie" beim Serien-Edit fest vorgegeben, sonst Standard „Aufgabe".
	// Im Anlege-Modus wechselt der Umschalter zwischen beiden; im Bearbeiten-Modus ist er gesperrt.
	const [mode, setMode] = useState<'task' | 'series'>(seriesEdit ? 'series' : initialMode);
	const isSeriesMode = mode === 'series';

	// Eingaben in Refs halten: KoliBri-Inputs verwalten ihren Anzeigewert selbst, daher kein
	// erneutes Rendern (und kein Cursor-Springen) pro Tastendruck. Validierung beim Absenden.
	// `priority`/`estimatedEffort` dürfen `null` sein: ein geleertes Zahlenfeld setzt den Ref auf
	// `null`, damit die Validierung greift (statt still den alten Wert weiterzuverwenden).
	const form = useRef<{
		title: string;
		priority: number | null;
		estimatedEffort: number | null;
		description: string;
		deadline: string;
		startDate: string;
		rhythm: SeriesRhythm;
	}>({
		title: task?.title ?? series?.title ?? initialValues?.title ?? '',
		priority: task?.priority ?? series?.priority ?? initialValues?.priority ?? 3,
		estimatedEffort: task?.estimatedEffort ?? series?.estimatedEffort ?? initialValues?.estimatedEffort ?? 0.5,
		description: task?.description ?? series?.description ?? initialValues?.description ?? '',
		deadline: task !== null ? deadlineToDateInput(task.deadline) : isoToDateInput(initialValues?.deadline),
		startDate: series != null ? startDateToInput(series.startDate) : '',
		rhythm: series?.rhythm ?? 'weekly',
	});

	// Säulen-Beiträge im State (nicht im Ref): Hinzufügen/Entfernen und die Anteils-/Konfidenz-Slider
	// müssen neu rendern (Live-Summe). Slider verursachen — anders als Textfelder — kein Cursor-Springen.
	// `share` wird als Rohwert 0,0–1,0 gehalten (#82): der gespeicherte Prozentwert (0–100) wird für die
	// Anzeige zurückgerechnet und erst beim Speichern wieder auf 100 % normiert. `confidence` bleibt 0–100.
	const [contributions, setContributions] = useState<TaskPillarContribution[]>(() =>
		(task?.pillars ?? series?.pillars ?? []).map((entry) => ({ ...entry, share: weightToRaw(entry.share) })),
	);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// State-Mirror für die Textfelder mit Spracheingabe (#264): KoliBri verwaltet den Anzeigewert
	// selbst, aber ein per Transkript geänderter Wert muss über `_value` ins Feld gespiegelt werden.
	const [title, setTitle] = useState(form.current.title);
	const [description, setDescription] = useState(form.current.description);
	// State-Mirror für Range-Slider: `KolInputRange` muss über `_value` + `_label` den aktuellen
	// Wert erhalten — ohne State würde der Slider nach jedem Re-Render auf den Ref-Initialwert
	// zurückspringen (bekannte KoliBri-Falle, vgl. PillarWeightsForm.tsx:107–109).
	const [priority, setPriority] = useState<number>(form.current.priority ?? 3);
	const [estimatedEffort, setEstimatedEffort] = useState<number>(form.current.estimatedEffort ?? 0.5);

	// #272: Einmal beim Mount lesen, ob die Auto-Sprachaufnahme aktiv ist → nur das erste (Titel-)
	// VoiceField startet dann automatisch. Bewusst pro Formular-Instanz konstant (kein Live-Update).
	const [voiceAutostart] = useState(readVoiceAutostartPreference);

	// KI-Säulen-Vorschlag: eigener Lade-/Fehlerzustand, damit ein Vorschlags-Fehler den Speichern-Fluss
	// nicht stört (und umgekehrt).
	const [suggesting, setSuggesting] = useState(false);
	const [suggestError, setSuggestError] = useState<string | null>(null);

	// Merkt sich, ob in diesem Dialog ein KI-Vorschlag übernommen wurde. Nur dann ist das spätere
	// Speichern eine echte Bestätigung/Korrektur, die den Feedback-Loop füttert (#45). Ein Ref reicht:
	// der Wert beeinflusst kein Rendern und der Dialog schließt nach dem Speichern.
	const suggestionApplied = useRef(false);

	// #305: Verhindert, dass der Auto-Trigger für „Säulen vorschlagen" beim Mount mehr als einmal
	// feuert (React StrictMode mountet Komponenten im Dev-Modus doppelt). Ein Ref reicht: der Wert
	// steuert kein Rendern.
	const autoTriggered = useRef(false);

	// Beim Anlegen einer Unteraufgabe wird der bereits erfolgreich angelegte Task gemerkt. Schlägt nur
	// die anschließende Verknüpfung fehl, legt ein erneuter Submit kein Duplikat an, sondern überspringt
	// `createTask` und versucht ausschließlich die Verknüpfung erneut. Ein Ref reicht: der Wert steuert
	// kein Rendern und der Dialog schließt nach erfolgreichem Speichern.
	const createdTask = useRef<Task | null>(null);

	const pillarNameById = useMemo(() => new Map(pillars.map((pillar) => [pillar.id, pillar.name])), [pillars]);
	const pillarIds = useMemo(() => new Set(pillars.map((pillar) => pillar.id)), [pillars]);
	// Nur noch nicht zugeordnete Säulen lassen sich hinzufügen (jede Säule höchstens einmal pro Task).
	const availablePillars = pillars.filter((pillar) => !contributions.some((entry) => entry.pillarId === pillar.id));
	const shareSum = sumWeights(contributions.map((entry) => entry.share));
	// Gültig, sobald jeder Roh-Anteil ≥ 0 ist und mindestens einer > 0 (sonst nicht auf 100 % normierbar).
	const shareValid = isRawDistributionValid(contributions.map((entry) => entry.share));

	const updateContribution = (pillarId: number, patch: Partial<TaskPillarContribution>): void =>
		setContributions((prev) => prev.map((entry) => (entry.pillarId === pillarId ? { ...entry, ...patch } : entry)));

	const addPillar = (raw: unknown): void => {
		const id = readNumber(raw);
		if (id === null || id === ADD_PILLAR_PLACEHOLDER || contributions.some((entry) => entry.pillarId === id)) {
			return;
		}
		// Neuer Beitrag erhält den vollen Roh-Anteil 1,0 — bei gleichen Werten zahlen alle Säulen gleich
		// stark ein (Normierung beim Speichern verteilt sie anteilig auf 100 %).
		setContributions((prev) => [...prev, { pillarId: id, share: RAW_WEIGHT_MAX, confidence: 100 }]);
	};

	const removePillar = (pillarId: number): void =>
		setContributions((prev) => prev.filter((entry) => entry.pillarId !== pillarId));

	// Holt per KI (Server-Endpoint) einen Säulen-Vorschlag aus Titel/Beschreibung und übernimmt ihn als
	// editierbare Beiträge. Der Nutzer kann den Vorschlag anschließend über die vorhandenen Slider/
	// Hinzufügen/Entfernen-Bedienelemente korrigieren, bevor er speichert.
	const suggestPillars = async (): Promise<void> => {
		const title = form.current.title.trim();
		if (title === '') {
			setSuggestError('Bitte zuerst einen Titel angeben, dann lassen sich Säulen vorschlagen.');
			return;
		}
		setSuggestError(null);
		setSuggesting(true);
		try {
			const description = form.current.description.trim();
			const suggestions = await api.suggestPillars({
				suggestPillarsInput: { title, description: description === '' ? undefined : description },
			});
			const next = suggestionsToContributions(suggestions, pillarIds);
			if (next.length === 0) {
				setSuggestError('Es konnte keine passende Säule vorgeschlagen werden.');
				return;
			}
			// Vorschläge kommen als 100-%-Verteilung (0–100); für die Roh-Anzeige auf 0,0–1,0 zurückrechnen (#82).
			setContributions(next.map((entry) => ({ ...entry, share: weightToRaw(entry.share) })));
			suggestionApplied.current = true;
		} catch (reason) {
			const apiError = await toApiError(reason);
			setSuggestError(apiError.message);
		} finally {
			setSuggesting(false);
		}
	};

	// #305: Beim Anlegen (task === null) mit vorbelegtem Titel (z. B. aus der Schnellerfassung, #236)
	// direkt einmal einen KI-Säulen-Vorschlag anstoßen — ohne dass der Nutzer den Button drücken muss.
	// Der Ref-Guard sichert die „einmal"-Garantie gegen den StrictMode-Doppelmount ab; die leere
	// Dependency-Liste bindet den Effekt bewusst an den Mount (kein onChange/onBlur-Trigger).
	useEffect(() => {
		if (!isEdit && (initialValues?.title?.trim() ?? '') !== '' && !autoTriggered.current) {
			autoTriggered.current = true;
			void suggestPillars();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const submit = async (): Promise<void> => {
		const title = form.current.title.trim();
		if (title === '') {
			setError('Bitte einen Titel angeben.');
			return;
		}
		const priority = form.current.priority;
		if (priority === null || !Number.isInteger(priority) || priority < 1 || priority > 5) {
			setError('Priorität muss eine Ganzzahl zwischen 1 und 5 sein.');
			return;
		}
		const estimatedEffort = form.current.estimatedEffort;
		if (estimatedEffort === null || !Number.isFinite(estimatedEffort) || estimatedEffort < 0.1 || estimatedEffort > 1) {
			setError('Geschätzter Aufwand muss eine Zahl zwischen 0,1 und 1 sein.');
			return;
		}
		const description = form.current.description.trim();
		// Datum explizit als UTC interpretieren (`Z`), damit die Serialisierung (toISOString) den
		// Kalendertag zeitzonenunabhängig erhält.
		const deadline = form.current.deadline.trim() === '' ? null : new Date(`${form.current.deadline}T00:00:00Z`);
		if (deadline !== null && Number.isNaN(deadline.getTime())) {
			setError('Die Deadline ist kein gültiges Datum.');
			return;
		}
		// Serien-`startDate`: leeres Feld greift auf „heute" zurück (kein Pflicht-Validierungsfehler beim
		// Serie-Anlegen). Ein gesetztes Datum wird als UTC-Kalendertag interpretiert.
		const startDate =
			form.current.startDate.trim() === ''
				? new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
				: new Date(`${form.current.startDate}T00:00:00Z`);
		if (isSeriesMode && Number.isNaN(startDate.getTime())) {
			setError('Das Startdatum ist kein gültiges Datum.');
			return;
		}
		// Roh-Anteile 0,0–1,0: mindestens ein Anteil muss > 0 sein, damit sich die Verteilung auf 100 %
		// normieren lässt (#82).
		if (contributions.length > 0 && !isRawDistributionValid(contributions.map((entry) => entry.share))) {
			setError('Mindestens eine Säule muss einen Anteil > 0 haben.');
			return;
		}

		setError(null);
		setSaving(true);
		try {
			// Roh-Anteile vor dem Speichern auf die interne 100-%-Verteilung normieren (gespeicherte
			// Repräsentation und Ranking bleiben unverändert). `confidence` bleibt unverändert (0–100).
			const normalizedShares =
				contributions.length > 0 ? normalizeToTotalWeight(contributions.map((entry) => entry.share)) : [];
			const pillars = contributions.map((entry, index) => ({ ...entry, share: normalizedShares[index] }));
			if (seriesEdit) {
				// Serien-Edit (#316): gesetzte Felder gelten für künftige Instanzen. `startDate` nur mitschicken,
				// wenn das Feld gefüllt ist (leer → unverändert lassen).
				const seriesUpdate: SeriesUpdate = {
					title,
					priority,
					estimatedEffort,
					description: description === '' ? null : description,
					pillars,
					startDate: form.current.startDate.trim() === '' ? undefined : startDate,
					rhythm: form.current.rhythm,
				};
				await api.updateSeries({ id: series.id, seriesUpdate });
			} else if (isSeriesMode) {
				// Serie-Anlegen (#316): eigenständiges Template statt Task. `active: true` immer mitschicken.
				const seriesCreate: SeriesCreate = {
					title,
					priority,
					estimatedEffort,
					description: description === '' ? null : description,
					pillars,
					startDate,
					rhythm: form.current.rhythm,
					active: true,
				};
				await api.createSeries({ seriesCreate });
			} else if (taskEdit) {
				const taskUpdate: TaskUpdate = {
					title,
					priority,
					estimatedEffort,
					description: description === '' ? null : description,
					deadline,
					pillars,
				};
				await api.updateTask({ id: task.id, taskUpdate });
			} else {
				const taskCreate: TaskCreate = {
					title,
					priority,
					estimatedEffort,
					description: description === '' ? null : description,
					deadline,
					pillars,
				};
				// Bei erneutem Submit nach fehlgeschlagener Verknüpfung den bereits angelegten Task
				// wiederverwenden, statt ein Duplikat anzulegen.
				const created = createdTask.current ?? (await api.createTask({ taskCreate }));
				createdTask.current = created;
				// Unteraufgabe: die neue Aufgabe als Vorgänger der Eltern-Aufgabe verknüpfen (bestehendes
				// Abhängigkeits-/Aufgabenwald-Konzept; `dependingTaskId` ist der Vorgänger). Ein Teilfehler
				// (Aufgabe angelegt, Verknüpfung schlägt fehl) wird verständlich gemeldet, ohne den bereits
				// erfolgten Anlege-Vorgang zu verwerfen. Ein Zyklus-Konflikt ist bei einer neuen, kantenlosen
				// Aufgabe ausgeschlossen.
				if (parentTask !== null) {
					try {
						await api.addDependency({ id: parentTask.id, dependencyInput: { dependingTaskId: created.id, weight: 1 } });
					} catch (reason) {
						const apiError = await toApiError(reason);
						setError(
							`Die Aufgabe „${created.title}" wurde angelegt, aber die Verknüpfung als Unteraufgabe von „${parentTask.title}" ist fehlgeschlagen: ${apiError.message}`,
						);
						setSaving(false);
						return;
					}
				}
			}
			// Feedback-Loop (#45): Wurde ein KI-Vorschlag übernommen, ist die final gespeicherte
			// Zuordnung dessen Bestätigung/Korrektur — als Lern-Sample festhalten. Best-Effort
			// (fire-and-forget): ein Fehler hier darf das erfolgreiche Speichern nicht zurücknehmen.
			if (suggestionApplied.current) {
				void api
					.recordPillarFeedback({
						pillarFeedbackInput: {
							title,
							description: description === '' ? undefined : description,
							pillars: pillars.map((entry) => ({ pillarId: entry.pillarId, confidence: entry.confidence })),
						},
					})
					.catch(() => undefined);
			}
			onSaved();
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSaving(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst die primäre Aktion aus, solange kein Speichern/Vorschlag läuft
	// (analog zum `_disabled` des Speichern-CTAs). Ein leerer Titel wird von `submit` selbst abgefangen.
	useCtrlEnter(() => void submit(), !saving && !suggesting);

	// Liefert für `KolInputDate._value` nur ein valides `Date` (UTC) oder `undefined`, damit bei
	// unvollständiger Eingabe kein `Invalid Date` an die Komponente gereicht wird.
	const deadlineValue = ((): Date | undefined => {
		if (form.current.deadline === '') {
			return undefined;
		}
		const parsed = new Date(`${form.current.deadline}T00:00:00Z`);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	})();

	// Analog für das Serien-`startDate`: nur ein valides `Date` (UTC) oder `undefined`.
	const startDateValue = ((): Date | undefined => {
		if (form.current.startDate === '') {
			return undefined;
		}
		const parsed = new Date(`${form.current.startDate}T00:00:00Z`);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	})();

	return (
		<>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			{/* #334: Umschalter Aufgabe/Serie als Switch. Nur beim Anlegen sichtbar; beim Bearbeiten
			    steht der Datensatz-Typ (Task vs. Serie) fest und der Switch entfällt komplett. */}
			{!isEdit && (
				<div data-testid="mode-switch">
					<KolInputCheckbox
						_label="Serie"
						_checked={isSeriesMode}
						_variant="switch"
						_on={{
							onChange: (_e, checked) => {
								const newMode = checked === true ? 'series' : 'task';
								setMode(newMode);
								onModeChange?.(newMode);
							},
						}}
					/>
				</div>
			)}
			<div className="form-grid">
				<VoiceField
					variant="input"
					fieldLabel="Titel"
					autoStart={voiceAutostart}
					onTranscript={(text) => {
						const newVal = form.current.title ? `${form.current.title} ${text}` : text;
						form.current.title = newVal;
						setTitle(newVal);
					}}
				>
					<KolInputText
						_label="Titel"
						_required
						_value={title}
						_on={{
							onInput: (_event, value) => {
								const newVal = readString(value);
								form.current.title = newVal;
								setTitle(newVal);
							},
							onChange: (_event, value) => {
								const newVal = readString(value);
								form.current.title = newVal;
								setTitle(newVal);
							},
						}}
					/>
				</VoiceField>
				<KolInputRange
					_label={`Priorität (Ganzzahl 1–5): ${formatNumber(priority)}`}
					_min={1}
					_max={5}
					_step={1}
					_value={priority}
					_on={{
						onInput: (_event, value) => {
							const next = readNumber(value) ?? priority;
							form.current.priority = next;
							setPriority(next);
						},
						onChange: (_event, value) => {
							const next = readNumber(value) ?? priority;
							form.current.priority = next;
							setPriority(next);
						},
					}}
				/>
				<KolInputRange
					_label={`Geschätzter Aufwand in Tagen (0,1–1): ${formatNumber(estimatedEffort)}`}
					_min={0.1}
					_max={1}
					_step={0.1}
					_value={estimatedEffort}
					_on={{
						onInput: (_event, value) => {
							const next = readNumber(value) ?? estimatedEffort;
							form.current.estimatedEffort = next;
							setEstimatedEffort(next);
						},
						onChange: (_event, value) => {
							const next = readNumber(value) ?? estimatedEffort;
							form.current.estimatedEffort = next;
							setEstimatedEffort(next);
						},
					}}
				/>
				{isSeriesMode ? (
					<>
						{/* Serie-Modus (#316): Startdatum (Anker der Serie) + Rhythmus statt Deadline. */}
						<KolInputDate
							_label="Startdatum"
							_type="date"
							_value={startDateValue}
							_on={{
								onChange: (_event, value) => {
									form.current.startDate = value instanceof Date ? startDateToInput(value) : readString(value);
								},
								onInput: (_event, value) => {
									form.current.startDate = value instanceof Date ? startDateToInput(value) : readString(value);
								},
							}}
						/>
						<KolSingleSelect
							_label="Rhythmus"
							_options={RHYTHM_OPTIONS}
							_value={form.current.rhythm}
							_on={{
								onChange: (_event, value) => {
									const next = readString(value);
									if (next === 'daily' || next === 'weekly' || next === 'monthly') {
										form.current.rhythm = next;
									}
								},
							}}
						/>
					</>
				) : (
					<KolInputDate
						_label="Deadline (optional)"
						_type="date"
						_value={deadlineValue}
						_on={{
							onChange: (_event, value) => {
								form.current.deadline = value instanceof Date ? deadlineToDateInput(value) : readString(value);
							},
							onInput: (_event, value) => {
								form.current.deadline = value instanceof Date ? deadlineToDateInput(value) : readString(value);
							},
						}}
					/>
				)}
				<VoiceField
					variant="textarea"
					fieldLabel="Beschreibung"
					onTranscript={(text) => {
						const newVal = form.current.description ? `${form.current.description} ${text}` : text;
						form.current.description = newVal;
						setDescription(newVal);
					}}
				>
					<KolTextarea
						_label="Beschreibung (optional)"
						_rows={4}
						_value={description}
						_on={{
							onInput: (_event, value) => {
								const newVal = readString(value);
								form.current.description = newVal;
								setDescription(newVal);
							},
							onChange: (_event, value) => {
								const newVal = readString(value);
								form.current.description = newVal;
								setDescription(newVal);
							},
						}}
					/>
				</VoiceField>
			</div>
			{/* Säulen-Beiträge: je Säule ein Roh-Anteil 0,0–1,0 (#82), beim Speichern auf 100 % normiert. */}
			<div className="pillar-editor">
				<div className="pillar-editor-head">
					<span className="pillar-editor-label">Säulen (optional)</span>
					<KolButton
						_label={suggesting ? 'Säulen werden vorgeschlagen…' : 'Säulen vorschlagen'}
						_variant="secondary"
						_disabled={saving || suggesting}
						_on={{ onClick: () => void suggestPillars() }}
					/>
				</div>
				{suggesting && (
					<div className="pillar-editor-loading">
						<KolSpin _show _variant="cycle" _label="Säulen-Vorschlag wird geladen" />
					</div>
				)}
				{suggestError !== null && (
					<KolAlert _type="error" _label="Vorschlag fehlgeschlagen">
						{suggestError}
					</KolAlert>
				)}
				{contributions.length === 0 ? (
					<p className="hint">Keine Säule zugeordnet – der Task bleibt wertneutral.</p>
				) : (
					contributions.map((entry) => {
						const name = pillarNameById.get(entry.pillarId) ?? `Säule ${entry.pillarId}`;
						return (
							<div key={entry.pillarId} className="pillar-row">
								<KolInputRange
									_label={`${name} – Anteil: ${formatNumber(entry.share)}`}
									_min={RAW_WEIGHT_MIN}
									_max={RAW_WEIGHT_MAX}
									_step={RAW_WEIGHT_STEP}
									_value={entry.share}
									_on={{
										onInput: (_event, value) => updateContribution(entry.pillarId, { share: readNumber(value) ?? 0 }),
										onChange: (_event, value) => updateContribution(entry.pillarId, { share: readNumber(value) ?? 0 }),
									}}
								/>
								<KolInputRange
									_label={`Konfidenz: ${formatNumber(entry.confidence)} %`}
									_min={0}
									_max={100}
									_step={1}
									_value={entry.confidence}
									_on={{
										onInput: (_event, value) =>
											updateContribution(entry.pillarId, { confidence: readNumber(value) ?? 0 }),
										onChange: (_event, value) =>
											updateContribution(entry.pillarId, { confidence: readNumber(value) ?? 0 }),
									}}
								/>
								<KolButton
									_label={`${name} entfernen`}
									_hideLabel
									_icons={{ left: { icon: 'kolicon-cross' } }}
									_variant="danger"
									_on={{ onClick: () => removePillar(entry.pillarId) }}
								/>
							</div>
						);
					})
				)}
				{availablePillars.length > 0 && (
					<KolSingleSelect
						_label="Säule hinzufügen"
						_hideLabel
						_options={addPillarOptions(availablePillars)}
						_value={ADD_PILLAR_PLACEHOLDER}
						_on={{ onChange: (_event, value) => addPillar(value) }}
					/>
				)}
				{contributions.length > 0 && (
					<p
						className={
							shareValid ? 'pillar-weights-sum pillar-weights-sum-ok' : 'pillar-weights-sum pillar-weights-sum-invalid'
						}
					>
						Summe der Roh-Anteile: {formatNumber(shareSum)}{' '}
						{shareValid ? '✓ (wird auf 100 % normiert)' : '(mindestens eine Säule muss > 0 sein)'}
					</p>
				)}
			</div>
			<div className="modal-actions">
				<KolButton
					_label={saving ? (isEdit ? 'Bearbeiten…' : 'Anlegen…') : isEdit ? 'Bearbeiten' : 'Anlegen'}
					_variant="primary"
					_disabled={saving || suggesting}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</>
	);
};
