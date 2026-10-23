import { KolAlert, KolButton, KolCard, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import i18next from '../i18n/config';
import { useShareCard } from '../lib/useShareCard';
import { erzeugeMonatsKarteSvg, monatsDateiname, vormonat } from '../lib/monthlyShareCard';

/**
 * Dashboard-Card „Mein Monat in fünf Säulen" (#1995): der Rückblick auf den Vormonat als
 * teilbares Standbild — Säulenwerte, Streak zum Monatsende und die im Monat erreichten
 * Meilensteine, bewusst ohne Aufgabentitel oder -inhalte (AK2). Struktur und Bedienung folgen
 * exakt der Wochen-Balance-Karte (`WeeklyBalanceCard`, #1968).
 *
 * Die Card lädt selbst (Muster `WeeklyBalanceCard`, keine Prop-Kette) und erscheint selbstständig
 * nur im Monatsanfangs-Fenster, Tag 1–7 (AK4, UX-Beratung) — vorher rendert sie nichts. Die Werte
 * stehen zusätzlich als Text im Card-DOM: SR-lesbar und auch ohne Bild zugänglich.
 *
 * Teilen (Web Share mit der gerasterten PNG) ist die Hauptaktion, Download der Fallback — beides
 * bewusst sekundäre Buttons: die eine Primary der Sicht bleibt der „Nächsten Aufgabe" vorbehalten
 * (ux-design §4). Abbruch des Systemdialogs (`AbortError`) ist kein Fehlerzustand.
 */

interface RecapDaten {
	monat: string;
	saeulen: { id: number; name: string; punkte: number }[];
	streak: number;
	meilensteine: { schluessel: string; zeitpunkt: string }[];
}

/** Meilenstein-Schlüssel als Karten-Text: `streak-7` → „Streak 7", `punkte-100` → „1000 Punkte". */
const meilensteinText = (schluessel: string): string => {
	const trenn = schluessel.indexOf('-');
	const art = schluessel.slice(0, trenn);
	const wert = schluessel.slice(trenn + 1);
	return i18next.t(art === 'streak' ? 'dashboard:milestone.streak' : 'dashboard:milestone.points', { value: wert });
};

export const MonthlyBalanceCard = () => {
	const { t, i18n } = useTranslation('common');
	// Monatsanfangs-Fenster (AK4) als Mount-Zustand — das Dashboard remountet ohnehin regelmäßig.
	const [imFenster] = useState(() => new Date().getDate() <= 7);
	const [daten, setDaten] = useState<RecapDaten | null>(null);

	useEffect(() => {
		if (!imFenster) {
			return;
		}
		let cancelled = false;
		const lade = async (): Promise<void> => {
			try {
				// Die Monatsgrenzen richtet sich nach der Zeitzone des Nutzers (Muster StreakCard).
				const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
				const recap = await api.getMonthlyRecap({ monat: vormonat(new Date()), tz });
				if (!cancelled) {
					setDaten(recap);
				}
			} catch {
				// Netzwerk-/Serverfehler bleiben im Ladezustand statt einen Fehlerzustand zu malen —
				// eine nicht erreichbare Bilanz ist keine schlechte Nachricht (Muster WeeklyBalanceCard).
				if (!cancelled) {
					setDaten(null);
				}
			}
		};
		void lade();
		return () => {
			cancelled = true;
		};
	}, [imFenster]);

	const monat = daten?.monat ?? vormonat(new Date());
	const [jahr, monatNr] = monat.split('-').map(Number) as [number, number];
	const monatsname = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
		new Date(jahr, monatNr - 1, 15),
	);
	const monatsLabel = `${t('monthlyCard.rueckblick')} ${monatsname}`;

	// Gemeinsame Karten-Logik (#2695): Erzeugen/Herunterladen/Teilen samt Fehler- und
	// Spinner-Zustand kommen aus dem Hook — die Karte liefert nur SVG, Dateiname, Titel/Text.
	const { rastert, fehler, speichern, teilen } = useShareCard({
		erzeugeSvg: () => ({
			svg: erzeugeMonatsKarteSvg({
				saeulen: (daten?.saeulen ?? []).map((s) => ({ name: s.name, wert: Math.max(0, Math.round(s.punkte)) })),
				streak: daten?.streak ?? 0,
				meilensteine: (daten?.meilensteine ?? []).map((m) => meilensteinText(m.schluessel)),
				monat: monatsLabel,
				marken: {
					balamentum: t('monthlyCard.marken.balamentum'),
					play: t('monthlyCard.marken.play'),
					pwa: t('monthlyCard.marken.pwa'),
				},
			}),
			dateiname: monatsDateiname(monat),
		}),
		titel: t('monthlyCard.label'),
		text: monatsLabel,
	});

	if (!imFenster) {
		return null;
	}

	return (
		<KolCard
			className="dashboard-monthly"
			id="karte-monatsrueckblick"
			tabIndex={-1}
			role="region"
			aria-label={t('monthlyCard.label')}
			_label={t('monthlyCard.label')}
			_level={3}
			data-testid="monthly-balance-card"
		>
			<div className="dashboard-monthly-content">
				<p className="dashboard-monthly-monat">{monatsLabel}</p>
				{daten === null ? (
					<p className="dashboard-monthly-hint">{t('monthlyCard.laden')}</p>
				) : daten.saeulen.length === 0 ? (
					<p className="dashboard-monthly-hint">{t('monthlyCard.leer')}</p>
				) : (
					<>
						<p className="dashboard-monthly-streak">
							<span className="dashboard-monthly-streak-wert">{daten.streak}</span>
							<span className="dashboard-monthly-streak-label">Streak</span>
						</p>
						<ul className="dashboard-monthly-liste">
							{daten.saeulen.map((saeule) => (
								<li key={saeule.id} className="dashboard-monthly-zeile">
									<span>{saeule.name}</span>
									<span className="dashboard-monthly-punkte">{Math.round(saeule.punkte)}</span>
								</li>
							))}
						</ul>
						{daten.meilensteine.length > 0 && (
							<ul className="dashboard-monthly-meilensteine">
								{daten.meilensteine.map((meilenstein) => (
									<li key={meilenstein.schluessel}>{meilensteinText(meilenstein.schluessel)}</li>
								))}
							</ul>
						)}
					</>
				)}
				{rastert && <KolSpin _label={t('monthlyCard.erzeuge')} />}
				{fehler && <KolAlert _type="error">{t('monthlyCard.fehler')}</KolAlert>}
				<div className="dashboard-monthly-aktionen">
					<KolButton
						data-testid="monthly-share"
						_label={t('monthlyCard.teilen')}
						_on={{ onClick: () => void teilen() }}
					/>
					<KolButton
						data-testid="monthly-download"
						_label={t('monthlyCard.speichern')}
						_on={{ onClick: () => void speichern() }}
					/>
				</div>
			</div>
		</KolCard>
	);
};
