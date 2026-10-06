import { KolAlert, KolButton, KolHeading, KolSpin } from '@public-ui/react-v19';
import type { GroupChallenge } from 'client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { rasterisiere } from '../lib/karteRasterisieren';
import { balanceText, challengeDateiname, erzeugeChallengeKarteSvg } from '../lib/challengeShareCard';

const TAG_MS = 24 * 60 * 60 * 1000;
const CHALLENGE_TAGE = 7;

/** Datum kurz und deutsch („12.10.“) — Zeitraum-Angaben der Karte. */
const kurzDatum = (iso: string): string =>
	new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

/**
 * Gruppen-Challenge (#1992) in der Gruppenansicht: ohne Challenge eine Einladung mit Start-Aktion,
 * während der Laufzeit Restlaufzeit + Rangfolge, nach Ablauf die Abschluss-Karte mit Teilen (AK5).
 * Die Rangfolge misst Ausgewogenheit, nicht Menge; Mitglieder ohne Punkte stehen ohne Platz am
 * Ende („Noch kein Wert“, Fürsorge-Tonalität). Der Start ist für alle sichtbar und läuft sieben
 * Tage — deshalb eine leichte Inline-Bestätigung mit Klartext statt eines Direktstarts.
 */
export const GroupChallengeCard = ({ groupId }: { groupId: number }) => {
	// `undefined` = erster Ladevorgang, `null` = die Gruppe hatte noch keine Challenge.
	const [challenge, setChallenge] = useState<GroupChallenge | null | undefined>(undefined);
	const [error, setError] = useState<string | null>(null);
	const [bestaetigen, setBestaetigen] = useState(false);
	const [meldung, setMeldung] = useState('');

	const load = useCallback(async (): Promise<void> => {
		try {
			setChallenge((await api.getGroupChallenge({ id: groupId })) ?? null);
		} catch (reason) {
			setError(`${(await toApiError(reason)).message} Öffne die Gruppe erneut, um es noch einmal zu versuchen.`);
			setChallenge(null);
		}
	}, [groupId]);

	useEffect(() => {
		void load();
	}, [load]);

	const starten = async (): Promise<void> => {
		setBestaetigen(false);
		try {
			setChallenge(await api.startGroupChallenge({ id: groupId }));
			setError(null);
			setMeldung('Die Challenge läuft.');
		} catch (reason) {
			// 409 „läuft bereits“ kommt als Server-Meldung — danach den aktuellen Stand zeigen.
			setError((await toApiError(reason)).message);
			await load();
		}
	};

	const teilen = async (abgeschlossen: GroupChallenge): Promise<void> => {
		const zeitraum = `${kurzDatum(abgeschlossen.startsAt)} – ${kurzDatum(abgeschlossen.endsAt)}`;
		let blob: Blob;
		try {
			blob = await rasterisiere(
				erzeugeChallengeKarteSvg({ gruppe: abgeschlossen.gruppe, zeitraum, rangfolge: abgeschlossen.rangfolge }),
			);
		} catch {
			setError('Die Karte ließ sich nicht erzeugen.');
			return;
		}
		const datei = new File([blob], challengeDateiname(abgeschlossen.startsAt), { type: 'image/png' });
		if (navigator.canShare?.({ files: [datei] })) {
			try {
				await navigator.share({ files: [datei], title: abgeschlossen.gruppe, text: `7-Tage-Challenge ${zeitraum}` });
				return;
			} catch (fehler) {
				// Abbruch des Systemdialogs ist keine Störung (Muster MonthlyBalanceCard).
				if ((fehler as DOMException)?.name === 'AbortError') {
					return;
				}
			}
		}
		const url = URL.createObjectURL(blob);
		const anker = document.createElement('a');
		anker.href = url;
		anker.download = datei.name;
		document.body.append(anker);
		anker.click();
		anker.remove();
		URL.revokeObjectURL(url);
	};

	const endeDatum = kurzDatum(new Date(Date.now() + CHALLENGE_TAGE * TAG_MS).toISOString());
	const startAktion = (variant: 'primary' | 'secondary', label: string) =>
		bestaetigen ? (
			<div className="group-challenge-bestaetigung">
				<p>{`Startet jetzt und endet am ${endeDatum} — für alle Mitglieder sichtbar.`}</p>
				<KolButton _label="Challenge starten" _variant="primary" _on={{ onClick: () => void starten() }} />
				<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: () => setBestaetigen(false) }} />
			</div>
		) : (
			<KolButton _label={label} _variant={variant} _on={{ onClick: () => setBestaetigen(true) }} />
		);

	const restTage = challenge ? Math.max(1, Math.ceil((new Date(challenge.endsAt).getTime() - Date.now()) / TAG_MS)) : 0;

	return (
		<section className="group-challenge" data-testid="group-challenge">
			<KolHeading _label="7-Tage-Challenge" _level={4} />
			<div aria-live="polite" className="visually-hidden">
				{meldung}
			</div>
			{error !== null && (
				<KolAlert _type="error" _label="Challenge">
					{error}
				</KolAlert>
			)}
			{challenge === undefined ? (
				<KolSpin _show _variant="cycle" _label="Challenge wird geladen …" />
			) : challenge === null ? (
				<>
					<p className="hint">Eine Woche, in der es um Ausgewogenheit geht — nicht um die Menge erledigter Aufgaben.</p>
					{startAktion('primary', '7-Tage-Challenge starten')}
				</>
			) : (
				<>
					<p className="group-challenge-zeit">
						{challenge.status === 'laufend'
							? `Noch ${restTage} ${restTage === 1 ? 'Tag' : 'Tage'} · bis ${kurzDatum(challenge.endsAt)}`
							: `Abgeschlossen · ${kurzDatum(challenge.startsAt)} – ${kurzDatum(challenge.endsAt)}`}
					</p>
					<ol className="group-challenge-rangliste" aria-label="Rangfolge nach Ausgewogenheit">
						{challenge.rangfolge.map((eintrag, index) => {
							const geteilt = challenge.rangfolge.filter((andere) => andere.rang === eintrag.rang).length > 1;
							return (
								<li key={`${eintrag.name}-${index}`} className="group-challenge-zeile">
									<span className="group-challenge-rang">
										{eintrag.balance === null ? '' : `Platz ${eintrag.rang}${geteilt ? ' (geteilt)' : ''}`}
									</span>
									<span className="group-challenge-name">{eintrag.name}</span>
									<span className="group-challenge-wert">{balanceText(eintrag.balance)}</span>
								</li>
							);
						})}
					</ol>
					{challenge.status === 'beendet' && (
						<div className="group-challenge-aktionen">
							<p className="hint">Danke für eine Woche, in der ihr auf Ausgewogenheit geachtet habt.</p>
							<KolButton _label="Teilen" _variant="primary" _on={{ onClick: () => void teilen(challenge) }} />
							{startAktion('secondary', 'Neue Challenge starten')}
						</div>
					)}
				</>
			)}
		</section>
	);
};
