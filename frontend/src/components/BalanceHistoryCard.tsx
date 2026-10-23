import { KolCard, KolSpin } from '@public-ui/react-v19';
import type { BalanceHistoryEntry } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { balanceTrend, type BalanceTrend } from '../lib/balanceTrend';

/**
 * Dashboard-Card „Balance-Verlauf" (#2082): der tägliche Füllstand der letzten 28 Tage
 * (`GET /scores/balance/history`) als Linie, darüber die Aussage als Text — Trend, Start- und
 * Endwert. Die Zahl ist die Hauptaussage, die Grafik der Beleg.
 *
 * Die Card lädt selbst (Muster `StreakCard`, keine Prop-Kette) und ist rein lesend. Ein Fehler
 * bleibt ein dezenter Hinweis in der Card, kein Dashboard-Bruch. Bewusst ohne `--pp-signal`
 * (gehört der „Nächsten Aufgabe") und ohne Alarmfarbe beim Abwärts-Trend (Fürsorge-Tonalität).
 *
 * SVG statt Chart-Bibliothek: für Zeitreihen gibt es keine KoliBri-Komponente (`KolMeter` ist für
 * Anteile) — begründete Ausnahme wie bei `WeeklyBalanceCard`.
 */

const TAGE = 28;
const BREITE = 280;
const HOEHE = 80;
const RAND = 4;
const TREND_PFEIL: Record<BalanceTrend, string> = { aufwaerts: '↑', abwaerts: '↓', stabil: '→' };

const isoDatum = (d: Date): string =>
	`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** `YYYY-MM-DD` als lokaler Kalendertag (ohne UTC-Verschiebung). */
const kalendertag = (tag: string): Date => {
	const [jahr, monat, tagImMonat] = tag.split('-').map(Number);
	return new Date(jahr, monat - 1, tagImMonat);
};

export const BalanceHistoryCard = () => {
	const { t, i18n } = useTranslation('common');
	const [verlauf, setVerlauf] = useState<BalanceHistoryEntry[] | null>(null);
	const [fehler, setFehler] = useState(false);

	useEffect(() => {
		let cancelled = false;
		const bis = new Date();
		const von = new Date(bis);
		von.setDate(von.getDate() - (TAGE - 1));
		api
			// Die Kalendertagsgrenze richtet sich nach der Zeitzone des Nutzers (Muster StreakCard).
			.getBalanceHistory({
				von: isoDatum(von),
				bis: isoDatum(bis),
				tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
			})
			.then((eintraege) => {
				if (!cancelled) {
					setVerlauf(eintraege);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setFehler(true);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const leer = verlauf !== null && !verlauf.some((eintrag) => eintrag.hatPunkte);

	const render = () => {
		if (fehler) {
			return (
				<p className="dashboard-balance-history-hint" data-testid="balance-history-error">
					{t('balanceHistory.fehler')}
				</p>
			);
		}
		if (verlauf === null) {
			return <KolSpin _label={t('balanceHistory.laden')} />;
		}
		if (leer) {
			return (
				<p className="dashboard-balance-history-hint" data-testid="balance-history-empty">
					{t('balanceHistory.leer')}
				</p>
			);
		}
		const trend = balanceTrend(verlauf);
		const start = Math.round(verlauf[0].fuellstandProzent);
		const ende = Math.round(verlauf[verlauf.length - 1].fuellstandProzent);
		const datum = (tag: string): string =>
			kalendertag(tag).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
		const vonTag = datum(verlauf[0].tag);
		const bisTag = datum(verlauf[verlauf.length - 1].tag);
		const x = (i: number): number =>
			verlauf.length > 1 ? RAND + (i * (BREITE - 2 * RAND)) / (verlauf.length - 1) : BREITE / 2;
		const y = (prozent: number): number =>
			RAND + ((100 - Math.min(100, Math.max(0, prozent))) * (HOEHE - 2 * RAND)) / 100;
		const punkte = verlauf.map((eintrag, i) => ({ cx: x(i), cy: y(eintrag.fuellstandProzent), tag: eintrag.tag }));
		return (
			<div className="dashboard-balance-history-content">
				<p className="dashboard-balance-history-trend" data-testid="balance-history-trend">
					<span aria-hidden="true">{TREND_PFEIL[trend]}</span> {t(`balanceHistory.trend.${trend}`)}
				</p>
				<p className="dashboard-balance-history-werte">
					<span data-testid="balance-history-start">{t('balanceHistory.start', { wert: start })}</span>
					<span data-testid="balance-history-end">{t('balanceHistory.ende', { wert: ende })}</span>
				</p>
				<svg
					className="dashboard-balance-history-chart"
					viewBox={`0 0 ${BREITE} ${HOEHE}`}
					role="img"
					aria-label={t('balanceHistory.chartLabel', {
						trend: t(`balanceHistory.trend.${trend}`),
						start,
						ende,
						von: vonTag,
						bis: bisTag,
					})}
					data-testid="balance-history-chart"
				>
					<polyline
						className="dashboard-balance-history-linie"
						fill="none"
						points={punkte.map((p) => `${p.cx},${p.cy}`).join(' ')}
					/>
					{punkte.map((p) => (
						<circle
							key={p.tag}
							className="dashboard-balance-history-punkt"
							cx={p.cx}
							cy={p.cy}
							r={1.5}
							data-testid="balance-history-point"
						/>
					))}
				</svg>
				<p className="dashboard-balance-history-achse" aria-hidden="true">
					<span>{vonTag}</span>
					<span>{bisTag}</span>
				</p>
			</div>
		);
	};

	return (
		<KolCard
			className="dashboard-balance-history"
			role="region"
			aria-label={t('balanceHistory.label')}
			_label={t('balanceHistory.label')}
			_level={3}
			data-testid="balance-history-card"
		>
			{render()}
		</KolCard>
	);
};
