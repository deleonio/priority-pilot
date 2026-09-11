import { KolBadge, KolButton } from '@public-ui/react-v19';
import type { ActivityAdvice, Pillar } from 'client';
import { useMemo } from 'react';

interface AdvisorResultsProps {
	advice: ActivityAdvice[];
	pillars: Pillar[];
	/** Übernimmt einen Vorschlag als Freitext in den Anlege-Dialog (#327, seit #1335 ohne Dialogwechsel). */
	onAdoptActivity?: (text: string) => void;
}

/**
 * Ergebnisliste des Aktivitäten-Beraters (`POST /pillars/advisor`): je Vorschlag die Aktivität, die
 * Säulen (als Badges, über die `pillarIds` gegen die Säulen-Liste aufgelöst) und die kurze
 * Begründung. Als eigene Komponente exportiert, damit die Zuordnung pillarId → Säulen-Name isoliert
 * testbar ist; gerendert wird sie seit #1335 im verschmolzenen Anlege-Dialog
 * ({@link ./QuickCaptureModal.tsx QuickCaptureModal}) statt in einem eigenen Berater-Dialog.
 */
export const AdvisorResults = ({ advice, pillars, onAdoptActivity }: AdvisorResultsProps) => {
	const pillarNameById = useMemo(() => new Map(pillars.map((pillar) => [pillar.id, pillar.name])), [pillars]);

	if (advice.length === 0) {
		return <p className="hint">Der Berater hat keine Vorschläge geliefert — versuche es mit einer anderen Frage.</p>;
	}

	return (
		<>
			<ul className="advisor-results">
				{advice.map((entry, index) => (
					<li key={index} className="advisor-result">
						<div className="advisor-result-head">
							<span className="advisor-activity">{entry.activity}</span>
							<span className="advisor-pillars">
								{entry.pillarIds.map((pillarId) => (
									<KolBadge key={pillarId} _label={pillarNameById.get(pillarId) ?? `Säule ${pillarId}`} />
								))}
							</span>
						</div>
						{entry.reason !== '' && <p className="hint advisor-reason">{entry.reason}</p>}
						{onAdoptActivity !== undefined && (
							<KolButton
								_label="Als Aufgabe übernehmen"
								_variant="secondary"
								// Natives onClick statt _on.onClick: jsdom legt _on nur als inerte Property ab (kein DOM-Listener), sodass der Klick im Test nicht feuern würde.
								onClick={() => onAdoptActivity(entry.activity)}
							/>
						)}
					</li>
				))}
			</ul>
		</>
	);
};
