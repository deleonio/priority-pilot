import { KolAlert, KolButton, KolSingleSelect, KolSpin } from '@public-ui/react-v19';
import type { TaskImportMapping, TaskImportPreview, TaskImportResult } from 'client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';

/**
 * CSV-Import (#1969): Datei wählen → Vorschau (Zahlen mit Kontext, Beispiele, Fehlerliste,
 * Spalten-Mapping) → Übernehmen. Der Ablauf ist dreigeteilt (KI-UX: ein Screen, eine Aufgabe),
 * die Fehlerliste ist dauerhaft sichtbar (kein Toast), der Bestätigungs-Button trägt die Anzahl
 * als Kontext („N Aufgaben übernehmen"). Texte bewusst hardcoded Deutsch wie die umgebende
 * SettingsPage (noch nicht i18n).
 *
 * Die Datei wird clientseitig gelesen und als String gesendet (kein multipart, Muster-Entscheidung
 * der Analyse). KoliBri bietet kein Datei-Input mit erreichbarem nativen Feld für Unit-Tests —
 * deshalb KolButton + visuell verstecktes natives input (KI-UX-Ausnahme mit Begründung).
 */
const MAPPING_FIELDS: Array<{ key: keyof TaskImportMapping; label: string }> = [
	{ key: 'title', label: 'Titel' },
	{ key: 'deadline', label: 'Frist' },
	{ key: 'priority', label: 'Priorität' },
	{ key: 'category', label: 'Kategorie' },
	{ key: 'pillar', label: 'Säule' },
];

const UNMAPPED_FIELD_LABEL: Record<string, string> = { category: 'Kategorie', pillar: 'Säule' };

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

