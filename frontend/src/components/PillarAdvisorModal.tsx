import { KolAlert, KolBadge, KolButton, KolCard, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { ActivityAdvice, Pillar } from 'client';
import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { useCtrlEnter } from '../lib/useCtrlEnter';
import { readVoiceAutostartPreference } from '../lib/voiceAutostart';
import { Modal } from './Modal';
import { VoiceField } from './VoiceField';

interface PillarAdvisorModalProps {
	/** Die Lebensbalance-Säulen — für die Anzeige der Säulen-Namen zu den vorgeschlagenen Aktivitäten. */
	pillars: Pillar[];
	/**
	 * Aktuelle Säulen-Verteilung, so wie sie im Client (Dashboard „Meine Themen") dargestellt ist:
	 * je Säule Soll-Anteil (`weight`, 0–100 %) und Ist-Anteil (`actualShare`, 0–1). Wird — falls
	 * vorhanden — an den Berater mitgeschickt, damit er die Vorschläge primär auf die schwächsten
	 * (am stärksten unterversorgten) Säulen ausrichtet.
	 */
	distribution?: { pillarId: number; weight: number; actualShare: number }[];
	onClose: () => void;
	/** Übernimmt einen Vorschlag als neue Aufgabe (öffnet die Schnellerfassung vorbelegt, #327). */
	onAdoptActivity?: (text: string) => void;
}

interface AdvisorResultsProps {
	advice: ActivityAdvice[];
	pillars: Pillar[];
	/** Übernimmt einen Vorschlag als neue Aufgabe (öffnet die Schnellerfassung vorbelegt, #327). */
	onAdoptActivity?: (text: string) => void;
}

/**
 * Ergebnisliste des Beraters: je Vorschlag die Aktivität, die Säulen (als Badges, über die
 * `pillarIds` gegen die Säulen-Liste aufgelöst) und die kurze Begründung. Als eigene Komponente
 * exportiert, damit die Zuordnung pillarId → Säulen-Name isoliert testbar ist.
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

/**
 * Aktivitäten-Berater: ein kleiner, Mistral-gestützter Ratgeber (`POST /pillars/advisor`), der
 * konkrete Aktivitäten vorschlägt und zeigt, auf welche Säulen sie einzahlen würden. Als Rubrik
 * dienen serverseitig die Kurzbeschreibungen der Säulen aus den Einstellungen. Die Frage ist
 * optional — ohne Frage schlägt der Berater Aktivitäten über alle Säulen hinweg vor.
 */
export const PillarAdvisorModal = ({ pillars, distribution, onClose, onAdoptActivity }: PillarAdvisorModalProps) => {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// `null` = noch keine Beratung angefragt (kein „Keine Vorschläge"-Hinweis vor der ersten Anfrage).
	const [advice, setAdvice] = useState<ActivityAdvice[] | null>(null);
	const [voiceAutostart] = useState(readVoiceAutostartPreference);

	const question = useRef('');
	// State-Mirror für die Frage-Textarea: KoliBri verwaltet den Anzeigewert selbst, aber ein per
	// Sprach-Transkript geänderter Wert muss über `_value` ins Feld gespiegelt werden.
	const [questionText, setQuestionText] = useState('');

	const consult = async (): Promise<void> => {
		setError(null);
		setLoading(true);
		try {
			const trimmed = question.current.trim();
			// Frage (falls vorhanden) und die aktuelle Säulen-Verteilung (falls vorhanden) an den Berater
			// mitschicken — so richtet er die Vorschläge primär auf die schwächsten Säulen aus.
			const result = await api.advisePillarActivities({
				activityAdvisorInput: {
					...(trimmed === '' ? {} : { question: trimmed }),
					...(distribution && distribution.length > 0 ? { distribution } : {}),
				},
			});
			setAdvice(result.advice);
		} catch (reason) {
			const apiError = await toApiError(reason);
			setError(apiError.message);
		} finally {
			setLoading(false);
		}
	};

	// Strg+Enter (bzw. ⌘+Enter) löst den CTA „Beraten lassen" aus, solange keine Anfrage läuft.
	useCtrlEnter(
		() => void consult(),
		() => !loading,
	);

	return (
		<Modal title="Säulen-Berater" onClose={onClose}>
			{pillars.length === 0 ? (
				<KolCard _label="Keine Säulen definiert" _level={0}>
					<p>
						Keine Säulen definiert — lege zuerst Säulen in den <a href="/settings">Einstellungen</a> an, damit der
						Berater Vorschläge machen kann.
					</p>
				</KolCard>
			) : (
				<>
					<p className="hint">
						Der Berater schlägt dir konkrete Aktivitäten vor und zeigt, auf welche Säulen sie einzahlen würden.
						Beschreibe optional deine Frage oder Situation — ohne Frage bekommst du Vorschläge über alle Säulen hinweg.
					</p>
					{error !== null && (
						<KolAlert _type="error" _label="Beratung fehlgeschlagen">
							{error}
						</KolAlert>
					)}
					<div className="form-grid">
						<VoiceField
							variant="textarea"
							fieldLabel="Deine Frage oder Situation"
							autoStart={voiceAutostart}
							hint="z. B. „Was kann ich am Wochenende für mich tun?“"
							onTranscript={(transcript) => {
								const newVal = question.current ? `${question.current} ${transcript}` : transcript;
								question.current = newVal;
								setQuestionText(newVal);
							}}
						>
							<KolTextarea
								_label="Deine Frage oder Situation (optional)"
								_rows={3}
								_value={questionText}
								_on={{
									onInput: (_event, value) => {
										const newVal = readString(value);
										question.current = newVal;
										setQuestionText(newVal);
									},
								}}
							/>
						</VoiceField>
					</div>
					{loading && (
						<div className="pillar-editor-loading">
							<KolSpin _show _variant="cycle" _label="Berater denkt nach" />
						</div>
					)}
					{!loading && advice !== null && (
						<AdvisorResults advice={advice} pillars={pillars} onAdoptActivity={onAdoptActivity} />
					)}
					<div className="modal-actions">
						<KolButton
							_label={loading ? 'Beraten…' : 'Beraten lassen'}
							_variant="primary"
							_disabled={loading}
							_on={{ onClick: () => void consult() }}
						/>
						<KolButton _label="Schließen" _variant="secondary" _on={{ onClick: onClose }} />
					</div>
				</>
			)}
		</Modal>
	);
};
