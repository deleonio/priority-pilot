/**
 * Icon-only Globus-Badge für Ortsbezug (#1063): zeigt an, dass ein Eintrag (Serie in der Serienliste,
 * erledigter Task in der Erledigt-Liste) eine `address` trägt. Rein informativ — nicht klickbar, kein
 * Filter, kein Tooltip-Handler. Die Adresse selbst wird bewusst NICHT angezeigt (Datensparsamkeit in
 * Listen); ihre Präsenz transportiert das `aria-label` für assistive Technologien (BITV, KI-UX-Block).
 *
 * Bewusst ein `<span role="img">` statt `KolBadge`: der Test-/BITV-Vertrag verlangt `data-testid` und
 * `aria-label` auf DEMSELben Element — bei der Web Component hängt KoliBri das Label in sein
 * Shadow-DOM, ein host-seitiges `aria-label` wäre daneben redundant/fragil. Font-Awesome-Globus statt
 * 🌍-Emoji (Refuse-Liste Emoji-als-Icon-System, ux-design.md Craft Floor).
 */
interface GeoBadgeProps {
	/** Adresse des Ortsbezugs — nur für das `aria-label`, niemals sichtbar. */
	address: string;
}

export const GeoBadge = ({ address }: GeoBadgeProps) => (
	<span className="geo-badge" data-testid="geo-badge" role="img" aria-label={`Standort: ${address}`}>
		<i className="fa-solid fa-globe" aria-hidden="true" />
	</span>
);
