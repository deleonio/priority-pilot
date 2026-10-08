import { KolAlert, KolButton, KolCard, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import i18next from '../i18n/config';
import { rasterisiere } from '../lib/karteRasterisieren';
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
	const [rastert, setRastert] = useState(false);
	const [fehler, setFehler] = useState(false);

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

	if (!imFenster) {
		return null;
	}

	const monat = daten?.monat ?? vormonat(new Date());
	const [jahr, monatNr] = monat.split('-').map(Number) as [number, number];
	const monatsname = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric' }).format(
		new Date(jahr, monatNr - 1, 15),
	);
	const monatsLabel = `${t('monthlyCard.rueckblick')} ${monatsname}`;

	/** Erst im Klickpfad erzeugt — bloßes Ansehen der Karte rasterisiert nichts. */
	const erzeugeKarte = async (): Promise<{ blob: Blob; dateiname: string } | null> => {
		setRastert(true);
		setFehler(false);
		try {
			const blob = await rasterisiere(
				erzeugeMonatsKarteSvg({
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
			);
			return { blob, dateiname: monatsDateiname(monat) };
		} catch {
			setFehler(true);
			return null;
		} finally {
			setRastert(false);
		}
	};

	const ladeHerunter = (karte: { blob: Blob; dateiname: string }): void => {
		const url = URL.createObjectURL(karte.blob);
		const anker = document.createElement('a');
		anker.href = url;
		anker.download = karte.dateiname;
		document.body.append(anker);
		anker.click();
		anker.remove();
		URL.revokeObjectURL(url);
	};

	const speichern = async (): Promise<void> => {
		const karte = await erzeugeKarte();
		if (karte) {
			ladeHerunter(karte);
		}
	};

	const teilen = async (): Promise<void> => {
		const karte = await erzeugeKarte();
		if (!karte) {
			return;
		}
		const datei = new File([karte.blob], karte.dateiname, { type: 'image/png' });
		// File-Share nur, wenn die Plattform Dateien annimmt — sonst fällt der Klick in den
		// Download-Pfad (AK4, kein toter Button).
		if (navigator.canShare?.({ files: [datei] })) {
			try {
				await navigator.share({ files: [datei], title: t('monthlyCard.label'), text: monatsLabel });
				return;
			} catch (fehlerBeimTeilen) {
				// Abbruch des Systemdialogs ist keine Störung (UX-Beratung) — sonst Meldung.
				if ((fehlerBeimTeilen as DOMException)?.name === 'AbortError') {
					return;
				}
			}
		}
		ladeHerunter(karte);
	};

	return (
		<KolCard
			className="dashboard-monthly"
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
									<li key={meilenstein.schluessel}>{meilenstein.schluessel}</li>
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
