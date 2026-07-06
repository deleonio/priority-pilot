import { KolAlert, KolButton, KolSpin, KolToolbar } from '@public-ui/react-v19';
import type { Pillar, Series } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';
import { TaskForm } from './TaskForm';

interface SeriesTabProps {
	/** Verfügbare Lebensbalance-Säulen für die Serien-Zuordnung im eingebetteten `TaskForm`. */
	pillars: Pillar[];
}

/** Serie, die aktuell im Bearbeiten-Modal (`TaskForm` im Serie-Modus) geöffnet ist. */
type EditDialog = { series: Series } | null;

const RHYTHM_LABEL: Record<Series['rhythm'], string> = {
	daily: 'Täglich',
	weekly: 'Wöchentlich',
	monthly: 'Monatlich',
};

/**
 * Serien-Verwaltung als eigener Tab „Serien" (#335): löst das frühere `SeriesManagementModal` (Einstieg
 * über den Header-Button „Serien verwalten") ab. Analog zum `TaskTree` listet der Tab alle Serien-
 * Templates (`GET /series`) im Baum-Stil (`series-tree` als Wurzelcontainer, `series-tree-item-<id>` je
 * Serie) mit Titel, Rhythmus-Badge und einer Aktions-Toolbar (Bearbeiten/Löschen). „Bearbeiten" öffnet
 * `TaskForm` im Serie-Modus (#297) in einem Modal; „Löschen" entfernt die Serie. „Fällige Instanzen
 * generieren" (#244) stößt die serverseitige Materialisierung an. Das Anlegen neuer Serien läuft über
 * den vereinheitlichten Einstieg „Neuen Task anlegen" (QuickCapture, #330).
 */
export const SeriesTab = ({ pillars }: SeriesTabProps) => {
	const [series, setSeries] = useState<Series[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [editDialog, setEditDialog] = useState<EditDialog>(null);
	const [isGenerating, setIsGenerating] = useState(false);

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

	/** Nach dem Speichern: Modal schließen und die Liste neu laden. */
	const afterSaved = useCallback((): void => {
		setEditDialog(null);
		void reload();
	}, [reload]);

	// Stößt die serverseitige Materialisierung aller fälligen Serien-Instanzen an (#244, AK7).
	const generateAll = useCallback(async (): Promise<void> => {
		if (isGenerating) return;
		setIsGenerating(true);
		setSuccessMessage(null);
		try {
			const { created } = await api.generateAllSeries();
			setError(null);
			const msg = created > 0 ? `${created} Instanz(en) generiert` : 'Bereits aktuell';
			setSuccessMessage(msg);
			setTimeout(() => setSuccessMessage(null), 5000);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setIsGenerating(false);
		}
	}, [isGenerating]);

	const remove = useCallback(
		async (entry: Series): Promise<void> => {
			try {
				await api.deleteSeries({ id: entry.id });
				await reload();
			} catch (reason) {
				const apiError = await toApiError(reason);
				setError(apiError.message);
			}
		},
		[reload],
	);

	return (
		<section className="series-section">
			{error !== null && (
				<KolAlert _type="error" _label="Aktion fehlgeschlagen">
					{error}
				</KolAlert>
			)}

			{successMessage !== null && (
				<KolAlert _type="info" _label="Ergebnis">
					{successMessage}
				</KolAlert>
			)}

			<div className="series-actions">
				<KolButton
					_label="Fällige Instanzen generieren"
					_variant="secondary"
					_disabled={isGenerating}
					_on={{ onClick: () => void generateAll() }}
				/>
			</div>

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
								<span className="series-tree-title">{entry.title}</span>
								<span className="series-tree-badge series-tree-badge--rhythm">{RHYTHM_LABEL[entry.rhythm]}</span>
								<div className="series-tree-actions">
									<KolToolbar
										_label={`Aktionen für ${entry.title}`}
										_orientation="horizontal"
										_items={[
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
												_icons: { left: { icon: 'kolicon-cross' } },
												_variant: 'danger',
												_on: { onClick: () => void remove(entry) },
											},
										]}
									/>
								</div>
							</div>
						</li>
					))}
				</ul>
			)}

			{editDialog !== null && (
				<Modal title="Serie bearbeiten" onClose={() => setEditDialog(null)} width="44rem">
					<TaskForm
						key={editDialog.series.id}
						task={null}
						series={editDialog.series}
						pillars={pillars}
						onClose={() => setEditDialog(null)}
						onSaved={afterSaved}
					/>
				</Modal>
			)}
		</section>
	);
};
