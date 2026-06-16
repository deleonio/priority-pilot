import { KolButton, KolCard } from '@public-ui/react-v19';

interface EmptyStateProps {
	/** Öffnet den Dialog zum Anlegen des ersten Tasks. */
	onCreate: () => void;
}

/**
 * Onboarding-Ansicht, wenn noch keine Tasks existieren: statt leerer Dashboard-, Tabellen- und
 * Wald-Widgets ein fokussierter Hinweis mit primärem Aufruf zur Aktion („Ersten Task anlegen").
 */
export const EmptyState = ({ onCreate }: EmptyStateProps) => (
	<section className="empty-state">
		<KolCard _label="Noch keine Aufgaben" _level={2}>
			<p>Lege deine erste Aufgabe an, um Priorisierung, wichtigste Tasks und anstehende Deadlines zu sehen.</p>
			<KolButton _label="Ersten Task anlegen" _variant="primary" _on={{ onClick: onCreate }} />
		</KolCard>
	</section>
);
