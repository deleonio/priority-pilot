import {
	KolAlert,
	KolButton,
	KolDetails,
	KolHeading,
	KolInputDate,
	KolSingleSelect,
	KolSpin,
	KolTextarea,
} from '@public-ui/react-v19';
import type { JournalEntry, Pillar } from 'client';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { DESCRIPTION_MAX_LENGTH } from '../lib/descriptionLengthValidation';
import { formatDate, readDate, toDateValue, today } from '../lib/journalDate';
import { readString } from '../lib/inputValue';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { JournalStats } from './JournalStats';

type Draft = { text: string; date: string; pillarId: string };

/**
 * Erfassungs- und Bearbeitungsformular eines Eintrags: Freitext (Pflicht, Zähler bis 3000), Datum,
 * Säule optional mit „Keine Säule" als erster Option (KI-UX #2212).
 */
const JournalForm = ({
	initial,
	pillars,
	textLabel,
	submitLabel,
	onSubmit,
	onCancel,
}: {
	initial: Draft;
	pillars: Pillar[];
	textLabel: string;
	submitLabel: string;
	onSubmit: (draft: Draft) => Promise<void>;
	onCancel?: () => void;
}) => {
	const [draft, setDraft] = useState<Draft>(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const pillarOptions = [
		{ label: 'Keine Säule', value: '' },
		...pillars.map((pillar) => ({ label: pillar.name, value: String(pillar.id) })),
	];

	const submit = async (): Promise<void> => {
		if (draft.text.trim() === '') {
			setError('Bitte einen Text eingeben.');
			return;
		}
		setError(null);
		setBusy(true);
		try {
			await onSubmit(draft);
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="journal-form">
			<KolTextarea
				_label={textLabel}
				_rows={4}
				_maxLength={DESCRIPTION_MAX_LENGTH}
				_hasCounter
				_required
				_value={draft.text}
				_on={{ onInput: (_event, value) => setDraft((previous) => ({ ...previous, text: readString(value) })) }}
			/>
			<KolInputDate
				_label="Datum"
				_type="date"
				_value={toDateValue(draft.date)}
				_on={{ onChange: (_event, value) => setDraft((previous) => ({ ...previous, date: readDate(value) })) }}
			/>
			<KolSingleSelect
				_label="Säule (optional)"
				_options={pillarOptions}
				_value={draft.pillarId}
				_on={{ onChange: (_event, value) => setDraft((previous) => ({ ...previous, pillarId: readString(value) })) }}
			/>
			{error !== null && (
				<KolAlert _type="error" _label="Fehler">
					{error}
				</KolAlert>
			)}
			<div className="journal-form__actions">
				<KolButton _label={submitLabel} _variant="primary" _disabled={busy} _on={{ onClick: () => void submit() }} />
				{onCancel !== undefined && <KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: onCancel }} />}
			</div>
		</div>
	);
};

/**
 * Haupt-Tab „Journal" (#2212): Formular „Neuer Eintrag" oben, Liste der eigenen Einträge darunter
 * (neueste zuerst). Bearbeiten inline im Eintrag, Löschen über `ConfirmDeleteDialog`
 * (`docs/ux-pattern-sequential-confirmation.md`). Die Liste folgt den Server-Antworten ohne Reload.
 */
