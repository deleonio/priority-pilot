/**
 * Icon-Badge „Angepinnt" (#1582): kennzeichnet in der Aufgabenliste eine angepinnte Aufgabe. Es
 * ersetzt den Pin-Schalter, der bis dahin dauerhaft in der Zeile stand — die Aktion selbst liegt
 * jetzt als Toolbar-Item hinter dem „…"-Popover, sichtbar bleibt nur noch der Zustand.
 *
 * Rein informativ: nicht klickbar, kein Filter. Bewusst ein `<span role="img">` statt `KolBadge`
 * — dasselbe Muster wie `SeriesBadge.tsx`/`GeoBadge.tsx`: Test- und BITV-Vertrag (`data-testid` +
 * `aria-label`) gehören auf DASSELBE Element, bei der Web Component läge das Label im Shadow-DOM.
 * Die Bedeutung transportiert der Screenreader-Text, nie Farbe oder Icon allein (WCAG 1.4.1).
 */
export const PinnedBadge = () => (
	<span className="pinned-badge" data-testid="pinned-badge" role="img" aria-label="Angepinnt">
		<i className="fa-solid fa-thumbtack" aria-hidden="true" />
	</span>
);
