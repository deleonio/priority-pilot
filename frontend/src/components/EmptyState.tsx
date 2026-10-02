import { KolButton, KolCard, KolInputCheckbox } from '@public-ui/react-v19';
import { useState } from 'react';

interface EmptyStateProps {
	/** Öffnet den Dialog zum Anlegen des ersten Tasks. */
	onCreate: () => void;
	/** Startet den Erststart-Flow erneut (#2070) — der Flow bleibt verdeckt gemountet, der Fortschritt erhalten. */
	onReenter?: () => void;
}

/** Lokale Beispielaufgaben (#2070, PO-Entscheid #1986): rein virtuell — kein Server-Call. */
const EXAMPLE_TASKS = ['15 Minuten spazieren gehen', 'Wichtige E-Mail beantworten', 'Das kommende Wochenende planen'];

/** Liest den von KoliBri gemeldeten Checkbox-Zustand (Boolean oder State-Objekt) als Boolean. */
const readChecked = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'object' && value !== null && 'checked' in value) {
		return Boolean((value as { checked?: unknown }).checked);
	}
	return false;
};

/**
 * Onboarding-Ansicht, wenn noch keine Tasks existieren: Wiedereinstieg in den Erststart-Flow
 * („Was beschäftigt dich gerade?", Wortlaut der Schritt-1-Überschrift) plus lokale, abhakbare
 * Beispielaufgaben (#2070), die beim Ausprobieren keine Server-Daten anlegen.
 */
export const EmptyState = ({ onCreate, onReenter }: EmptyStateProps) => {
	const [checked, setChecked] = useState<boolean[]>(() => EXAMPLE_TASKS.map(() => false));
	return (
		<section className="empty-state">
			<KolCard _label="Was beschäftigt dich gerade?" _level={2}>
				<p>
					Beschreibe, womit du gerade kämpfst — der Flow macht daraus erste Aufgaben. Deine Eingabe bleibt erhalten.
				</p>
				{onReenter !== undefined && (
					<KolButton _label="Flow fortsetzen" _variant="primary" _on={{ onClick: onReenter }} />
				)}
				<p>Beispiele zum Ausprobieren</p>
				<div className="onboarding-cards">
					{EXAMPLE_TASKS.map((title, index) => (
						<KolInputCheckbox
							key={title}
							_label={title}
							_checked={checked[index]}
							_on={{
								onInput: (_event, value) => {
									setChecked((prev) => prev.map((state, i) => (i === index ? readChecked(value) : state)));
								},
							}}
						/>
					))}
				</div>
				<KolButton _label="Ersten Task anlegen" _variant="secondary" _on={{ onClick: onCreate }} />
			</KolCard>
		</section>
	);
};
