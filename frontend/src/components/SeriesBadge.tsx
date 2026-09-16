/**
 * Icon-Badge „Serienaufgabe" (#1518): kennzeichnet in der Aufgabenliste die eine sichtbare Instanz
 * einer Serie. Es ersetzt das Text-Badge „Serie" — die Liste zeigt je Serie nur noch die aktuelle
 * Instanz, das Icon spart Breite in der Badge-Zeile (375px).
 *
 * Rein informativ: nicht klickbar, kein Filter. Bewusst ein `<span role="img">` statt `KolBadge`
 * — dasselbe Muster wie `GeoBadge.tsx`/`PillarMissingBadge.tsx`: Test- und BITV-Vertrag
 * (`data-testid` + `aria-label`) gehören auf DASSELBE Element, bei der Web Component läge das Label
 * im Shadow-DOM. Font-Awesome-Repeat (wie die Serien-Aktion in `CompletedTasksTable.tsx`) statt
 * Emoji; die Bedeutung transportiert der Screenreader-Text, nie Farbe oder Icon allein (WCAG 1.4.1).
 */
export const SeriesBadge = () => (
	<span className="series-badge" data-testid="series-badge" role="img" aria-label="Serienaufgabe">
		<i className="fa-solid fa-repeat" aria-hidden="true" />
	</span>
);