export const TaskImportCard = () => {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const previewHeadingRef = useRef<HTMLHeadingElement>(null);
	const successRef = useRef<HTMLDivElement>(null);
	const [csvText, setCsvText] = useState('');
	const [mapping, setMapping] = useState<TaskImportMapping>({});
	const [preview, setPreview] = useState<TaskImportPreview | null>(null);
	const [loadingPreview, setLoadingPreview] = useState(false);
	const [importing, setImporting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [imported, setImported] = useState<TaskImportResult | null>(null);

	// KI-UX Fokus-Management: nach dem Rendern der Vorschau auf deren Überschrift, nach dem
	// Übernehmen auf die Erfolgs-Meldung — nicht still am Seitenanfang landen.
	useEffect(() => {
		if (preview !== null) previewHeadingRef.current?.focus();
	}, [preview]);

	useEffect(() => {
		if (imported !== null) successRef.current?.focus();
	}, [imported]);

	const runPreview = useCallback(async (csv: string, nextMapping: TaskImportMapping): Promise<void> => {
		setLoadingPreview(true);
		setError(null);
		setImported(null);
		const hasMapping = Object.values(nextMapping).some((value) => value !== undefined && value !== '');
		try {
			setPreview(await api.previewTaskImport(hasMapping ? { csv, mapping: nextMapping } : { csv }));
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setLoadingPreview(false);
		}
	}, []);

	const onFileChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
		const file = event.target.files?.[0];
		if (!file) return;
		// Value zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
		event.target.value = '';
		const reader = new FileReader();
		reader.onload = () => {
			const csv = String(reader.result ?? '');
			setCsvText(csv);
			setMapping({});
			void runPreview(csv, {});
		};
		reader.readAsText(file);
	};

	const changeMapping = (field: keyof TaskImportMapping, value: string): void => {
		const next = { ...mapping, [field]: value };
		setMapping(next);
		void runPreview(csvText, next);
	};

	const confirmImport = async (): Promise<void> => {
		if (preview === null || preview.valid === 0 || importing) return;
		setImporting(true);
		setError(null);
		const hasMapping = Object.values(mapping).some((value) => value !== undefined && value !== '');
		try {
			setImported(await api.importTasks(hasMapping ? { csv: csvText, mapping } : { csv: csvText }));
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setImporting(false);
		}
	};

	const selectOptions =
		preview === null
			? []
			: [
					{ label: '— automatisch —', value: '' },
					...(preview.columns ?? []).map((column) => ({ label: column, value: column })),
				];

	return (
		<section className="task-import-card">
			<input
				ref={fileInputRef}
				type="file"
				accept=".csv,text/csv"
				className="visually-hidden"
				aria-label="CSV-Datei auswählen"
				onChange={onFileChange}
			/>
			{imported !== null ? (
				<div ref={successRef} tabIndex={-1} className="task-import-success">
					<KolAlert _type="success" _label="Import abgeschlossen">
						{imported.created} Aufgaben übernommen
						{imported.errors.length > 0 ? `, ${imported.errors.length} Zeilen übersprungen` : ''}.
					</KolAlert>
				</div>
			) : (
				<>
					<p className="task-import-hint">
						Aufgaben aus einer Todoist-Export-CSV oder einer eigenen CSV-Datei übernehmen. Die Vorschau zeigt vor der
						Übernahme, welche Zeilen angelegt werden.
					</p>
					<KolButton
						_label={csvText === '' ? 'CSV-Datei auswählen' : 'Andere Datei auswählen'}
						_variant="secondary"
						_on={{ onClick: () => fileInputRef.current?.click() }}
					/>
					{loadingPreview && <KolSpin _show _variant="cycle" _label="Vorschau wird erstellt" />}
					{!loadingPreview && error !== null && (
						<KolAlert _type="error" _label="Import fehlgeschlagen">
							{error}
						</KolAlert>
					)}
					{!loadingPreview && error === null && preview !== null && (
						<div className="task-import-preview">
							<h3 ref={previewHeadingRef} tabIndex={-1} className="task-import-preview-heading">
								Vorschau
							</h3>
							<p>
								{preview.valid} von {preview.total} Zeilen
								{preview.skippedNonTask > 0 ? `, ${preview.skippedNonTask} keine Aufgaben` : ''} übernehmen.
							</p>
							{preview.samples.length > 0 && (
								<div>
									<h4>Beispiele</h4>
									<ul className="task-import-samples">
										{preview.samples.map((sample) => (
											<li key={sample.row}>
												{sample.title}
												{sample.deadline !== null && ` · ${formatDate(sample.deadline)}`} · Priorität {sample.priority}
											</li>
										))}
									</ul>
								</div>
							)}
							{preview.errors.length > 0 && (
								<div>
									<h4>Nicht übernommene Zeilen</h4>
									<ul className="task-import-errors">
										{preview.errors.map((rowError) => (
											<li key={rowError.row}>
												Zeile {rowError.row}: {rowError.reason}
											</li>
										))}
									</ul>
								</div>
							)}
							{preview.unmapped.length > 0 && (
								<div>
									<h4>Ohne Zuordnung</h4>
									<ul className="task-import-unmapped">
										{preview.unmapped.map((entry) => (
											<li key={`${entry.row}-${entry.field}`}>
												Zeile {entry.row}: {UNMAPPED_FIELD_LABEL[entry.field] ?? entry.field} „{entry.value}“ ist
												unbekannt und bleibt ohne Zuordnung.
											</li>
										))}
									</ul>
								</div>
							)}
							<div className="task-import-mapping">
								{MAPPING_FIELDS.map(({ key, label }) => (
									<KolSingleSelect
										key={key}
										_label={label}
										_options={selectOptions}
										_value={mapping[key] ?? ''}
										_on={{ onChange: (_event, value) => changeMapping(key, readString(value)) }}
									/>
								))}
							</div>
							<KolButton
								_label={`${preview.valid} Aufgaben übernehmen`}
								_variant="primary"
								_disabled={preview.valid === 0 || importing}
								_on={{ onClick: () => void confirmImport() }}
							/>
						</div>
					)}
				</>
			)}
		</section>
	);
};
