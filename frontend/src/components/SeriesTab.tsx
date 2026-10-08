import { KolAlert, KolBadge, KolSpin, KolToolbar } from '@public-ui/react-v19';
import type { Category, Pillar, Series, Task } from 'client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';
import { toApiError } from '../lib/apiError';
import { CategoryBadge } from './CategoryBadge';
import { DeleteSeriesDialog } from './DeleteSeriesDialog';
import { GeoBadge } from './GeoBadge';
import { Modal } from './Modal';
import { PillarMissingBadge } from './PillarMissingBadge';
import { SeriesInstanceDialog } from './SeriesInstanceDialog';
import { TaskForm } from './TaskForm';

interface SeriesTabProps {
	/** Verfügbare Lebensbalance-Säulen für die Serien-Zuordnung im eingebetteten `TaskForm`. */
	pillars: Pillar[];
	/** Verfügbare Kategorien — für das Badge in der Liste und die Auswahl im eingebetteten `TaskForm`. */
	categories?: Category[];
	/**
	 * Signal an die App, dass sich der Aufgabenbestand geändert hat: generierte Instanzen, eine
	 * gelöschte Serie (die Kaskade entfernt offene Instanzen) oder eine Template-Änderung, die offene
	 * Instanzen mitzieht (`applyToInstances`). Ohne dieses Signal blieben `tasks`/`forest` in `App`
	 * auf dem Stand des Seitenaufrufs stehen — der Tab-Wechsel lädt nicht nach —, und die frisch
	 * materialisierten Instanzen fehlten im Aufgaben-Tab bis zum nächsten Seiten-Reload. Muster:
	 * `onReloaded` in `CompletedTasksTable`.
	 */
	onTasksChanged?: () => void;
}

/** Serie, die aktuell im Bearbeiten-Modal (`TaskForm` im Serie-Modus) geöffnet ist. */
type EditDialog = { series: Series } | null;

const RHYTHM_LABEL: Record<Series['rhythm'], string> = {
	daily: 'Täglich',
	weekly: 'Wöchentlich',
	monthly: 'Monatlich',
	weekdays: 'Werktags',
	weekend: 'Wochenende',
	mon: 'Montags',
	tue: 'Dienstags',
	wed: 'Mittwochs',
	thu: 'Donnerstags',
	fri: 'Freitags',
	sat: 'Samstags',
	sun: 'Sonntags',
	none: 'Ohne Rhythmus',
};

/**
 * Serien-Verwaltung als eigener Tab „Serien" (#335): löst das frühere `SeriesManagementModal` (Einstieg
 * über den Header-Button „Serien verwalten") ab. Analog zum `TaskTree` listet der Tab alle Serien-
 * Templates (`GET /series`) im Baum-Stil (`series-tree` als Wurzelcontainer, `series-tree-item-<id>` je
 * Serie) mit Titel, Rhythmus-Badge und einer Aktions-Toolbar (Bearbeiten/Löschen). „Bearbeiten" öffnet
 * `TaskForm` im Serie-Modus (#297) in einem Modal; „Löschen" entfernt die Serie. Die fälligen
 * Instanzen legt der tägliche Server-Job an (#2356). Das Anlegen neuer Serien läuft über den
 * vereinheitlichten Einstieg „Neuen Task anlegen" (QuickCapture, #330).
 */
