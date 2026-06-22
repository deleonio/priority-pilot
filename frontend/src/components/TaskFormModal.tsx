import {
	KolAlert,
	KolButton,
	KolInputDate,
	KolInputNumber,
	KolInputRange,
	KolInputText,
	KolSingleSelect,
	KolSpin,
	KolTextarea,
} from '@public-ui/react-v19';
import type { Pillar, Task, TaskCreate, TaskPillarContribution, TaskUpdate } from 'client';
import { TaskStatus } from 'client';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readNumber, readString } from '../lib/inputValue';
import {
	ADD_PILLAR_PLACEHOLDER,
	addPillarOptions,
	isWeightSumValid,
	suggestionsToContributions,
	sumWeights,
	TOTAL_WEIGHT,
} from '../lib/pillar';
import { STATUS_OPTIONS, deadlineToDateInput, formatNumber } from '../lib/task';
import { Modal } from './Modal';

interface TaskFormModalProps {
	/** Zu bearbeitender Task; `null` legt einen neuen Task an. */
	task: Task | null;
	/**
	 * Beim Anlegen optional die Eltern-Aufgabe: Die neue Aufgabe wird nach dem Speichern als deren
	 * Vorgänger verknüpft (Unteraufgabe über das bestehende Abhängigkeits-/Aufgabenwald-Konzept).
	 */
	parentTask?: Task | null;
	/** Verfügbare Lebensbalance-Säulen für die Zuordnung (`GET /pillars`). */
	pillars: Pillar[];
	onClose: () => void;
	/** Nach erfolgreichem Speichern aufgerufen (Liste neu laden + Dialog schließen). */
	onSaved: () => void;
}

