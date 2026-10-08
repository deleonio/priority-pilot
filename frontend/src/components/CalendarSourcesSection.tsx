import {
	KolAccordion,
	KolAlert,
	KolButton,
	KolInputPassword,
	KolInputRadio,
	KolInputRange,
	KolInputText,
	KolSpin,
} from '@public-ui/react-v19';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
	{ labelKey: 'calendarSources.typeIcs', value: 'ics' },
	{ labelKey: 'calendarSources.typeCaldav', value: 'caldav' },
] as const;

/**
 * Einstellungen → „Kalender" (#2210): ICS-Adresse verbinden, verbundene Kalender listen und
 * entfernen. Aufbau wie `PlaceFavoritesSection.tsx`; die Adresse ist geheim und steht nirgends in der
 * Oberfläche — die API liefert sie nicht zurück. Entfernen löscht die Termine mit und läuft deshalb
 * über `ConfirmDeleteDialog` (`docs/ux-pattern-sequential-confirmation.md`). Paketgrenze (403) und
 * abgelehnte Adresse (400) erscheinen als Fehlermeldung aus `toApiError`, die Liste bleibt unverändert.
 * CalDAV (#2211) fragt zusätzlich Benutzername und App-Passwort ab; das Passwort wird nach dem
 * Verbinden geleert und nie angezeigt.
 * Mit verbundenem Kalender erscheint der Regler „Mindestdauer freier Lücken" (#1990, Karte „Freie Zeit");
 * die Änderung wird sofort gespeichert.
 */
export const CalendarSourcesSection = ({ open = true }: { open?: boolean }) => {
	const { t } = useTranslation(['settings', 'common']);
	// Stabile Options-Identität: eine neue Liste je Render baut die KoliBri-Auswahl neu auf.
	const typeOptions = useMemo(() => TYPE_OPTIONS.map(({ labelKey, value }) => ({ label: t(labelKey), value })), [t]);
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
	const [freeSlotMinMinutes, setFreeSlotMinMinutes] = useState(30);

	useEffect(() => {
		let active = true;
		api
			.listCalendarSources()
			.then((list) => {
				if (active) setSources(list ?? []);
			})
			.catch(() => {
				if (active) setError(t('calendarSources.loadError'));
			});
		api
			.getFreeSlotConfig()
			.then((config) => {
				if (active && config) setFreeSlotMinMinutes(config.freeSlotMinMinutes);
			})
			.catch(() => {
				// Default bleibt stehen, der Regler bleibt bedienbar.
			});
		return () => {
			active = false;
		};
	}, [t]);

	const applyFreeSlotMin = (value: number): void => {
		setFreeSlotMinMinutes(value);
		api.updateFreeSlotConfig({ freeSlotMinMinutes: value }).catch(() => {
			// Best-Effort: der Server hält sonst den letzten gültigen Stand.
		});
	};

	const handleConnect = async (): Promise<void> => {
		const trimmedUrl = url.trim();
		if (trimmedUrl === '') {
			setError(t('calendarSources.urlRequired'));
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
				_label={t('calendarSources.title')}
				_level={2}
				{...accordion}
			>
				<div className="api-tokens__create">
					<p>{t('calendarSources.intro')}</p>
					<KolInputRadio
						_label={t('calendarSources.typeLabel')}
						_options={typeOptions}
						_value={type}
						_on={{ onChange: (_event, value) => setType(value === 'caldav' ? 'caldav' : 'ics') }}
					/>
					<KolInputText
						_label={type === 'caldav' ? t('calendarSources.urlCaldav') : t('calendarSources.urlIcs')}
						_type="url"
						_required
						_value={url}
						_on={{ onInput: (_event, value) => setUrl(String(value ?? '')) }}
					/>
					{type === 'caldav' && (
						<>
							<KolInputText
								_label={t('calendarSources.username')}
								_required
								_autoComplete="username"
								_value={username}
								_on={{ onInput: (_event, value) => setUsername(String(value ?? '')) }}
							/>
							<KolInputPassword
								_label={t('calendarSources.password')}
								_required
								_autoComplete="new-password"
								_hint={t('calendarSources.passwordHint')}
								_value={password}
								_on={{ onInput: (_event, value) => setPassword(String(value ?? '')) }}
							/>
						</>
					)}
					<KolInputText
						_label={t('calendarSources.nameLabel')}
						_value={name}
						_on={{ onInput: (_event, value) => setName(String(value ?? '')) }}
					/>
					<KolButton
						_label={t('calendarSources.connect')}
						class="settings-action-btn"
						_variant="primary"
						_disabled={busy}
						_on={{ onClick: () => void handleConnect() }}
					/>
					{busy && <KolSpin _label={t('calendarSources.loading')} _show />}
					{error !== null && (
						<KolAlert _type="error" _label={t('calendarSources.errorLabel')}>
							{error}
						</KolAlert>
					)}
					{removed && (
						<KolAlert _type="success" _label={t('calendarSources.removedLabel')}>
							{t('calendarSources.removedText')}
						</KolAlert>
					)}
				</div>
				{sources.length === 0 ? (
					<p>{t('calendarSources.empty')}</p>
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
										{t('common:actions.remove')}
										<span className="visually-hidden">{` ${t('calendarSources.removeTarget', { name: source.name })}`}</span>
									</span>
								</KolButton>
							</li>
						))}
					</ul>
				)}
				{sources.length > 0 && (
					<div className="geo-range-field">
						<KolInputRange
							_label={t('calendarSources.freeSlotLabel')}
							_hint={t('calendarSources.freeSlotHint')}
							_value={freeSlotMinMinutes}
							_min={10}
							_max={240}
							_step={5}
							_on={{ onChange: (_event, value) => applyFreeSlotMin(Number(value ?? freeSlotMinMinutes)) }}
						/>
						{/* Sichtbarer Wert im Light-DOM: der Regler zeigt ihn nicht selbst (Muster Geo-Regler). */}
						<span className="geo-range-value">
							{t('settingsPage.geo.valueMinutes', { minutes: freeSlotMinMinutes })}
						</span>
					</div>
				)}
			</KolAccordion>

			{deleteTarget !== null && (
				<ConfirmDeleteDialog
					title={t('calendarSources.deleteTitle')}
					body={
						<p>
							{deleteTarget.type === 'caldav' ? t('calendarSources.deleteBodyCaldav') : t('calendarSources.deleteBody')}
						</p>
					}
					confirmLabel={t('calendarSources.deleteConfirm')}
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
