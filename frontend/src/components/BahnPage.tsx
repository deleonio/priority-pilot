import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Öffentliche Bahn-Routenplaner-Seite (#225), erreichbar unter `/bahn` ohne Anmeldung.
 *
 * Die Seite spricht ausschließlich den Backend-Proxy (#224) an:
 *   - `GET /api/transit/geocode?q=…`  → Bahnhof-Autocomplete (Start/Ziel)
 *   - `GET /api/transit/plan?…`       → Verbindungssuche
 *
 * Bewusst mit **nativen** HTML-Elementen aufgebaut (statt KoliBri-Web-Components): Die Seite ist
 * öffentlich, extrem schlank und ihre Zugänglichkeits-Rollen (`textbox`, `option`, `alert`) müssen
 * deterministisch und ohne Shadow-DOM-Eigenheiten funktionieren. Alle Texte sind auf Deutsch.
 */

/** Ein vom Geocoder gelieferter Bahnhof-/Ortsvorschlag. */
interface GeocodeSuggestion {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

/** Ein Teilabschnitt (Leg) einer Verbindung. */
interface Leg {
	mode?: string;
	from?: { name?: string; departure?: string };
	to?: { name?: string; arrival?: string };
	delay?: number;
}

/** Eine einzelne Verbindung (Itinerary) aus der Plan-Antwort. */
interface Itinerary {
	duration?: number;
	startTime?: string;
	endTime?: string;
	transfers?: number;
	legs?: Leg[];
}

/** Antwortform von `GET /api/transit/plan`. */
interface PlanResponse {
	itineraries?: Itinerary[];
}

/** Debounce-Zeit (ms) für das Autocomplete, damit nicht jeder Tastenanschlag eine Anfrage auslöst. */
const AUTOCOMPLETE_DEBOUNCE_MS = 250;

/** Ab dieser Eingabelänge wird der Geocoder befragt. */
const MIN_QUERY_LENGTH = 2;

/** Formatiert einen ISO-Zeitstempel als deutsche Uhrzeit (HH:MM). Bei Fehlern: Rohwert. */
const formatTime = (iso: string | undefined): string => {
	if (iso === undefined) {
		return '–';
	}
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}
	return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(
		date,
	);
};

/** Formatiert eine Dauer in Sekunden als „1 h 45 min" bzw. „45 min". */
const formatDuration = (seconds: number | undefined): string => {
	if (seconds === undefined || Number.isNaN(seconds)) {
		return '–';
	}
	const totalMinutes = Math.round(seconds / 60);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours === 0) {
		return `${minutes} min`;
	}
	return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
};

/** Baut aus zwei Datumsteilen eine ISO-Startzeit für die Plan-Anfrage. */
const buildDepartureIso = (dateValue: string, timeValue: string): string | null => {
	if (dateValue === '' || timeValue === '') {
		return null;
	}
	const composed = new Date(`${dateValue}T${timeValue}`);
	if (Number.isNaN(composed.getTime())) {
		return null;
	}
	return composed.toISOString();
};

/** Ruft den Geocoder auf und liefert die Vorschlagsliste. Wirft bei HTTP-Fehlern. */
const fetchGeocode = async (query: string, signal: AbortSignal): Promise<GeocodeSuggestion[]> => {
	const response = await fetch(`/api/transit/geocode?q=${encodeURIComponent(query)}`, { signal });
	if (!response.ok) {
		throw new Error(`Geocode fehlgeschlagen (HTTP ${response.status}).`);
	}
	const data = (await response.json()) as GeocodeSuggestion[];
	return Array.isArray(data) ? data : [];
};

/** Ein Autocomplete-Bahnhofsfeld mit Vorschlagsliste (ARIA-Combobox-Muster, native Elemente). */
interface StationInputProps {
	id: string;
	label: string;
	placeholder: string;
	value: string;
	selected: GeocodeSuggestion | null;
	onSelect: (suggestion: GeocodeSuggestion) => void;
	onChangeText: (text: string) => void;
}

const StationInput = ({ id, label, placeholder, value, selected, onSelect, onChangeText }: StationInputProps) => {
	const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
	const [open, setOpen] = useState<boolean>(false);
	const [focusedIndex, setFocusedIndex] = useState<number>(-1);
	const listId = `${id}-listbox`;
	const optionIdPrefix = `${id}-option`;

	useEffect(() => {
		// Ein bereits gewählter Bahnhof (dessen Name im Feld steht) löst keine erneute Suche aus.
		if (value.trim().length < MIN_QUERY_LENGTH || (selected !== null && selected.name === value)) {
			setSuggestions([]);
			setOpen(false);
			setFocusedIndex(-1);
			return;
		}
		const controller = new AbortController();
		const timer = window.setTimeout(() => {
			fetchGeocode(value.trim(), controller.signal)
				.then((results) => {
					setSuggestions(results);
					setOpen(results.length > 0);
					setFocusedIndex(-1);
				})
				.catch(() => {
					// Autocomplete-Fehler bleiben still: Der Nutzer kann weitertippen; harte Fehler
					// werden erst bei der eigentlichen Verbindungssuche prominent gemeldet.
					setSuggestions([]);
					setOpen(false);
					setFocusedIndex(-1);
				});
		}, AUTOCOMPLETE_DEBOUNCE_MS);
		return () => {
			controller.abort();
			window.clearTimeout(timer);
		};
	}, [value, selected]);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
		if (!open || suggestions.length === 0) return;
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			setFocusedIndex((prev) => (prev + 1) % suggestions.length);
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			setFocusedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
		} else if (event.key === 'Enter' && focusedIndex >= 0) {
			event.preventDefault();
			onSelect(suggestions[focusedIndex]);
			setOpen(false);
			setFocusedIndex(-1);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			setOpen(false);
			setFocusedIndex(-1);
		}
	};

	return (
		<div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
			<label htmlFor={id} style={{ fontWeight: 600 }}>
				{label}
			</label>
			<input
				id={id}
				type="text"
				role="combobox"
				aria-expanded={open}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={focusedIndex >= 0 ? `${optionIdPrefix}-${focusedIndex}` : undefined}
				autoComplete="off"
				placeholder={placeholder}
				value={value}
				onChange={(event) => {
					onChangeText(event.target.value);
				}}
				onKeyDown={handleKeyDown}
				onBlur={() => {
					window.setTimeout(() => {
						setOpen(false);
						setFocusedIndex(-1);
					}, 150);
				}}
				style={{ padding: '0.5rem 0.75rem', fontSize: '1rem', border: '1px solid #888', borderRadius: '0.375rem' }}
			/>
			{open && suggestions.length > 0 && (
				<ul
					id={listId}
					role="listbox"
					aria-label={`Vorschläge für ${label}`}
					style={{
						position: 'absolute',
						top: '100%',
						left: 0,
						right: 0,
						zIndex: 10,
						margin: 0,
						padding: 0,
						listStyle: 'none',
						background: '#fff',
						color: '#1a1a1a',
						border: '1px solid #888',
						borderRadius: '0.375rem',
						boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
						maxHeight: '16rem',
						overflowY: 'auto',
					}}
				>
					{suggestions.map((suggestion, index) => (
						<li
							key={suggestion.id}
							id={`${optionIdPrefix}-${index}`}
							role="option"
							aria-selected={selected?.id === suggestion.id}
						>
							<button
								type="button"
								tabIndex={-1}
								onClick={() => {
									onSelect(suggestion);
									setOpen(false);
									setFocusedIndex(-1);
								}}
								style={{
									display: 'block',
									width: '100%',
									textAlign: 'left',
									padding: '0.5rem 0.75rem',
									background: focusedIndex === index ? '#e8eefa' : 'transparent',
									border: 'none',
									cursor: 'pointer',
									font: 'inherit',
								}}
							>
								{suggestion.name}
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

/** Rendert eine einzelne Verbindungskarte mit Abfahrt, Ankunft, Dauer, Umstiegen und Verspätung. */
const ConnectionCard = ({ itinerary }: { itinerary: Itinerary }) => {
	const firstLeg = itinerary.legs?.[0];
	const lastLeg = itinerary.legs?.[itinerary.legs.length - 1];
	const departure = itinerary.startTime ?? firstLeg?.from?.departure;
	const arrival = itinerary.endTime ?? lastLeg?.to?.arrival;
	const transfers = itinerary.transfers ?? Math.max((itinerary.legs?.length ?? 1) - 1, 0);
	const maxDelayMinutes = Math.max(0, ...(itinerary.legs ?? []).map((leg) => Math.round((leg.delay ?? 0) / 60)));

	return (
		<article
			data-testid="connection-card"
			style={{
				border: '1px solid #ccc',
				borderRadius: '0.5rem',
				padding: '1rem',
				display: 'flex',
				flexDirection: 'column',
				gap: '0.5rem',
				background: '#fff',
				color: '#1a1a1a',
			}}
		>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'baseline',
					gap: '1rem',
					flexWrap: 'wrap',
				}}
			>
				<span style={{ fontSize: '1.25rem', fontWeight: 700 }}>
					{`Abfahrt ${formatTime(departure)} · Ankunft ${formatTime(arrival)} · Dauer ${formatDuration(itinerary.duration)}`}
				</span>
			</div>
			<div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', color: '#555' }}>
				<span>
					{transfers === 0 ? 'Direktverbindung (0 Umstiege)' : `${transfers} Umstieg${transfers === 1 ? '' : 'e'}`}
				</span>
				{maxDelayMinutes > 0 ? (
					<span style={{ color: '#b00020', fontWeight: 600 }}>Verspätung: +{maxDelayMinutes} min</span>
				) : (
					<span style={{ color: '#0a7d28' }}>Pünktlich</span>
				)}
			</div>
			<ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#333' }}>
				{(itinerary.legs ?? []).map((leg, index) => (
					<li key={`${leg.from?.name ?? 'start'}-${leg.to?.name ?? 'ziel'}-${index}`}>
						{leg.from?.name ?? 'Start'} <span aria-hidden="true">→</span> {leg.to?.name ?? 'Ziel'}
						{leg.mode !== undefined ? ` (${leg.mode})` : ''}
					</li>
				))}
			</ol>
		</article>
	);
};

export const BahnPage = () => {
	const now = new Date();
	const defaultDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(now);
	const defaultTime = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'Europe/Berlin',
	}).format(now);

	const [startText, setStartText] = useState<string>('');
	const [zielText, setZielText] = useState<string>('');
	const [startStation, setStartStation] = useState<GeocodeSuggestion | null>(null);
	const [zielStation, setZielStation] = useState<GeocodeSuggestion | null>(null);
	const [date, setDate] = useState<string>(defaultDate);
	const [time, setTime] = useState<string>(defaultTime);

	const [itineraries, setItineraries] = useState<Itinerary[]>([]);
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [searched, setSearched] = useState<boolean>(false);
	const activeSearch = useRef<AbortController | null>(null);

	useEffect(
		() => () => {
			activeSearch.current?.abort();
		},
		[],
	);

	const handleSearch = useCallback(async (): Promise<void> => {
		setError(null);
		if (startStation === null || zielStation === null) {
			setError('Bitte wähle einen Start- und einen Zielbahnhof aus der Vorschlagsliste aus.');
			return;
		}
		activeSearch.current?.abort();
		const controller = new AbortController();
		activeSearch.current = controller;
		setLoading(true);
		setSearched(true);
		setItineraries([]);
		try {
			const params = new URLSearchParams({
				fromLat: String(startStation.lat),
				fromLon: String(startStation.lon),
				toLat: String(zielStation.lat),
				toLon: String(zielStation.lon),
				from: startStation.id,
				to: zielStation.id,
			});
			const departureIso = buildDepartureIso(date, time);
			if (departureIso !== null) {
				params.set('time', departureIso);
			}
			const response = await fetch(`/api/transit/plan?${params.toString()}`, { signal: controller.signal });
			if (!response.ok) {
				throw new Error(`Die Verbindungssuche ist fehlgeschlagen (HTTP ${response.status}).`);
			}
			const data = (await response.json()) as PlanResponse;
			setItineraries(Array.isArray(data.itineraries) ? data.itineraries : []);
		} catch (reason) {
			if (reason instanceof DOMException && reason.name === 'AbortError') {
				return;
			}
			setError(
				'Die Verbindungssuche ist momentan nicht erreichbar. Bitte versuche es später erneut oder prüfe deine Eingaben.',
			);
		} finally {
			if (activeSearch.current === controller) {
				setLoading(false);
			}
		}
	}, [startStation, zielStation, date, time]);

	return (
		<main
			style={{
				maxWidth: '48rem',
				margin: '0 auto',
				padding: '2rem 1rem',
				display: 'flex',
				flexDirection: 'column',
				gap: '1.5rem',
				fontFamily: 'system-ui, sans-serif',
			}}
		>
			<header>
				<h1 style={{ margin: 0 }}>Bahn-Routenplaner</h1>
				<p style={{ marginTop: '0.5rem', color: '#555' }}>
					Finde Zugverbindungen zwischen zwei Bahnhöfen. Gib Start und Ziel ein und wähle einen Vorschlag aus.
				</p>
			</header>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					void handleSearch();
				}}
				style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
			>
				<StationInput
					id="bahn-start"
					label="Startbahnhof"
					placeholder="z. B. Berlin Hbf"
					value={startText}
					selected={startStation}
					onChangeText={(text) => {
						setStartText(text);
						setStartStation(null);
					}}
					onSelect={(suggestion) => {
						setStartStation(suggestion);
						setStartText(suggestion.name);
					}}
				/>

				<StationInput
					id="bahn-ziel"
					label="Zielbahnhof"
					placeholder="z. B. München Hbf"
					value={zielText}
					selected={zielStation}
					onChangeText={(text) => {
						setZielText(text);
						setZielStation(null);
					}}
					onSelect={(suggestion) => {
						setZielStation(suggestion);
						setZielText(suggestion.name);
					}}
				/>

				<div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
						<label htmlFor="bahn-date" style={{ fontWeight: 600 }}>
							Datum
						</label>
						<input
							id="bahn-date"
							type="date"
							value={date}
							onChange={(event) => {
								setDate(event.target.value);
							}}
							style={{
								padding: '0.5rem 0.75rem',
								fontSize: '1rem',
								border: '1px solid #888',
								borderRadius: '0.375rem',
							}}
						/>
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
						<label htmlFor="bahn-time" style={{ fontWeight: 600 }}>
							Uhrzeit
						</label>
						<input
							id="bahn-time"
							type="time"
							value={time}
							onChange={(event) => {
								setTime(event.target.value);
							}}
							style={{
								padding: '0.5rem 0.75rem',
								fontSize: '1rem',
								border: '1px solid #888',
								borderRadius: '0.375rem',
							}}
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					style={{
						padding: '0.75rem 1.5rem',
						fontSize: '1rem',
						fontWeight: 600,
						color: '#fff',
						background: loading ? '#666' : '#1a4fd8',
						border: 'none',
						borderRadius: '0.375rem',
						cursor: loading ? 'progress' : 'pointer',
						alignSelf: 'flex-start',
					}}
				>
					{loading ? 'Suche läuft …' : 'Verbindungen suchen'}
				</button>
			</form>

			{error !== null && (
				<div
					role="alert"
					style={{
						padding: '1rem',
						border: '1px solid #b00020',
						borderRadius: '0.375rem',
						background: '#fdecea',
						color: '#b00020',
					}}
				>
					{error}
				</div>
			)}

			<section aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
				{loading && <p>Verbindungen werden gesucht …</p>}
				{!loading && searched && error === null && itineraries.length === 0 && (
					<p>Keine Verbindungen für diese Auswahl gefunden.</p>
				)}
				{itineraries.map((itinerary, index) => (
					<ConnectionCard key={`${itinerary.startTime ?? 'itin'}-${index}`} itinerary={itinerary} />
				))}
			</section>
		</main>
	);
};
