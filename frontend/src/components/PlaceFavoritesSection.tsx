import { KolAccordion, KolAlert, KolButton, KolDetails } from '@public-ui/react-v19';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { api, type PlaceFavoriteView } from '../api';
import { toApiError } from '../lib/apiError';
import { useFollowingOpen } from '../lib/useFollowingOpen';
import { AddressAutocomplete } from './AddressAutocomplete';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { PlanBadge } from './PlanBadge';

/**
 * Aktions-Hülle um einen `KolButton` (Muster `ApiTokensSection.tsx`): der Klick wird am umgebenden
 * Element abgefangen statt über `_on` am Web-Component — `kol-button` ist in jsdom kein definiertes
 * Custom Element, `_on` bliebe dort eine reine Property. Der Klick des internen Buttons ist
 * `composed` und verlässt den Shadow-Root, im Browser wie im Test landet er genau einmal hier.
 */
const ButtonAction = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
	<span className="api-tokens__action" onClick={onClick}>
		{children}
	</span>
);

/**
 * Einstellungen → „Ortung": gespeicherte Orte („Standort-Favoriten", #1342 AK3). Seit #1595 hat
 * ein Ort NUR eine Adresse: kein Namensfeld, kein Umbenennen. Angelegt wird über dieselbe
 * `AddressAutocomplete` wie im Aufgabenformular (AK5) — die Auswahl übernimmt Adresse UND
 * Koordinaten. Gelöscht wird über `ConfirmDeleteDialog` (AK6,
 * `docs/ux-pattern-sequential-confirmation.md`); ein gelöschter Ort verschwindet aus der Liste und
 * damit auch aus dem Adressfeld von Aufgabe und Serie (Server ist die Quelle der Wahrheit).
 *
 * Aufbau wie `ApiTokensSection.tsx`: `KolCard` als Gruppierungsfläche, `ul`/`li` mit
 * Zeilen-Aktionen statt Tabelle (Mobile-Regel 3).
 */
