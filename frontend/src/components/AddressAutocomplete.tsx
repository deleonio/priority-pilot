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

interface AddressAutocompleteProps {
	label: string;
	value: string;
	/** Freitext-Eingabe — schreibt live in den Formular-State (ohne Koordinate). */
	onValueChange: (next: string) => void;
	/** Explizite Auswahl eines Treffers — übernimmt `{address, lat, lon}` (#1066). */
	onSelect: (suggestion: AddressSuggestion) => void;
}

export const AddressAutocomplete = ({ label, value, onValueChange, onSelect }: AddressAutocompleteProps) => {
	const { suggestions, loading, error } = useAddressSearch(value);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const listId = useId();

	const open = suggestions.length > 0;

	const change = (next: string) => {
		setActiveIndex(null);
		onValueChange(next);
	};

	const choose = (index: number) => {
		const hit = suggestions[index];
		if (hit) {
			onSelect(hit);
		}
		setActiveIndex(null);
	};

	const keyDown = (event: { key: string; preventDefault: () => void }) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			if (!open) {
				return;
			}
			event.preventDefault();
			setActiveIndex((current) => {
				if (current === null) {
					return event.key === 'ArrowDown' ? 0 : suggestions.length - 1;
				}
				const next = current + (event.key === 'ArrowDown' ? 1 : -1);
				return next < 0 ? suggestions.length - 1 : next >= suggestions.length ? 0 : next;
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
			setActiveIndex(null);
		}
	};

	return (
		<div style={{ position: 'relative' }}>
			{/* ARIA-Props müssen auf das Eingabefeld selbst; KoliBri reicht sie als DOM-Attribute durch. */}
			<KolInputText
				_label={label}
				_placeholder="Straße, Hausnummer, Ort …"
				_value={value}
				_on={{
					onChange: (_event, next) => change(String(next ?? '')),
					onInput: (_event, next) => change(String(next ?? '')),
					onKeyDown: (_event, event) => keyDown(event as KeyboardEvent),
				}}
				{...({
					role: 'combobox',
					'aria-autocomplete': 'list',
					'aria-expanded': open,
					'aria-controls': open ? listId : undefined,
					'aria-activedescendant': activeIndex === null ? undefined : `${listId}-option-${activeIndex}`,
				} as Record<string, string | boolean | undefined>)}
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
			{!loading && !error && value.trim().length >= 3 && !open && <div style={{ padding: '8px 0' }}>Keine Treffer — Adresse direkt übernehmen.</div>}

			{open && (
				<ul
					id={listId}
					role="listbox"
					aria-live="polite"
					aria-label={`${suggestions.length} Treffer`}
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
					{suggestions.map((suggestion, index) => (
						<li
							key={`${suggestion.address}-${index}`}
							id={`${listId}-option-${index}`}
							role="option"
							aria-selected={index === activeIndex}
							onMouseDown={(event) => {
								// mousedown statt click: der Blur des Feldes (der die Liste schließt) feuert zuerst.
								event.preventDefault();
								choose(index);
							}}
							style={{
								display: 'block',
								minHeight: '44px', // Touch-Ziel (Regel 2)
								padding: '12px',
								cursor: 'pointer',
								overflowWrap: 'anywhere', // lange display_name umbrechen, nicht abschneiden (Regel 3)
								background: index === activeIndex ? 'var(--pp-surface-2, #f2f2f2)' : undefined,
								fontWeight: index === activeIndex ? 700 : undefined,
							}}
						>
							{suggestion.address}
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
