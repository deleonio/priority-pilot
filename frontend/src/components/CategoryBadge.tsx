import { KolBadge } from '@public-ui/react-v19';
import type { Category } from 'client';

interface CategoryBadgeProps {
	/** Die Kategorie der Aufgabe/Serie; `null`/`undefined` rendert nichts. */
	category: Category | null | undefined;
}

/**
 * Kategorie-Badge für Aufgaben-, Erledigt- und Serienlisten. `KolBadge` bekommt die Farbe als
 * Hex-Wert und rechnet die Textfarbe kontraststark dazu aus (`spec/badge`) — deshalb braucht es
 * hier kein eigenes Styling außer der gemeinsamen Badge-Klasse der Listenzeilen.
 *
 * Der Name steht immer im Badge: Die Farbe ist Wiedererkennung, nie alleiniger Bedeutungsträger
 * (DESIGN.md, Relief-Regel der Säulen-Rampe).
 */
export const CategoryBadge = ({ category }: CategoryBadgeProps) => {
	if (!category) {
		return null;
	}
	return <KolBadge _label={category.name} _color={category.color} className="task-tree-badge" />;
};