export const JournalTab = ({ pillars }: { pillars: Pillar[] }) => {
	const [entries, setEntries] = useState<JournalEntry[] | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	// Schlüssel des Erfassungsformulars — ein Wechsel leert es nach dem Speichern.
	const [formKey, setFormKey] = useState(0);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null);
	const listHeadingRef = useRef<HTMLDivElement>(null);

	// #2399: Hochzählen lädt die Liste neu (Rückkehr in den Vordergrund).
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		const onVisibility = () => {
			if (document.visibilityState === 'visible') setRefreshKey((key) => key + 1);
		};
		document.addEventListener('visibilitychange', onVisibility);
		return () => document.removeEventListener('visibilitychange', onVisibility);
	}, []);

	useEffect(() => {
		let active = true;
		api
			.listJournalEntries()
			.then((list) => {
				if (active) setEntries(list);
			})
			.catch(() => {
				if (active) setLoadError('Die Einträge konnten nicht geladen werden. Bitte lade die Seite neu.');
			});
		return () => {
			active = false;
		};
	}, [refreshKey]);

	/** Neueste zuerst, wie `GET /journal` (Datum absteigend, bei Gleichstand jüngere Id zuerst). */
	const sorted = (list: JournalEntry[]): JournalEntry[] =>
		[...list].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

	const toBody = (draft: Draft) => ({
		text: draft.text,
		date: draft.date,
		pillarId: draft.pillarId === '' ? null : Number(draft.pillarId),
	});

	const pillarName = (pillarId: number | null): string | undefined =>
		pillars.find((pillar) => pillar.id === pillarId)?.name;

	return (
		<section className="journal">
			<KolHeading _label="Journal" _level={2} />
			<KolHeading _label="Neuer Eintrag" _level={3} />
			<JournalForm
				key={formKey}
				initial={{ text: '', date: today(), pillarId: '' }}
				pillars={pillars}
				textLabel="Eintrag"
				submitLabel="Eintrag speichern"
				onSubmit={async (draft) => {
					const created = await api.createJournalEntry(toBody(draft));
					setEntries((previous) => sorted([...(previous ?? []), created]));
					setFormKey((key) => key + 1);
					setSaved(true);
				}}
			/>
			{saved && <KolAlert _type="success" _label="Eintrag gespeichert" />}

			<div ref={listHeadingRef} tabIndex={-1}>
				<KolHeading _label="Einträge" _level={3} />
			</div>
			{loadError !== null && (
				<KolAlert _type="error" _label="Fehler">
					{loadError}
				</KolAlert>
			)}
			{entries === null && loadError === null && <KolSpin _show _variant="cycle" _label="Einträge werden geladen" />}
			{entries !== null && entries.length === 0 && <p>Noch kein Eintrag. Halte fest, was dich heute bewegt hat.</p>}
			{entries !== null && entries.length > 0 && (
				<ul className="journal__list">
					{entries.map((entry) => {
						const dateText = formatDate(entry.date);
						const name = pillarName(entry.pillarId);
						return (
							<li key={entry.id} className="journal__item">
								{editingId === entry.id ? (
									<JournalForm
										initial={{
											text: entry.text,
											date: entry.date,
											pillarId: entry.pillarId === null ? '' : String(entry.pillarId),
										}}
										pillars={pillars}
										textLabel={`Eintrag vom ${dateText}`}
										submitLabel="Speichern"
										onCancel={() => setEditingId(null)}
										onSubmit={async (draft) => {
											const updated = await api.updateJournalEntry(entry.id, toBody(draft));
											setEntries((previous) =>
												sorted((previous ?? []).map((item) => (item.id === updated.id ? updated : item))),
											);
											setEditingId(null);
										}}
									/>
								) : (
									<>
										<p className="journal__meta">
											{dateText}
											{name !== undefined && ` · ${name}`}
										</p>
										<p className="journal__text">{entry.text}</p>
										<div className="journal-form__actions">
											<KolButton
												_label={`Eintrag vom ${dateText} bearbeiten`}
												_hideLabel
												_icons="fa-solid fa-pen"
												_variant="secondary"
												_on={{ onClick: () => setEditingId(entry.id) }}
											/>
											<KolButton
												_label={`Eintrag vom ${dateText} löschen`}
												_hideLabel
												_icons="fa-solid fa-trash"
												_variant="danger"
												_on={{ onClick: () => setDeleteTarget(entry) }}
											/>
										</div>
									</>
								)}
							</li>
						);
					})}
				</ul>
			)}

			<KolDetails _label="Statistik">
				<JournalStats pillars={pillars} />
			</KolDetails>

			{deleteTarget !== null && (
				<ConfirmDeleteDialog
					title="Eintrag löschen"
					body={<p>Wirklich löschen? Der Eintrag lässt sich nicht wiederherstellen.</p>}
					confirmLabel="Endgültig löschen"
					onConfirm={() => api.deleteJournalEntry({ id: deleteTarget.id })}
					onClose={() => setDeleteTarget(null)}
					onDeleted={() => {
						setEntries((previous) => (previous ?? []).filter((item) => item.id !== deleteTarget.id));
						setDeleteTarget(null);
					}}
					fallbackFocusRef={listHeadingRef}
				/>
			)}
		</section>
	);
};