export const TaskFormModal = ({ task, parentTask = null, pillars, onClose, onSaved }: TaskFormModalProps) => {
	const isEdit = task !== null;

	// Eingaben in Refs halten: KoliBri-Inputs verwalten ihren Anzeigewert selbst, daher kein
	// erneutes Rendern (und kein Cursor-Springen) pro Tastendruck. Validierung beim Absenden.
	// `priority`/`estimatedEffort` dürfen `null` sein: ein geleertes Zahlenfeld setzt den Ref auf
	// `null`, damit die Validierung greift (statt still den alten Wert weiterzuverwenden).
	const form = useRef<{
		title: string;
		status: TaskStatus;
		priority: number | null;
		estimatedEffort: number | null;
		description: string;
		deadline: string;
	}>({
		title: task?.title ?? '',
		status: task?.status ?? TaskStatus.Open,
		priority: task?.priority ?? 3,
		estimatedEffort: task?.estimatedEffort ?? 0.5,
		description: task?.description ?? '',
		deadline: deadlineToDateInput(task?.deadline),
	});

	// Säulen-Beiträge im State (nicht im Ref): Hinzufügen/Entfernen und die Anteils-/Konfidenz-Slider
	// müssen neu rendern (Live-Summe). Slider verursachen — anders als Textfelder — kein Cursor-Springen.
	const [contributions, setContributions] = useState<TaskPillarContribution[]>(() =>
		(task?.pillars ?? []).map((entry) => ({ ...entry })),
	);

	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	// KI-Säulen-Vorschlag: eigener Lade-/Fehlerzustand, damit ein Vorschlags-Fehler den Speichern-Fluss
	// nicht stört (und umgekehrt).
	const [suggesting, setSuggesting] = useState(false);
	const [suggestError, setSuggestError] = useState<string | null>(null);

	// Merkt sich, ob in diesem Dialog ein KI-Vorschlag übernommen wurde. Nur dann ist das spätere
	// Speichern eine echte Bestätigung/Korrektur, die den Feedback-Loop füttert (#45). Ein Ref reicht:
	// der Wert beeinflusst kein Rendern und der Dialog schließt nach dem Speichern.
	const suggestionApplied = useRef(false);

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
	const shareSumValid = isWeightSumValid(shareSum);

	const updateContribution = (pillarId: number, patch: Partial<TaskPillarContribution>): void =>
		setContributions((prev) => prev.map((entry) => (entry.pillarId === pillarId ? { ...entry, ...patch } : entry)));

	const addPillar = (raw: unknown): void => {
		const id = readNumber(raw);
		if (id === null || id === ADD_PILLAR_PLACEHOLDER || contributions.some((entry) => entry.pillarId === id)) {
			return;
		}
		// Neuer Beitrag erhält den noch fehlenden Anteil — so wird der erste Beitrag automatisch 100 %.
		const remaining = Math.max(0, TOTAL_WEIGHT - shareSum);
		setContributions((prev) => [...prev, { pillarId: id, share: remaining, confidence: 100 }]);
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
			setContributions(next);
			suggestionApplied.current = true;
		} catch (reason) {
			const apiError = await toApiError(reason);
			setSuggestError(apiError.message);
		} finally {
			setSuggesting(false);
		}
	};

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
		// Bei mindestens einer Säule müssen sich die Anteile zu 100 % summieren (siehe Server-Vertrag).
		if (contributions.length > 0 && !isWeightSumValid(sumWeights(contributions.map((entry) => entry.share)))) {
			setError(`Die Anteile der Säulen müssen zusammen ${TOTAL_WEIGHT} % ergeben.`);
			return;
		}

		setError(null);
		setSaving(true);
		try {
			const pillars = contributions.map((entry) => ({ ...entry }));
			if (isEdit) {
				const taskUpdate: TaskUpdate = {
					title,
					status: form.current.status,
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
					status: form.current.status,
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

	// Liefert für `KolInputDate._value` nur ein valides `Date` (UTC) oder `undefined`, damit bei
	// unvollständiger Eingabe kein `Invalid Date` an die Komponente gereicht wird.
	const deadlineValue = ((): Date | undefined => {
		if (form.current.deadline === '') {
			return undefined;
		}
		const parsed = new Date(`${form.current.deadline}T00:00:00Z`);
		return Number.isNaN(parsed.getTime()) ? undefined : parsed;
	})();

	return (
		<Modal
			title={
				isEdit
					? `Task bearbeiten: ${task.title}`
					: parentTask !== null
						? `Unteraufgabe zu #${parentTask.id} – ${parentTask.title}`
						: 'Neuen Task anlegen'
			}
			onClose={onClose}
		>
			{error !== null && (
				<KolAlert _type="error" _label="Speichern fehlgeschlagen">
					{error}
				</KolAlert>
			)}
			<div className="form-grid">
				<KolInputText
					_label="Titel"
					_required
					_value={form.current.title}
					_on={{
						onInput: (_event, value) => {
							form.current.title = readString(value);
						},
						onChange: (_event, value) => {
							form.current.title = readString(value);
						},
					}}
				/>
				<KolSingleSelect
					_label="Status"
					_options={STATUS_OPTIONS}
					_value={form.current.status}
					_on={{
						onChange: (_event, value) => {
							const next = readString(value);
							if (next === TaskStatus.Open || next === TaskStatus.InProcess || next === TaskStatus.Done) {
								form.current.status = next;
							}
						},
					}}
				/>
				<KolInputNumber
					_label="Priorität (Ganzzahl 1–5)"
					_min={1}
					_max={5}
					_step={1}
					_value={form.current.priority ?? undefined}
					_on={{
						onInput: (_event, value) => {
							form.current.priority = readNumber(value);
						},
						onChange: (_event, value) => {
							form.current.priority = readNumber(value);
						},
					}}
				/>
				<KolInputNumber
					_label="Geschätzter Aufwand in Tagen (0,1–1)"
					_min={0.1}
					_max={1}
					_step={0.1}
					_value={form.current.estimatedEffort ?? undefined}
					_on={{
						onInput: (_event, value) => {
							form.current.estimatedEffort = readNumber(value);
						},
						onChange: (_event, value) => {
							form.current.estimatedEffort = readNumber(value);
						},
					}}
				/>
				<KolInputDate
					_label="Deadline (optional)"
					_type="date"
					_value={deadlineValue}
					_on={{
						onChange: (_event, value) => {
							form.current.deadline = readString(value);
						},
						onInput: (_event, value) => {
							form.current.deadline = readString(value);
						},
					}}
				/>
				<KolTextarea
					_label="Beschreibung (optional)"
					_rows={4}
					_value={form.current.description}
					_on={{
						onInput: (_event, value) => {
							form.current.description = readString(value);
						},
						onChange: (_event, value) => {
							form.current.description = readString(value);
						},
					}}
				/>
			</div>
			{/* Säulen-Beiträge: der Task verteilt 100 % seines Anteils auf 0..n Säulen, je mit Konfidenz. */}
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
									_label={`${name} – Anteil: ${formatNumber(entry.share)} %`}
									_min={0}
									_max={100}
									_step={1}
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
							shareSumValid
								? 'pillar-weights-sum pillar-weights-sum-ok'
								: 'pillar-weights-sum pillar-weights-sum-invalid'
						}
					>
						Summe der Anteile: {formatNumber(shareSum)} % {shareSumValid ? '✓' : `(Soll: ${TOTAL_WEIGHT} %)`}
					</p>
				)}
			</div>
			<div className="modal-actions">
				<KolButton
					_label={saving ? 'Speichern…' : 'Speichern'}
					_variant="primary"
					_disabled={saving || suggesting}
					_on={{ onClick: () => void submit() }}
				/>
				<KolButton _label="Abbrechen" _variant="secondary" _disabled={saving} _on={{ onClick: () => onClose() }} />
			</div>
		</Modal>
	);
};
