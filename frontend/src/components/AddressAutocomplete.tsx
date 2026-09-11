import { KolAlert, KolInputText, KolSpin } from '@public-ui/react-v19';
import { useId, useState } from 'react';
import { useAddressSearch, type AddressSuggestion } from '../lib/useAddressSearch';

/**
 * Adress-Autovervollständigung mit EIGENER Vorschlagsliste (#1083).
 *
 * KOLIBRI-FIRST-AUSNAHME (ux-design.md §4): `KolCombobox` filtert die `_suggestions` intern per
 * `includes` — in @public-ui 4.3.0 gibt es keinen Prop, um diesen Substring-Filter abzuschalten.
 * Das leert die Liste genau dann, wenn der Upstream typo-tolerant trefft („munchen" → München),
 * denn der Suchtext kommt im Anzeigetext nicht vor. `KolSingleSelect` scheidet aus, weil es keine
 * Freitext-Eingabe zulässt (AK6). Das Feld bleibt KoliBri (`KolInputText`), nur die Liste ist
 * eigenes Markup mit dem ARIA-1.2-Combobox-Muster.
 */

/** Gespeicherter Ort (#1342) in der Sicht des Adressfelds — Koordinaten optional (Freitext-Ort). */
export interface PlaceFavoriteSuggestion {
	id: number;
	name: string;
	address: string;
	lat: number | null;
	lon: number | null;
}

interface AddressAutocompleteProps {
	label: string;
	value: string;
	/** Freitext-Eingabe — schreibt live in den Formular-State (ohne Koordinate). */
	onValueChange: (next: string) => void;
	/** Explizite Auswahl eines Treffers — übernimmt `{address, lat, lon}` (#1066). */
	onSelect?: (suggestion: AddressSuggestion) => void;
	/** #1111: Element-ID des Koordinaten-Kastens, per `_ariaDetails` dem Feld zugeordnet. */
	ariaDetails?: string;
	/** #1342: gespeicherte Orte des Nutzers — stehen VOR den Suchtreffern in derselben Listbox. */
	favorites?: PlaceFavoriteSuggestion[];
	/** #1342: Stern in der Trefferzeile — meldet den Treffer zum Speichern, ohne ihn auszuwählen. */
	onSaveFavorite?: (suggestion: AddressSuggestion) => void;
}

/**
 * Vergleichsform für den Favoritenfilter: ohne Diakritika und klein — „munchen" soll „München"
 * finden (dieselbe Tippfehler-Toleranz, die die Trefferliste vom Upstream schon mitbringt).
 */
const normalizeForMatch = (text: string) =>
	text
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();