export const PlaceFavoritesSection = ({ open = true }: { open?: boolean }) => {
	const { t } = useTranslation(['taskForm', 'common']);
	const accordion = useFollowingOpen(open);
	const listDetails = useFollowingOpen(open);
	const [favorites, setFavorites] = useState<PlaceFavoriteView[]>([]);
	const [address, setAddress] = useState('');
	// Koordinaten des zuletzt gewählten Vorschlags (AK5) — Freitext ohne Auswahl bleibt `null`.
	const [coords, setCoords] = useState<{ lat: number | null; lon: number | null }>({ lat: null, lon: null });
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Ort, für den der Lösch-Dialog gerade offen steht (AK6).
	const [deleteTarget, setDeleteTarget] = useState<PlaceFavoriteView | null>(null);

	useEffect(() => {
		let active = true;
		api
			.listPlaceFavorites()
			.then((list) => {
				if (active) setFavorites(list ?? []);
			})
			.catch(() => {
				if (active) setError(t('placeFavorites.loadFailed'));
			});
		return () => {
			active = false;
		};
	}, [t]);

	const handleCreate = async (): Promise<void> => {
		const trimmedAddress = address.trim();
		if (trimmedAddress === '') {
			setError(t('placeFavorites.addressRequired'));
			return;
		}
		setError(null);
		setBusy(true);
		try {
			const created = await api.createPlaceFavorite({
				address: trimmedAddress,
				latitude: coords.lat,
				longitude: coords.lon,
			});
			// #1595 (AK4): Bei einer bereits gespeicherten Adresse liefert der Server den bestehenden
			// Eintrag zurück — die Liste darf ihn kein zweites Mal aufnehmen.
			setFavorites((previous) =>
				previous.some((entry) => entry.id === created.id) ? previous : [...previous, created],
			);
			setAddress('');
			setCoords({ lat: null, lon: null });
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="api-tokens" data-testid="place-favorites-panel">
			<KolAccordion className="settings-card" _label={t('placeFavorites.title')} _level={2} {...accordion}>
				{/* #1484 (T3b AK3): Grenzstelle `location_reminders` — Badge als erstes Element im
				    Kartenkörper, weil der Titel über die KoliBri-Prop `_label` läuft (KI-UX-Block). */}
				<PlanBadge feature="location_reminders" />
				<div className="api-tokens__create">
					<p>{t('placeFavorites.intro')}</p>
					{/* #1595 (AK5): dieselbe Vervollständigung wie im Aufgabenformular — ab drei Zeichen
					    Vorschläge, per Tastatur bedienbar, die Auswahl übernimmt Adresse UND Koordinaten.
					    Ohne `onSaveFavorite`: der Stern in der Trefferzeile wäre hier der zweite Weg zur
					    selben Aktion wie der „Anlegen"-Knopf darunter. */}
					<AddressAutocomplete
						label={t('placeFavorites.address')}
						/* Die Karte weist die Grenzstelle `location_reminders` oben schon aus (#1484 AK3) —
						   ein zweites Badge direkt darunter wäre reine Wiederholung. */
						showPlanBadge={false}
						value={address}
						onValueChange={(next) => {
							setAddress(next);
							// Freitext-Änderung verwirft die Koordinaten des vorher gewählten Treffers.
							setCoords({ lat: null, lon: null });
						}}
						onSelect={(hit) => {
							setAddress(hit.address);
							setCoords({ lat: hit.lat, lon: hit.lon });
						}}
					/>
					<ButtonAction onClick={() => void handleCreate()}>
						<KolButton
							_label={t('common:actions.create')}
							class="settings-action-btn"
							_variant="primary"
							_disabled={busy}
						/>
					</ButtonAction>
					{error !== null && (
						<KolAlert _type="error" _label={t('placeFavorites.error')}>
							{error}
						</KolAlert>
					)}
				</div>
				<KolDetails _label={t('placeFavorites.myPlaces')} _level={3} {...listDetails}>
					{favorites.length === 0 ? (
						<p>{t('placeFavorites.empty')}</p>
					) : (
						<ul className="api-tokens__list">
							{favorites.map((favorite) => (
								<li key={favorite.id} className="api-tokens__item" data-testid="place-favorite-row">
									<span className="api-tokens__name">{favorite.address}</span>
									{/* `kol-button` hat keine `_ariaLabel`-Prop und liest kein `aria-label`-Attribut vom
								    Host — der zugängliche Name entsteht aus dem Slot-Inhalt im Expert-Slot. Ein
								    nicht-leeres `_label` blendet den Expert-Slot aus (hidden + aria-hidden in der
								    kol-span-Verarbeitung), deshalb steht „Löschen“ als sichtbarer Slot-Text und die
								    Anschrift als `.visually-hidden`-Span daneben (#2013 AK1/AK2). */}
									<ButtonAction onClick={() => setDeleteTarget(favorite)}>
										<KolButton
											_label=""
											_icons={{ left: { icon: 'fa-solid fa-trash' } }}
											class="settings-action-btn"
											_variant="danger"
										>
											<span slot="expert">
												{t('common:actions.delete')}
												<span className="visually-hidden">{` ${favorite.address}`}</span>
											</span>
										</KolButton>
									</ButtonAction>
								</li>
							))}
						</ul>
					)}
				</KolDetails>
			</KolAccordion>

			{/* #1595 (AK6): Löschen läuft über den gemeinsamen Bestätigungsdialog — „Abbrechen" lässt
			    den Ort stehen, die Bestätigung entfernt ihn aus der Liste und damit aus den
			    Adressfeldern von Aufgabe und Serie. */}
			{deleteTarget !== null && (
				<ConfirmDeleteDialog
					title={t('placeFavorites.deleteTitle')}
					body={<p>{t('placeFavorites.deleteBody')}</p>}
					confirmLabel={t('placeFavorites.deleteConfirm')}
					onConfirm={() => api.deletePlaceFavorite({ id: deleteTarget.id })}
					onClose={() => setDeleteTarget(null)}
					onDeleted={() => {
						setFavorites((previous) => previous.filter((entry) => entry.id !== deleteTarget.id));
						setDeleteTarget(null);
					}}
				/>
			)}
		</div>
	);
};
