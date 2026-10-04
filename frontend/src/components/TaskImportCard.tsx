import { KolAlert, KolBadge, KolButton, KolSingleSelect, KolSpin } from '@public-ui/react-v19';
import type { TaskImportAnalysis, TaskImportMapping, TaskImportPreview, TaskImportResult } from 'client';
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

type ImportSuggestion = TaskImportAnalysis['suggestions'][number];
type ImportDuplicate = TaskImportAnalysis['duplicates'][number];

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
	// Import-Bericht (#1988): Grundform + KI-Vorschläge aus der Analyse nach dem Übernehmen.
	const [analysis, setAnalysis] = useState<TaskImportAnalysis | null>(null);
	const [analysisError, setAnalysisError] = useState<string | null>(null);
	const [suggestions, setSuggestions] = useState<ImportSuggestion[]>([]);
	const [hadSuggestions, setHadSuggestions] = useState(false);
	const [handledDuplicates, setHandledDuplicates] = useState<number[]>([]);
	const [busyKey, setBusyKey] = useState<string | null>(null);
	const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
	// Synchrone Gegenklick-Schutzer: reale Klicks auf kol-button erreichen uns zweifach (KoliBri
	// _on + gebubbleter Host-Klick, s. onClick unten) — der State-Reset ist dafür zu träge.
	const importBusyRef = useRef(false);
	const actionBusyRef = useRef(false);

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
		setAnalysis(null);
		setAnalysisError(null);
		setSuggestions([]);
		setHadSuggestions(false);
		setHandledDuplicates([]);
		setItemErrors({});
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
		if (preview === null || preview.valid === 0 || importBusyRef.current) return;
		importBusyRef.current = true;
		setImporting(true);
		setError(null);
		setAnalysis(null);
		setAnalysisError(null);
		setSuggestions([]);
		setHadSuggestions(false);
		setHandledDuplicates([]);
		setItemErrors({});
		const hasMapping = Object.values(mapping).some((value) => value !== undefined && value !== '');
		const body = hasMapping ? { csv: csvText, mapping } : { csv: csvText };
		try {
			// Erst der Import, dann die Analyse (dieselbe Eingabe, serverseitiges Re-Parsen): Der
			// Bericht zählt die frisch angelegten Aufgaben im Bestand (Dubletten!), darf also erst
			// nach dem Commit lesen. Alert + Bericht rendern gemeinsam (AK1).
			const result = await api.importTasks(body);
			const report = await api.analyzeTaskImport(body).catch(async (reason) => {
				setAnalysisError((await toApiError(reason)).message);
				return null;
			});
			setImported(result);
			if (report !== null) {
				setAnalysis(report);
				setSuggestions(report.suggestions);
				setHadSuggestions(report.suggestions.length > 0);
			}
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			importBusyRef.current = false;
			setImporting(false);
		}
	};

	const mergeDuplicate = async (duplicate: ImportDuplicate): Promise<void> => {
		const key = `dup-${duplicate.duplicateTaskId}-${duplicate.keepTaskId}`;
		if (actionBusyRef.current) return;
		actionBusyRef.current = true;
		setBusyKey(key);
		try {
			await api.mergeTaskImportDuplicate({
				keepTaskId: duplicate.keepTaskId,
				duplicateTaskId: duplicate.duplicateTaskId,
			});
			setHandledDuplicates((prev) => [...prev, duplicate.duplicateTaskId]);
		} catch (reason) {
			const message = (await toApiError(reason)).message;
			setItemErrors((prev) => ({ ...prev, [key]: message }));
		} finally {
			actionBusyRef.current = false;
			setBusyKey(null);
		}
	};

	// Übernehmen läuft durch den bestehenden Dependencies-Endpunkt — Zyklus-Ablehnung (409)
	// erscheint inline am Vorschlag, der Vorschlag bleibt erhalten (AK5).
	const acceptSuggestion = async (suggestion: ImportSuggestion): Promise<void> => {
		const key = `sug-${suggestion.dependentTaskId}-${suggestion.dependingTaskId}`;
		if (actionBusyRef.current) return;
		actionBusyRef.current = true;
		setBusyKey(key);
		try {
			await api.addDependency({
				id: suggestion.dependentTaskId,
				// Default-Gewicht immer mitgeschickt (Muster TaskForm, #1782).
				dependencyInput: { dependingTaskId: suggestion.dependingTaskId, weight: 1 },
			});
			setSuggestions((prev) =>
				prev.filter(
					(entry) =>
						!(
							entry.dependentTaskId === suggestion.dependentTaskId &&
							entry.dependingTaskId === suggestion.dependingTaskId
						),
				),
			);
		} catch (reason) {
			const message = (await toApiError(reason)).message;
			setItemErrors((prev) => ({ ...prev, [key]: message }));
		} finally {
			setBusyKey(null);
		}
	};

	const dismissSuggestion = (suggestion: ImportSuggestion): void => {
		setSuggestions((prev) =>
			prev.filter(
				(entry) =>
					!(
						entry.dependentTaskId === suggestion.dependentTaskId && entry.dependingTaskId === suggestion.dependingTaskId
					),
			),
		);
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
					{analysisError !== null && (
						<KolAlert _type="error" _label="Import-Bericht">
							Der Bericht konnte nicht geladen werden: {analysisError}
						</KolAlert>
					)}
					{analysis !== null && (
						<div className="task-import-report">
							{analysis.missingDeadlines.length > 0 && (
								<section>
									<h4>{`${analysis.missingDeadlines.length} von ${analysis.total} Aufgaben ohne Frist`}</h4>
									<ul className="task-import-report-list">
										{analysis.missingDeadlines.map((task) => (
											<li key={`${task.id}-${task.title}`}>{task.title}</li>
										))}
									</ul>
								</section>
							)}
							{analysis.duplicates.filter((dup) => !handledDuplicates.includes(dup.duplicateTaskId)).length > 0 && (
								<section>
									<h4>Exakte Dubletten</h4>
									<ul className="task-import-report-list">
										{analysis.duplicates
											.filter((dup) => !handledDuplicates.includes(dup.duplicateTaskId))
											.map((duplicate, index) => {
												// Fehler-Schlüssel OHNE Listen-Index (so schreibt ihn der Handler), React-Key MIT.
												const errorKey = `dup-${duplicate.duplicateTaskId}-${duplicate.keepTaskId}`;
												return (
													<li key={`${errorKey}-${index}`} className="task-import-report-item">
														{/* Typ-Marker nie über Farbe allein (WCAG 1.4.1, KI-UX). */}
														<KolBadge _label="Dublette" />
														<span className="task-import-report-title">{duplicate.title}</span>
														<span className="task-import-report-reason">{duplicate.reason}</span>
														{itemErrors[errorKey] && (
															<KolAlert _type="error" _label="Zusammenführen fehlgeschlagen">
																{itemErrors[errorKey]}
															</KolAlert>
														)}
														<KolButton
															_label={`Dublette ‚${duplicate.title}‘ zusammenführen`}
															_variant="secondary"
															_disabled={busyKey !== null}
															_on={{ onClick: () => void mergeDuplicate(duplicate) }}
															onClick={() => void mergeDuplicate(duplicate)}
														/>
													</li>
												);
											})}
									</ul>
								</section>
							)}
							{(suggestions.length > 0 || hadSuggestions) && (
								<section>
									<h4>Abhängigkeits-Vorschläge</h4>
									{suggestions.length === 0 ? (
										<p>Alle Vorschläge bearbeitet.</p>
									) : (
										<ul className="task-import-report-list">
											{suggestions.map((suggestion, index) => {
												const errorKey = `sug-${suggestion.dependentTaskId}-${suggestion.dependingTaskId}`;
												return (
													<li key={`${errorKey}-${index}`} className="task-import-report-item">
														<KolBadge _label="Vorschlag" />
														<span className="task-import-report-title">{suggestion.title}</span>
														<span className="task-import-report-reason">{suggestion.reason}</span>
														{itemErrors[errorKey] && (
															<KolAlert _type="error" _label="Übernehmen fehlgeschlagen">
																{itemErrors[errorKey]}
															</KolAlert>
														)}
														<div className="task-import-report-actions">
															<KolButton
																_label={`Abhängigkeit ‚${suggestion.title}‘ übernehmen`}
																_variant="secondary"
																_disabled={busyKey !== null}
																_on={{ onClick: () => void acceptSuggestion(suggestion) }}
																onClick={() => void acceptSuggestion(suggestion)}
															/>
															<KolButton
																_label={`Abhängigkeit ‚${suggestion.title}‘ verwerfen`}
																_variant="secondary"
																_disabled={busyKey !== null}
																_on={{ onClick: () => dismissSuggestion(suggestion) }}
																onClick={() => dismissSuggestion(suggestion)}
															/>
														</div>
													</li>
												);
											})}
										</ul>
									)}
								</section>
							)}
						</div>
					)}
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
								onClick={() => void confirmImport()}
							/>
						</div>
					)}
				</>
			)}
		</section>
	);
};
