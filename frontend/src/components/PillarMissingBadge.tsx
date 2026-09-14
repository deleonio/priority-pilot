/**
 * Icon-Badge „keine Säulen-Gewichtung" (#1465): markiert in Aufgaben- und Serienliste die
 * Einträge, die auf keine Lebensbalance-Säule einzahlen (`pillars` leer). Es löst das
 * beschreibungs-getriebene „Hinweis"-Badge aus #1430 ab — das sagte nicht, was es aussagt, und
 * hatte mit der Balance nichts zu tun.
 *
 * Rein informativ: nicht klickbar, kein Filter. Bewusst ein `<span role="img">` statt `KolBadge`
 * — dasselbe Muster wie `GeoBadge.tsx`: Test- und BITV-Vertrag (`data-testid` + `aria-label`)
 * gehören auf DASSELBE Element, bei der Web Component läge das Label im Shadow-DOM. Font-Awesome
 * statt Emoji (Refuse-Liste Emoji-als-Icon-System, ux-design.md Craft Floor); die Bedeutung
 * transportiert das `aria-label`, nie die Farbe allein (WCAG 1.4.1).
 */
export const PillarMissingBadge = () => (
	<span
		className="pillar-missing-badge"
		data-testid="pillar-missing-badge"
		role="img"
		aria-label="Keine Säulen-Gewichtung gesetzt"
	>
		<i className="fa-solid fa-scale-unbalanced" aria-hidden="true" />
	</span>
);
