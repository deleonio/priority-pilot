import { KolAccordion, KolAlert, KolButton, KolInputText, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useFollowingOpen } from '../lib/useFollowingOpen';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface CalendarSourceView {
	id: number;
	name: string;
}

/**
 * Einstellungen → „Kalender" (#2210): ICS-Adresse verbinden, verbundene Kalender listen und
 * entfernen. Aufbau wie `PlaceFavoritesSection.tsx`; die Adresse ist geheim und steht nirgends in der
 * Oberfläche — die API liefert sie nicht zurück. Entfernen löscht die Termine mit und läuft deshalb
 * über `ConfirmDeleteDialog` (`docs/ux-pattern-sequential-confirmation.md`). Paketgrenze (403) und
 * abgelehnte Adresse (400) erscheinen als Fehlermeldung aus `toApiError`, die Liste bleibt unverändert.
 */
export const CalendarSourcesSection = ({ open = true }: { open?: boolean }) => {
	const accordion = useFollowingOpen(open);
	const [sources, setSources] = useState<CalendarSourceView[]>([]);
	const [url, setUrl] = useState('');
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<CalendarSourceView | null>(null);
	const [removed, setRemoved] = useState(false);

	useEffect(() => {
		let active = true;
		api
			.listCalendarSources()
			.then((list) => {
				if (active) setSources(list ?? []);
			})
			.catch(() => {
				if (active) setError('Die verbundenen Kalender konnten nicht geladen werden.');
			});
		return () => {
			active = false;
		};
	}, []);

	const handleConnect = async (): Promise<void> => {
		const trimmedUrl = url.trim();
		if (trimmedUrl === '') {
			setError('Bitte eine Kalender-Adresse angeben.');
			return;
		}
		setError(null);
		setRemoved(false);
		setBusy(true);
		try {
			const trimmedName = name.trim();
			const created = await api.createCalendarSource(
				trimmedName === '' ? { url: trimmedUrl } : { url: trimmedUrl, name: trimmedName },
			);
			setSources((previous) => [...previous, created]);
			setUrl('');
			setName('');
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<KolAccordion
				className="settings-card"
				data-testid="calendar-sources-panel"
				_label="Kalender"
				_level={2}
				{...accordion}
			>
				<div className="api-tokens__create">
					<p>
						Verbinde die ICS-Adresse deines Kalenders — die Termine der nächsten Tage erscheinen in der Wochenansicht.
					</p>
					<KolInputText
						_label="Kalender-Adresse (ICS)"
						_type="url"
						_required
						_value={url}
						_on={{ onInput: (_event, value) => setUrl(String(value ?? '')) }}
					/>
					<KolInputText
						_label="Name (optional)"
						_value={name}
						_on={{ onInput: (_event, value) => setName(String(value ?? '')) }}
					/>
					<KolButton
						_label="Verbinden"
						class="settings-action-btn"
						_variant="primary"
						_disabled={busy}
						_on={{ onClick: () => void handleConnect() }}
					/>
					{busy && <KolSpin _label="Wird abgerufen…" _show />}
					{error !== null && (
						<KolAlert _type="error" _label="Fehler">
							{error}
						</KolAlert>
					)}
					{removed && (
						<KolAlert _type="success" _label="Kalender entfernt">
							Die Termine sind aus der Wochenansicht verschwunden.
						</KolAlert>
					)}
				</div>
				{sources.length === 0 ? (
					<p>Noch kein Kalender verbunden. Füge die ICS-Adresse deines Kalenders hinzu.</p>
				) : (
					<ul className="api-tokens__list">
						{sources.map((source) => (
							<li key={source.id} className="api-tokens__item" data-testid="calendar-source-row">
								<span className="api-tokens__name">{source.name}</span>
								{/* Zugänglicher Name aus dem Expert-Slot (Muster `PlaceFavoritesSection`): ein
								    nicht-leeres `_label` blendet ihn aus. */}
								<KolButton
									_label=""
									_icons={{ left: { icon: 'fa-solid fa-trash' } }}
									class="settings-action-btn"
									_variant="danger"
									_on={{ onClick: () => setDeleteTarget(source) }}
								>
									<span slot="expert">
										Entfernen<span className="visually-hidden">{` Kalender ${source.name}`}</span>
									</span>
								</KolButton>
							</li>
						))}
					</ul>
				)}
			</KolAccordion>

			{deleteTarget !== null && (
				<ConfirmDeleteDialog
					title="Kalender entfernen"
					body={<p>Wirklich entfernen? Die Termine dieses Kalenders verschwinden aus der Wochenansicht.</p>}
					confirmLabel="Endgültig entfernen"
					onConfirm={() => api.deleteCalendarSource({ id: deleteTarget.id })}
					onClose={() => setDeleteTarget(null)}
					onDeleted={() => {
						setSources((previous) => previous.filter((entry) => entry.id !== deleteTarget.id));
						setDeleteTarget(null);
						setRemoved(true);
					}}
				/>
			)}
		</>
	);
};
