import { KolAlert, KolInputDate, KolInputRadio, KolSpin } from '@public-ui/react-v19';
import type { JournalStats as JournalStatsDto, Pillar } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
	const { t } = useTranslation('capture');
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
		pillars.find((pillar) => pillar.id === pillarId)?.name ?? t('journalStats.pillarFallback', { id: pillarId });

	const gefuellt = (stats?.fenster ?? []).filter((fenster) => fenster.gesamt > 0);

	return (
		<div className="journal-stats">
			<KolInputDate
				_label={t('journalStats.from')}
				_type="date"
				_value={toDateValue(von)}
				_on={{ onChange: (_event, value) => setVon(readDate(value)) }}
			/>
			<KolInputDate
				_label={t('journalStats.to')}
				_type="date"
				_value={toDateValue(bis)}
				_on={{ onChange: (_event, value) => setBis(readDate(value)) }}
			/>
			<KolInputRadio
				_label={t('journalStats.granularity')}
				_options={[
					{ label: t('journalStats.daily'), value: 'tag' },
					{ label: t('journalStats.weekly'), value: 'woche' },
				]}
				_value={granularitaet}
				_on={{ onChange: (_event, value) => setGranularitaet(readString(value) === 'woche' ? 'woche' : 'tag') }}
			/>
			{loadError !== null && (
				<KolAlert _type="error" _label={t('journal.error')}>
					{loadError}
				</KolAlert>
			)}
			{stats === null && loadError === null && <KolSpin _show _variant="cycle" _label={t('journalStats.loading')} />}
			{stats !== null && gefuellt.length === 0 && <p>{t('journalStats.empty')}</p>}
			{gefuellt.length > 0 && (
				<ul className="journal-stats__list">
					{gefuellt.map((fenster) => {
						const stand = stats?.balanceVerlauf.find((eintrag) => eintrag.tag === fenster.bis);
						return (
							<li key={fenster.von} className="journal-stats__item">
								<p className="journal-stats__label">
									{fenster.von !== fenster.bis
										? t('journalStats.weekOf', { date: formatDate(fenster.von) })
										: formatDate(fenster.von)}
								</p>
								<p className="journal-stats__zeile">{t('journalStats.total', { value: fenster.gesamt })}</p>
								<p className="journal-stats__zeile">{t('journalStats.withoutPillar', { value: fenster.ohneSaeule })}</p>
								<ul className="journal-stats__saeulen">
									{fenster.proSaeule
										.filter((eintrag) => eintrag.anzahl > 0)
										.map((eintrag) => (
											<li key={eintrag.pillarId}>
												{t('journalStats.pillarLine', {
													name: pillarName(eintrag.pillarId),
													count: eintrag.anzahl,
													points: stand?.saeulen.find((saeule) => saeule.id === eintrag.pillarId)?.punkte ?? 0,
												})}
											</li>
										))}
								</ul>
								<p className="journal-stats__zeile">
									{t('journalStats.fillLevel', { percent: stand?.fuellstandProzent ?? 0 })}
								</p>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
};
