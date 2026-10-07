import {
	KolAccordion,
	KolAlert,
	KolButton,
	KolInputPassword,
	KolInputRadio,
	KolInputText,
	KolSpin,
} from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { useFollowingOpen } from '../lib/useFollowingOpen';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

interface CalendarSourceView {
	id: number;
	name: string;
	type?: 'ics' | 'caldav';
}

const TYPE_OPTIONS = [
	{ label: 'ICS-Adresse', value: 'ics' },
	{ label: 'CalDAV', value: 'caldav' },
];

/**
 * Einstellungen → „Kalender" (#2210): ICS-Adresse verbinden, verbundene Kalender listen und
 * entfernen. Aufbau wie `PlaceFavoritesSection.tsx`; die Adresse ist geheim und steht nirgends in der
 * Oberfläche — die API liefert sie nicht zurück. Entfernen löscht die Termine mit und läuft deshalb
 * über `ConfirmDeleteDialog` (`docs/ux-pattern-sequential-confirmation.md`). Paketgrenze (403) und
 * abgelehnte Adresse (400) erscheinen als Fehlermeldung aus `toApiError`, die Liste bleibt unverändert.
 * CalDAV (#2211) fragt zusätzlich Benutzername und App-Passwort ab; das Passwort wird nach dem
 * Verbinden geleert und nie angezeigt.
 */
export const CalendarSourcesSection = ({ open = true }: { open?: boolean }) => {
	const accordion = useFollowingOpen(open);
	const [sources, setSources] = useState<CalendarSourceView[]>([]);
	const [type, setType] = useState<'ics' | 'caldav'>('ics');
	const [url, setUrl] = useState('');
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
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
			const created = await api.createCalendarSource({
				...(type === 'caldav' ? { type, url: trimmedUrl, username: username.trim(), password } : { url: trimmedUrl }),
				...(trimmedName === '' ? {} : { name: trimmedName }),
			});
			setSources((previous) => [...previous, created]);
			setUrl('');
			setName('');
			setUsername('');
			setPassword('');
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
					<KolInputRadio
						_label="Art des Kalenders"
						_options={TYPE_OPTIONS}
						_value={type}
						_on={{ onChange: (_event, value) => setType(value === 'caldav' ? 'caldav' : 'ics') }}
					/>
					<KolInputText
						_label={type === 'caldav' ? 'Kalender-Adresse (CalDAV)' : 'Kalender-Adresse (ICS)'}
						_type="url"
						_required
						_value={url}
						_on={{ onInput: (_event, value) => setUrl(String(value ?? '')) }}
					/>
					{type === 'caldav' && (
						<>
							<KolInputText
								_label="Benutzername"
								_required
								_autoComplete="username"
								_value={username}
								_on={{ onInput: (_event, value) => setUsername(String(value ?? '')) }}
							/>
							<KolInputPassword
								_label="App-Passwort"
								_required
								_autoComplete="new-password"
								_hint="App-Passwort, nicht dein Haupt-Passwort. Nur lesender Zugriff."
								_value={password}
								_on={{ onInput: (_event, value) => setPassword(String(value ?? '')) }}
							/>
						</>
					)}
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
								<span className="api-tokens__name">
									{source.name}
									{source.type === 'caldav' && ' · CalDAV'}
								</span>
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
					body={
						<p>
							Wirklich entfernen? Die Termine dieses Kalenders verschwinden aus der Wochenansicht
							{deleteTarget.type === 'caldav' && ', die Zugangsdaten werden gelöscht'}.
						</p>
					}
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