export const AddressAutocomplete = ({
	label,
	value,
	onValueChange,
	onSelect,
	ariaDetails,
	favorites = [],
	onSaveFavorite,
}: AddressAutocompleteProps) => {
	// #1310 (AK5): Ein vorbelegter Wert (Schnellerfassung/Bearbeiten) löst KEINE Adresssuche aus —
	// erst die Eingabe des Nutzers. Ohne diese Sperre würde allein das Öffnen des Formulars mit
	// gefülltem Adressfeld einen Geocoding-Request absetzen, den niemand angefordert hat.
	const [touched, setTouched] = useState(false);
	const { suggestions, loading, pending, error } = useAddressSearch(touched ? value : '');
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	// `dismissed` hält die Liste nach Auswahl/Escape zu, obwohl `value` (die übernommene Adresse)
	// weiter ≥ 3 Zeichen lang ist und die Suche weiterläuft — sonst springt sie sofort wieder auf.
	const [dismissed, setDismissed] = useState(false);
	const listId = useId();

	// #1342: Favoriten stehen VOR den Suchtreffern in derselben Listbox (AK1) — gleicher
	// Auswahlpfad, gleiche Tastaturnavigation. Gefiltert wird nach Name UND Adresse; ohne Eingabe
	// erscheinen alle gespeicherten Orte.
	const query = normalizeForMatch(value.trim());
	const favoriteOptions = favorites
		.filter((favorite) => query === '' || normalizeForMatch(`${favorite.name} ${favorite.address}`).includes(query))
		.map((favorite) => ({
			key: `favorite-${favorite.id}`,
			text: `${favorite.name} — ${favorite.address}`,
			// Ein Favorit ohne Koordinaten übergibt `null` — keine alte Koordinate bleibt stehen (AK4).
			suggestion: { address: favorite.address, lat: favorite.lat, lon: favorite.lon } as AddressSuggestion,
			saveable: false,
		}));
	const options = [
		...favoriteOptions,
		...suggestions.map((suggestion, index) => ({
			key: `hit-${suggestion.address}-${index}`,
			text: suggestion.address,
			suggestion,
			saveable: true,
		})),
	];

	// `touched` hält die Liste beim Öffnen des Formulars zu: gespeicherte Orte allein dürfen sie
	// nicht aufklappen lassen (#1310 AK5 — nur die Eingabe des Nutzers öffnet). `pending` hält sie
	// zu, solange die Suche zum aktuellen Text läuft: sonst stünden erst die Favoriten allein da und
	// die Trefferliste schöbe sie eine Zeile weiter, sobald sie eintrifft.
	const open = touched && !pending && options.length > 0 && !dismissed;

	const change = (next: string) => {
		setTouched(true);
		setActiveIndex(null);
		setDismissed(false);
		onValueChange(next);
	};

	const choose = (index: number) => {
		const hit = options[index]?.suggestion;
		if (hit) {
			onSelect?.(hit);
		}
		setActiveIndex(null);
		setDismissed(true);
	};

	// AK5: Tab/Blurfokus schließt ohne Auswahl. Kollidiert nicht mit dem Options-Klick, weil
	// `onMouseDown` der Option den Blur per `preventDefault()` gar nicht erst zulässt.
	const blur = () => {
		setActiveIndex(null);
		setDismissed(true);
	};

	const keyDown = (event: { key: string; preventDefault: () => void }) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!open) {
				return;
			}
			event.preventDefault();
			setActiveIndex((current) => {
				if (current === null) {
					return event.key === 'ArrowDown' ? 0 : options.length - 1;
				}
				const next = current + (event.key === 'ArrowDown' ? 1 : -1);
				return next < 0 ? options.length - 1 : next >= options.length ? 0 : next;
			});
			return;
		}
		if (event.key === 'Enter' && activeIndex !== null) {
			// Enter in der Liste wählt — darf das umgebende Formular NICHT abschicken (AK5).
			event.preventDefault();
			choose(activeIndex);
			return;
		}
		if (event.key === 'Escape') {
			if (open) {
				event.preventDefault();
			}
			setActiveIndex(null);
			setDismissed(true);
		}
	};

	return (
		/* COMBOBOX-CONTAINER (ARIA-1.2, Fix F2): `role="combobox"` + State liegen auf einem echten
		   DOM-Element, das Feld UND Listbox besitzt — `aria-activedescendant` zeigt dadurch auf
		   echte Nachfahren. Auf dem KoliBri-Host wären die Props unbekannte Attribute und das
		   fokussierte `<input>` im Shadow-DOM bekäme sie nie (KolInputText 4.3.0 hat diese Props
		   nicht, siehe `spec/input-text`). Keydown/Blur delegiert der Container: Events aus dem
		   Shadow-DOM bubbeln composed an den Host und weiter in das Licht-DOM. */
		<div
			style={{ position: 'relative' }}
			role="combobox"
			aria-haspopup="listbox"
			aria-autocomplete="list"
			aria-expanded={open}
			aria-controls={open ? listId : undefined}
			aria-activedescendant={activeIndex === null ? undefined : `${listId}-option-${activeIndex}`}
			onBlur={blur}
			onKeyDown={(event) => keyDown(event as unknown as KeyboardEvent)}
		>
			<KolInputText
				_label={label}
				_type="search" // #1111 AK6: als Suchfeld ausgezeichnet (wie das Kopfzeilen-Suchfeld)
				_ariaDetails={ariaDetails}
				_placeholder="Straße, Hausnummer, Ort …"
				_value={value}
				_on={{
					onChange: (_event, next) => change(String(next ?? '')),
					onInput: (_event, next) => change(String(next ?? '')),
				}}
			/>

			{/* Asynchrone Zustände (mobile-ui-rules Regel 7): Laden / Fehler / Leer / Erfolg. */}
			{loading && (
				<div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pp-space-2, 8px)', padding: '8px 0' }}>
					<KolSpin _label="Adresse wird gesucht …" />
				</div>
			)}
			{!loading && error && (
				<KolAlert _type="warning" _label="Adresssuche nicht erreichbar — Adresse bitte manuell eintippen." />
			)}
			{!loading && !error && value.trim().length >= 3 && !open && (
				<div style={{ padding: '8px 0' }}>Keine Treffer — Adresse direkt übernehmen.</div>
			)}

			{open && (
				/* Wrapper = `aria-controls`-Ziel: der kontrollierte Bereich, der die listbox enthält. */
				<div id={listId}>
					<ul
						id={`${listId}-listbox`}
						role="listbox"
						aria-live="polite"
						aria-label={`${options.length} Treffer`}
						style={{
							position: 'relative', // In-Flow unter dem Feld — kein Portal/Overlay (375-px-Viewport, AK7)
							margin: 0,
							padding: 0,
							listStyle: 'none',
							background: 'var(--pp-surface-1, #fff)',
							color: 'var(--pp-ink, #1a1a1a)',
							border: '1px solid var(--pp-border-strong, #666)',
							borderRadius: 'var(--pp-radius-sm, 4px)',
						}}
					>
						{options.map((option, index) => (
							/* #1342: Die Zeile ist `role="presentation"` — der Stern darf KEIN Nachfahre der
							   Option sein (ARIA 1.2 verbietet interaktive Nachfahren in `role="option"`) und
							   würde vom `onMouseDown`/`preventDefault()` der Option ohnehin nie erreicht. */
							<li key={option.key} role="presentation" style={{ display: 'flex', alignItems: 'stretch' }}>
								<div
									id={`${listId}-option-${index}`}
									role="option"
									aria-selected={index === activeIndex}
									onMouseDown={(event) => {
										// mousedown statt click: der Blur des Feldes (der die Liste schließt) feuert zuerst.
										event.preventDefault();
										choose(index);
									}}
									onClick={() => {
										// Zweiter Pfad für reine Click-Events (Screenreader-/AssistTech-Aktivierung,
										// jsdom-`fireEvent.click`): `choose` ist idempotent, ein Doppel-Feuern ist harmlos.
										choose(index);
									}}
									style={{
										flex: 1,
										minHeight: '44px', // Touch-Ziel (Regel 2)
										padding: '12px',
										cursor: 'pointer',
										overflowWrap: 'anywhere', // lange display_name umbrechen, nicht abschneiden (Regel 3)
										background: index === activeIndex ? 'var(--pp-surface-2, #f2f2f2)' : undefined,
										fontWeight: index === activeIndex ? 700 : undefined,
									}}
								>
									{option.text}
								</div>
								{option.saveable && onSaveFavorite && (
									/* KOLIBRI-FIRST-AUSNAHME wie die Liste selbst (s. Dateikopf): der Stern gehört in
									   dieses eigene Listen-Markup; ein `KolButton` würde hier zusätzlich die
									   Combobox-Semantik der Zeile mit einem Shadow-DOM-Host durchschneiden. */
									<button
										type="button"
										aria-label={`Als Favorit speichern: ${option.text}`}
										onMouseDown={(event) => {
											// Der Blur des Feldes würde die Liste vor dem Klick schließen (wie bei der Option).
											event.preventDefault();
										}}
										onClick={() => onSaveFavorite(option.suggestion)}
										style={{
											minWidth: '44px', // Touch-Ziel (Regel 2)
											minHeight: '44px',
											border: 'none',
											background: 'transparent',
											color: 'var(--pp-ink-muted, #555)',
											cursor: 'pointer',
											fontSize: '1.25rem',
											lineHeight: 1,
										}}
									>
										<span aria-hidden="true">☆</span>
									</button>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};
