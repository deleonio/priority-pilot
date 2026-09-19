import { KolAlert, KolButton, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

/**
 * Säulen-Ansicht (Issue #439 → #1573): reine Leseansicht der fünf festen Lebensbalance-Säulen.
 * Anlegen, Umbenennen und Löschen sind entfallen — die Säulen adressieren per Definition die
 * Balance im Leben und gelten stets (serverseitig gesperrt, #1573 AK1); die individuelle
 * Gewichtung bleibt über `PillarWeightsForm` editierbar.
 *
 * Drei gestaltete Zustände (docs/mobile-ui-rules.md Regel 7): Laden (`KolSpin`), Fehler
 * (`KolAlert` + „Erneut versuchen") und Erfolg (Liste mit Kurzbeschreibungen, #934). Ein
 * Anlege-CTA im Leerzustand wäre eine Sackgasse — der Info-Hinweis zu den festen Säulen
 * sitzt einmalig in der SettingsPage über der Liste (KI-UX-Block zu #1573).
 */
export const PillarList = () => {
	const [pillars, setPillars] = useState<Pillar[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const loadPillars = useCallback(async () => {
		try {
			setPillars(await api.listPillars());
			// Fehler nach erfolgreichem Nachladen zurücknehmen — sonst bleibt die Meldung eines
			// gescheiterten Versuchs über der bereits wieder gefüllten Liste stehen (Muster GroupsSection).
			setError(null);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPillars();
	}, [loadPillars]);

	// ── Render ───────────────────────────────────────────────────────────────

	return (
		<div className="pillar-list">
			{/* Fehler als `KolAlert` statt als `<p className="error-message">`: die Klasse hatte app-weit
			    keine einzige CSS-Regel, der Fehler stand als normaler Fließtext ohne Fehler-Affordanz
			    über der Liste. Muster wie `GroupsSection` (Meldungen sind KoliBri, DESIGN.md). */}
			{error !== null && (
				<KolAlert _type="error" _label="Säulen konnten nicht geladen werden">
					<p>{error}</p>
					<KolButton _label="Erneut versuchen" _variant="secondary" _on={{ onClick: () => void loadPillars() }} />
				</KolAlert>
			)}

			{loading ? (
				<KolSpin _show _variant="cycle" _label="Säulen werden geladen …" />
			) : pillars.length === 0 && error === null ? (
				/* Kein Anlege-CTA mehr (Anlegen ist gesperrt) und kein zweiter Info-Alert: Der
				   durchgehende Hinweis zu den festen Säulen sitzt in SettingsPage (#1573 AK2) —
				   hier nur ein schlichter Marker, damit der Leerzustand (nach der Migration
				   praktisch unerreichbar) nicht leer wirkt. */
				<p className="hint">Derzeit sind keine Säulen vorhanden.</p>
			) : (
				<ul className="pillar-items">
					{pillars.map((pillar) => (
						<li key={pillar.id} className="pillar-item" data-pillar-id={pillar.id}>
							<div className="pillar-info">
								<KolHeading _label={pillar.name} _level={3} />
								{pillar.description && <p className="hint pillar-list-description">{pillar.description}</p>}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};