export const SeriesTab = ({ pillars, categories = [], onTasksChanged }: SeriesTabProps) => {
	const [series, setSeries] = useState<Series[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [editDialog, setEditDialog] = useState<EditDialog>(null);
	// Zu löschende Serie (Öffnet den `DeleteSeriesDialog`, #472). `null` = kein Lösch-Dialog offen.
	const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);
	// Fallback-Fokusziel nach erfolgreicher Serien-Löschung (#182, #472): Nach dem Löschen fällt die
	// Toolbar-Zeile der Serie aus dem DOM, sodass der Trigger-Button kein Fokus-Ziel mehr ist. Analog
	// zu App.tsx / PillarList.tsx (`deleteFallbackRef`) halten wir einen stabilen Container bereit.
	const deleteFallbackRef = useRef<HTMLElement>(null);
	// #2359: Serie, aus der gerade eine Aufgabe angelegt wird (Dialog offen), und die Erfolgsrückmeldung.
	const [instanceTarget, setInstanceTarget] = useState<Series | null>(null);
	const [createdTitle, setCreatedTitle] = useState<string | null>(null);

	const reload = useCallback(async (signal?: AbortSignal): Promise<void> => {
		try {
			const loaded = await api.listSeries({ signal });
			setSeries(loaded);
			setError(null);
		} catch (reason) {
			if (signal?.aborted === true) {
				return;
			}
			const apiError = await toApiError(reason);
			setError(apiError.message);
		}
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		void reload(controller.signal);
		return () => controller.abort();
	}, [reload]);

	// Serien-Tab laedt seine Liste selbst (Kaltstart-Ersparnis, Muster TaskGraphPanel) und hoert auf
	// den App-weiten Aenderungs-Signal: Eine neu angelegte Vorlage (aus dem Task-Formular, #2361)
	// erscheint damit ohne Seiten-Reload im Tab "Serien & Vorlagen" (AK2).
	useEffect(() => {
		const onTasksChanged = (): void => void reload();
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, [reload]);

	/** Nach dem Speichern: Modal schließen und die Liste neu laden. */
	const afterSaved = useCallback((): void => {
		setEditDialog(null);
		void reload();
		// Eine Template-Änderung kann offene Instanzen mitziehen (`applyToInstances`, Kaskade in
		// PATCH /series) — die App muss ihren Aufgabenbestand daher ebenfalls neu holen.
		onTasksChanged?.();
	}, [reload, onTasksChanged]);

	const handleCreated = useCallback(
		(task: Task): void => {
			setInstanceTarget(null);
			setCreatedTitle(task.title);
			// Die neue Aufgabe steht sofort in der Aufgabenliste der App.
			onTasksChanged?.();
		},
		[onTasksChanged],
	);

	const handleDeleted = useCallback((): void => {
		setDeleteTarget(null);
		void reload();
		// Die Lösch-Kaskade entfernt die offenen Instanzen der Serie (series.cascade) — die App zeigt
		// sie sonst weiter in der Aufgabenliste an.
		onTasksChanged?.();
	}, [reload, onTasksChanged]);

	return (
		<section className="series-section" ref={deleteFallbackRef} tabIndex={-1}>
			{error !== null && (
				<KolAlert _type="error" _label="Aktion fehlgeschlagen">
					{error}
				</KolAlert>
			)}

			{createdTitle !== null && <KolAlert _type="success" _alert _label={`Aufgabe angelegt: ${createdTitle}`} />}

			{series === null && (
				<div className="loading">
					<KolSpin _show _variant="cycle" _label="Lädt" />
					<span>Lade Serien…</span>
				</div>
			)}

			{series !== null && (
				<ul className="series-tree" data-testid="series-tree">
					{series.length === 0 && (
						<li className="series-tree-hint">
							Noch keine Serie angelegt. Lege eine neue Serie über „Neuen Task anlegen" an.
						</li>
					)}
					{series.map((entry) => (
						<li key={entry.id} className="series-tree-item" data-testid={`series-tree-item-${entry.id}`}>
							<div className="series-tree-row">
								{/* Zeilenstruktur analog `TaskTree` (#1258-Zweizeilen-Modell): Titel + Geo-Badge im
								    Header, Badges + Aktions-Toolbar in den Controls — mobil (<48rem) Zeile 2 in
								    voller Breite (Badges links, Toolbar rechtsbündig), ab 48rem alles einzeilig
								    neben dem Titel (#1259). */}
								<div className="series-tree-row-header">
									<span className="series-tree-title">{entry.title}</span>
									{(entry.latitude != null || entry.address != null) && (
										<GeoBadge
											latitude={entry.latitude ?? null}
											longitude={entry.longitude ?? null}
											address={entry.address}
										/>
									)}
								</div>
								<div className="series-tree-row-controls">
									<div className="series-tree-badges">
										{/* Rhythmus als KolBadge (Muster „Serie“-Badge im TaskTree, #1258) statt roher Span:
										    alle Badges einer Zeile stammen aus einem System (KoliBri-first, DESIGN.md) —
										    gleiche Höhe, gleicher Radius, Kontrast rechnet KoliBri selbst (_color). */}
										{entry.rhythm !== 'none' && (
											<KolBadge _label={RHYTHM_LABEL[entry.rhythm]} _color="#005b99" className="series-tree-badge" />
										)}
										<CategoryBadge category={categories.find((category) => category.id === entry.categoryId)} />
										{/* #1251 (AK6): Stillgelegte Serie (active:false, entsteht durch Gruppenaustritt/
										    -löschung) — Text-Badge statt nur Farbe (KI-UX, WCAG 1.4.1). Kein Toggle:
										    Reaktivieren wäre ein eigenes Ticket; die Toolbar bleibt (nicht sperren). */}
										{/* #2358 (AK6): Serie ohne Automatik = Vorlage — Text-Badge, analog „Ruhend". */}
										{entry.autoCreate === false && <KolBadge _label="Vorlage" className="series-tree-badge" />}
										{entry.active === false && <KolBadge _label="Ruhend" className="series-tree-badge" />}
										{/* #1465: Säulen-Badge am Serien-Eintrag, analog TaskTree — die Vorlage zahlt auf
										    keine Säule ein, also tun es auch ihre Instanzen nicht. Löst das
										    beschreibungs-getriebene „Hinweis"-Badge aus #1430 ab. */}
										{pillars.length > 0 && (entry.pillars ?? []).length === 0 && <PillarMissingBadge />}
										{/* #1222: Empfänger-Kennzeichen für den Ersteller (Muster „Für: …" im TaskTree,
										    #1213). Der Empfänger selbst sieht kein Kennzeichen — für ihn ist die Serie
										    eine eigene. */}
										{entry.forUserName != null && (
											<KolBadge
												_label={`Für: ${entry.forUserName}`}
												className="series-tree-badge series-tree-badge--provenance"
											/>
										)}
									</div>
									{/* #1222 (AK6): Eine fremde Serie (vom eigenen Konto für ein anderes Mitglied
									    angelegt) ist schreibgeschützt — die Toolbar würde nur in die 404-Sackgasse
									    führen und bleibt deshalb ungerendert (keine Geister-Fokusziele). */}
									{entry.forUserId == null && (
										<div className="series-tree-actions">
											<KolToolbar
												_label={`Aktionen für ${entry.title}`}
												_orientation="horizontal"
												_items={[
													// #2359: Aufgabe aus Serie/Vorlage anlegen — bei ruhender Serie weggelassen (das „Ruhend"-Badge
													// erklärt den Zustand; der Server lehnt sie mit 409 ab).
													...(entry.active === false
														? []
														: [
																{
																	type: 'button' as const,
																	_label: 'Aufgabe anlegen',
																	_hideLabel: true,
																	_icons: { left: { icon: 'fa-solid fa-plus' } },
																	_variant: 'secondary' as const,
																	_on: {
																		onClick: () => {
																			setCreatedTitle(null);
																			setInstanceTarget(entry);
																		},
																	},
																},
															]),
													{
														type: 'button',
														_label: 'Bearbeiten',
														_hideLabel: true,
														_icons: { left: { icon: 'fa-solid fa-pen' } },
														_variant: 'secondary',
														_on: { onClick: () => setEditDialog({ series: entry }) },
													},
													{
														type: 'button',
														_label: 'Löschen',
														_hideLabel: true,
														_icons: { left: { icon: 'fa-solid fa-trash' } },
														_variant: 'danger',
														_on: { onClick: () => setDeleteTarget(entry) },
													},
												]}
											/>
										</div>
									)}
								</div>
							</div>
						</li>
					))}
				</ul>
			)}

			{editDialog !== null && (
				<Modal title={`Serie bearbeiten: ${editDialog.series.title}`} onClose={() => setEditDialog(null)} width="44rem">
					<TaskForm
						key={editDialog.series.id}
						task={null}
						series={editDialog.series}
						pillars={pillars}
						categories={categories}
						onClose={() => setEditDialog(null)}
						onSaved={afterSaved}
					/>
				</Modal>
			)}

			{instanceTarget !== null && (
				<SeriesInstanceDialog
					series={instanceTarget}
					onClose={() => setInstanceTarget(null)}
					onCreated={handleCreated}
				/>
			)}

			{deleteTarget !== null && (
				<DeleteSeriesDialog
					series={deleteTarget}
					onClose={() => setDeleteTarget(null)}
					onDeleted={handleDeleted}
					fallbackFocusRef={deleteFallbackRef}
				/>
			)}
		</section>
	);
};
