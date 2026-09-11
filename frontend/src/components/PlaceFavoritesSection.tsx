import { KolAlert, KolButton, KolCard, KolInputText } from '@public-ui/react-v19';
import { useEffect, useState, type ReactNode } from 'react';
import { api, type PlaceFavoriteView } from '../api';
import { toApiError } from '../lib/apiError';

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
 * Einstellungen → „Standort": gespeicherte Orte („Standort-Favoriten", #1342 AK3). Anlegen (Name +
 * Adresse, ohne Koordinaten — dieser Weg ist für manuell erfasste Orte gedacht, AK4), Umbenennen
 * (inline im Zeilen-Feld) und Löschen mit zweistufiger Bestätigung
 * (`docs/ux-pattern-sequential-confirmation.md`). Ein gelöschter Ort verschwindet aus der Liste und
 * damit auch aus dem Adressfeld von Aufgabe und Serie (Server ist die Quelle der Wahrheit).
 *
 * Aufbau wie `ApiTokensSection.tsx`: `KolCard` als Gruppierungsfläche, `ul`/`li` mit
 * Zeilen-Aktionen statt Tabelle (Mobile-Regel 3).
 */
export const PlaceFavoritesSection = () => {
	const [favorites, setFavorites] = useState<PlaceFavoriteView[]>([]);
	const [name, setName] = useState('');
	const [address, setAddress] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Id des Orts, dessen Name gerade inline bearbeitet wird (plus sein Entwurfswert).
	const [renameId, setRenameId] = useState<number | null>(null);
	const [renameValue, setRenameValue] = useState('');
	// Id des Orts, für den die Rückfrage „wirklich löschen?" gerade offen steht.
	const [deleteId, setDeleteId] = useState<number | null>(null);

	useEffect(() => {
		let active = true;
		api
			.listPlaceFavorites()
			.then((list) => {
				if (active) setFavorites(list ?? []);
			})
			.catch(() => {
				if (active) setError('Die gespeicherten Orte konnten nicht geladen werden.');
			});
		return () => {
			active = false;
		};
	}, []);

	const handleCreate = async (): Promise<void> => {
		const trimmedName = name.trim();
		const trimmedAddress = address.trim();
		if (trimmedName === '' || trimmedAddress === '') {
			setError('Bitte Name und Adresse angeben.');
			return;
		}
		setError(null);
		setBusy(true);
		try {
			// Ohne Koordinaten: der Ort wird als Freitext hinterlegt (AK4) und übernimmt im Adressfeld
			// nur den Adresstext.
			const created = await api.createPlaceFavorite({ name: trimmedName, address: trimmedAddress });
			setFavorites((previous) => [...previous, created]);
			setName('');
			setAddress('');
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	const handleRename = async (id: number): Promise<void> => {
		const trimmed = renameValue.trim();
		if (trimmed === '') {
			setError('Bitte einen Namen angeben.');
			return;
		}
		setError(null);
		setBusy(true);
		try {
			const updated = await api.updatePlaceFavorite({ id, name: trimmed });
			setFavorites((previous) => previous.map((entry) => (entry.id === id ? updated : entry)));
			setRenameId(null);
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	const handleDelete = async (id: number): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			await api.deletePlaceFavorite({ id });
			setFavorites((previous) => previous.filter((entry) => entry.id !== id));
			setDeleteId(null);
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="api-tokens" data-testid="place-favorites-panel">
			<KolCard className="settings-card" _label="Gespeicherte Orte" _level={2}>
				<div className="api-tokens__create">
					<p>
						Hinterlegte Orte stehen im Adressfeld von Aufgabe und Serie oben in der Vorschlagsliste — ein Klick
						übernimmt die Adresse.
					</p>
					<KolInputText _label="Name" _value={name} _on={{ onInput: (_event, value) => setName(String(value)) }} />
					<KolInputText
						_label="Adresse"
						_value={address}
						_on={{ onInput: (_event, value) => setAddress(String(value)) }}
					/>
					<ButtonAction onClick={() => void handleCreate()}>
						<KolButton _label="Anlegen" class="settings-action-btn" _variant="primary" _disabled={busy} />
					</ButtonAction>
					{error !== null && (
						<KolAlert _type="error" _label="Fehler">
							{error}
						</KolAlert>
					)}
				</div>
			</KolCard>

			<KolCard className="settings-card" _label="Meine Orte" _level={2}>
				{favorites.length === 0 ? (
					<p>Noch kein Ort hinterlegt.</p>
				) : (
					<ul className="api-tokens__list">
						{favorites.map((favorite) => (
							<li key={favorite.id} className="api-tokens__item" data-testid="place-favorite-row">
								<span className="api-tokens__name">
									{favorite.name}
									<span className="api-tokens__meta">{` · ${favorite.address}`}</span>
								</span>
								{renameId === favorite.id ? (
									<span className="api-tokens__confirm">
										<KolInputText
											_label={`Neuer Name für ${favorite.name}`}
											_value={renameValue}
											_on={{ onInput: (_event, value) => setRenameValue(String(value)) }}
										/>
										<ButtonAction onClick={() => setRenameId(null)}>
											<KolButton _label="Abbrechen" class="settings-action-btn" _variant="secondary" _disabled={busy} />
										</ButtonAction>
										<ButtonAction onClick={() => void handleRename(favorite.id)}>
											<KolButton _label="Übernehmen" class="settings-action-btn" _variant="primary" _disabled={busy} />
										</ButtonAction>
									</span>
								) : deleteId === favorite.id ? (
									<span className="api-tokens__confirm">
										<span className="api-tokens__confirm-question">
											Wirklich löschen? Der Ort verschwindet aus dem Adressfeld.
										</span>
										<ButtonAction onClick={() => setDeleteId(null)}>
											<KolButton _label="Abbrechen" class="settings-action-btn" _variant="secondary" _disabled={busy} />
										</ButtonAction>
										<ButtonAction onClick={() => void handleDelete(favorite.id)}>
											<KolButton
												data-testid="place-favorite-delete-confirm"
												_label="Endgültig löschen"
												class="settings-action-btn"
												_variant="danger"
												_disabled={busy}
											/>
										</ButtonAction>
									</span>
								) : (
									<>
										{/* `aria-label` zusätzlich zum sichtbaren `_label`: der Name nennt den Ort mit, damit die
										    Aktion auch aus der Vorlesereihenfolge heraus eindeutig ist (der sichtbare Text ist
										    im Namen enthalten, WCAG 2.5.3). */}
										<ButtonAction
											onClick={() => {
												setRenameValue(favorite.name);
												setRenameId(favorite.id);
											}}
										>
											<KolButton
												aria-label={`Favorit umbenennen: ${favorite.name}`}
												_label="Umbenennen"
												class="settings-action-btn"
												_variant="secondary"
											/>
										</ButtonAction>
										<ButtonAction onClick={() => setDeleteId(favorite.id)}>
											<KolButton
												aria-label={`Favorit löschen: ${favorite.name}`}
												_label="Löschen"
												class="settings-action-btn"
												_variant="danger"
											/>
										</ButtonAction>
									</>
								)}
							</li>
						))}
					</ul>
				)}
			</KolCard>
		</div>
	);
};
