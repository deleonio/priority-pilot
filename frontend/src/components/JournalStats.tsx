import { KolAlert, KolInputDate, KolInputRadio, KolSpin } from '@public-ui/react-v19';
import type { JournalStats as JournalStatsDto, Pillar } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { formatDate, readDate, tagVorHeute, toDateValue, today } from '../lib/journalDate';
import { readString } from '../lib/inputValue';

/**
 * Statistik-Sektion des Journals (#2213, KI-UX-Block): Eintragsanzahl je Säule, ohne Säule und
 * gesamt über einen wählbaren Zeitraum (Täglich/Wöchentlich, vorbelegt die letzten 28 Tage),
 * daneben der Balance-Verlauf (#1424) als zweite Reihe — Füllstand gesamt und Punkte je Säule
 * zum Fensterende. Fenster ohne Einträge werden nicht als leere Blöcke wiederholt; ist der
 * ganze Zeitraum leer, lädt der Leerzustand zum Erfassen ein.
 */
export const JournalStats = ({ pillars }: { pillars: Pillar[] }) => {
	const [stats, setStats] = useState<JournalStatsDto | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [von, setVon] = useState(tagVorHeute(27));
	const [bis, setBis] = useState(today());
	const [granularitaet, setGranularitaet] = useState<'tag' | 'woche'>('tag');

	useEffect(() => {
		if (!von || !bis) return;
		let active = true;
		setLoadError(null);
		api
			.getJournalStats({ von, bis, granularitaet })
			.then((body) => {
				if (active) setStats(body);
			})
			.catch(async (reason) => {
				if (active) setLoadError((await toApiError(reason)).message);
			});
		return () => {
			active = false;
		};
	}, [von, bis, granularitaet]);

	const pillarName = (pillarId: number): string =>
		pillars.find((pillar) => pillar.id === pillarId)?.name ?? `Säule ${pillarId}`;

	const gefuellt = (stats?.fenster ?? []).filter((fenster) => fenster.gesamt > 0);

	return (
		<div className="journal-stats">
			<KolInputDate
				_label="Von"
				_type="date"
				_value={toDateValue(von)}
				_on={{ onChange: (_event, value) => setVon(readDate(value)) }}
			/>
			<KolInputDate
				_label="Bis"
				_type="date"
				_value={toDateValue(bis)}
				_on={{ onChange: (_event, value) => setBis(readDate(value)) }}
			/>
			<KolInputRadio
				_label="Granularität"
				_options={[
					{ label: 'Täglich', value: 'tag' },
					{ label: 'Wöchentlich', value: 'woche' },
				]}
				_value={granularitaet}
				_on={{ onChange: (_event, value) => setGranularitaet(readString(value) === 'woche' ? 'woche' : 'tag') }}
			/>
			{loadError !== null && (
				<KolAlert _type="error" _label="Fehler">
					{loadError}
				</KolAlert>
			)}
			{stats === null && loadError === null && <KolSpin _show _variant="cycle" _label="Statistik wird geladen" />}
			{stats !== null && gefuellt.length === 0 && (
				<p>Noch keine Einträge im gewählten Zeitraum. Halte im Journal fest, was dich bewegt hat.</p>
			)}
			{gefuellt.length > 0 && (
				<ul className="journal-stats__list">
					{gefuellt.map((fenster) => {
						const stand = stats?.balanceVerlauf.find((eintrag) => eintrag.tag === fenster.bis);
						return (
							<li key={fenster.von} className="journal-stats__item">
								<p className="journal-stats__label">
									{fenster.von !== fenster.bis ? `Woche vom ${formatDate(fenster.von)}` : formatDate(fenster.von)}
								</p>
								<p className="journal-stats__zeile">Gesamt: {fenster.gesamt}</p>
								<p className="journal-stats__zeile">Ohne Säule: {fenster.ohneSaeule}</p>
								<ul className="journal-stats__saeulen">
									{fenster.proSaeule
										.filter((eintrag) => eintrag.anzahl > 0)
										.map((eintrag) => (
											<li key={eintrag.pillarId}>
												{pillarName(eintrag.pillarId)}: {eintrag.anzahl} {eintrag.anzahl === 1 ? 'Eintrag' : 'Einträge'}{' '}
												· {stand?.saeulen.find((saeule) => saeule.id === eintrag.pillarId)?.punkte ?? 0} Punkte
											</li>
										))}
								</ul>
								<p className="journal-stats__zeile">Füllstand: {stand?.fuellstandProzent ?? 0} %</p>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};
