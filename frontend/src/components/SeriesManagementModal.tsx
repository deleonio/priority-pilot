import { KolAlert, KolButton, KolSpin } from '@public-ui/react-v19';
import type { Series } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { Modal } from './Modal';
import { SeriesFormModal } from './SeriesFormModal';

interface SeriesManagementModalProps {
	onClose: () => void;
}

/** Sub-Dialog der Serien-Verwaltung: Liste oder Anlege-/Bearbeiten-Formular. */
type SubForm = { kind: 'create' } | { kind: 'edit'; series: Series } | null;

const RHYTHM_LABEL: Record<Series['rhythm'], string> = {
	daily: 'Täglich',
	weekly: 'Wöchentlich',
	monthly: 'Monatlich',
};

/**
 * Serien-Verwaltung (#142, AK 1): listet alle Serien-Templates über `/series` und erlaubt das
 * Anlegen, Bearbeiten und Löschen. Einstieg über die Kopf-Toolbar-Aktion „Serien verwalten".
 * Das Anlege-/Bearbeiten-Formular (`SeriesFormModal`) wird innerhalb dieses Dialogs eingeblendet.
 */
export const SeriesManagementModal = ({ onClose }: SeriesManagementModalProps) => {
	const [series, setSeries] = useState<Series[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [subForm, setSubForm] = useState<SubForm>(null);
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

	/** Nach dem Speichern: Formular schließen und die Liste neu laden. */
	const afterSaved = useCallback((): void => {
		setSubForm(null);
		void reload();
	}, [reload]);

	// Stößt die serverseitige Materialisierung aller fälligen Serien-Instanzen an (#244, AK7).
	const generateAll = useCallback(async (): Promise<void> => {
		if (isGenerating) return;
		setIsGenerating(true);
		try {
			const { created } = await api.generateAllSeries();
			setError(null);
			setSuccessMessage(created > 0 ? `${created} Instanz(en) generiert` : 'Bereits aktuell');
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
			setSuccessMessage(null);
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
		<Modal title="Serien" onClose={onClose} width="44rem">
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

			{subForm !== null ? (
				<SeriesFormModal
					key={subForm.kind === 'edit' ? subForm.series.id : 'create'}
					series={subForm.kind === 'edit' ? subForm.series : null}
					onClose={() => setSubForm(null)}
					onSaved={afterSaved}
				/>
			) : (
				<>
					<div className="modal-actions">
						<KolButton
							_label="Neue Serie anlegen"
							_variant="primary"
							_on={{ onClick: () => setSubForm({ kind: 'create' }) }}
						/>
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

					{series !== null && series.length === 0 && (
						<p className="hint">Noch keine Serie angelegt. Lege oben eine neue Serie an.</p>
					)}

					{series !== null && series.length > 0 && (
						<ul className="series-list">
							{series.map((entry) => (
								<li key={entry.id} className="series-list-item">
									<span className="series-list-title">{entry.title}</span>
									<span className="series-list-meta">{RHYTHM_LABEL[entry.rhythm]}</span>
									<div className="series-list-actions">
										<KolButton
											_label="Bearbeiten"
											_variant="secondary"
											_on={{ onClick: () => setSubForm({ kind: 'edit', series: entry }) }}
										/>
										<KolButton _label="Löschen" _variant="danger" _on={{ onClick: () => void remove(entry) }} />
									</div>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</Modal>
	);
};
