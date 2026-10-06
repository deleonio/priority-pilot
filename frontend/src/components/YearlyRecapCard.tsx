import { KolAlert, KolButton, KolCard, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { YearlyRecap } from 'client';
import { api } from '../api';
import { rasterisiere } from '../lib/karteRasterisieren';
import { erzeugeJahresKarteSvg, jahresDateiname } from '../lib/yearlyShareCard';

/**
 * Dashboard-Card „Mein Jahr in Zahlen“ (#1997, Balamentum Wrapped): der Rückblick auf das Vorjahr
 * als teilbares Standbild — erledigte Aufgaben, Stunden, längster Streak, stärkste Säule und
 * abgeschlossene Projekte, bewusst ohne Aufgabentitel oder -inhalte (AK6). Struktur und Bedienung
 * folgen der Monatskarte (`MonthlyBalanceCard`, #1995).
 *
 * Die Card lädt selbst und erscheint selbstständig nur im Januar (AK5) — sonst rendert sie nichts
 * und lädt nichts. Die Werte stehen zusätzlich als Text im Card-DOM: SR-lesbar und auch ohne Bild
 * zugänglich. Teilen (Web Share mit der gerasterten PNG) und Download sind bewusst sekundäre
 * Buttons: die eine Primary der Sicht bleibt der „Nächsten Aufgabe“ vorbehalten (ux-design §4).
 */

export const YearlyRecapCard = () => {
	const { t, i18n } = useTranslation('common');
	// Januar-Fenster (AK5) als Mount-Zustand — das Dashboard remountet ohnehin regelmäßig.
	const [imFenster] = useState(() => new Date().getMonth() === 0);
	const [vorjahr] = useState(() => new Date().getFullYear() - 1);
	const [daten, setDaten] = useState<YearlyRecap | null>(null);
	const [rastert, setRastert] = useState(false);
	const [fehler, setFehler] = useState(false);

	useEffect(() => {
		if (!imFenster) {
			return;
		}
		let cancelled = false;
		const lade = async (): Promise<void> => {
			try {
				// Die Jahresgrenzen richten sich nach der Zeitzone des Nutzers (Muster Monatskarte).
				const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
				const recap = await api.getYearlyRecap({ jahr: vorjahr, tz });
				if (!cancelled) {
					setDaten(recap);
				}
			} catch {
				// Netzwerk-/Serverfehler bleiben im Ladezustand statt einen Fehlerzustand zu malen —
				// ein nicht erreichbarer Rückblick ist keine schlechte Nachricht (Muster Monatskarte).
				if (!cancelled) {
					setDaten(null);
				}
			}
		};
		void lade();
		return () => {
			cancelled = true;
		};
	}, [imFenster, vorjahr]);

	if (!imFenster) {
		return null;
	}

	const zahl = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
	const label = `${t('yearlyCard.rueckblick')} ${vorjahr}`;

	/** Erst im Klickpfad erzeugt — bloßes Ansehen der Karte rasterisiert nichts. */
	const erzeugeKarte = async (): Promise<{ blob: Blob; dateiname: string } | null> => {
		setRastert(true);
		setFehler(false);
		try {
			const blob = await rasterisiere(
				erzeugeJahresKarteSvg({
					jahr: vorjahr,
					label,
					erledigteAufgaben: daten?.erledigteAufgaben ?? 0,
					stunden: daten?.stunden ?? 0,
					laengsterStreak: daten?.laengsterStreak ?? 0,
					staerksteSaeule: daten?.staerksteSaeule ?? null,
					abgeschlosseneProjekte: daten?.abgeschlosseneProjekte ?? 0,
					sprache: i18n.language,
					beschriftungen: {
						aufgaben: t('yearlyCard.aufgaben'),
						stunden: t('yearlyCard.stunden'),
						streak: t('yearlyCard.streak'),
						projekte: t('yearlyCard.projekte'),
						saeule: t('yearlyCard.saeule'),
					},
				}),
			);
			return { blob, dateiname: jahresDateiname(vorjahr) };
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
		// Download-Pfad (kein toter Button).
		if (navigator.canShare?.({ files: [datei] })) {
			try {
				await navigator.share({ files: [datei], title: t('yearlyCard.label'), text: label });
				return;
			} catch (fehlerBeimTeilen) {
				// Abbruch des Systemdialogs ist keine Störung (UX-Beratung) — sonst Download.
				if ((fehlerBeimTeilen as DOMException)?.name === 'AbortError') {
					return;
				}
			}
		}
		ladeHerunter(karte);
	};

	return (
		<KolCard
			className="dashboard-yearly"
			role="region"
			aria-label={t('yearlyCard.label')}
			_label={t('yearlyCard.label')}
			_level={3}
			data-testid="yearly-recap-card"
		>
			<div className="dashboard-yearly-content">
				<p className="dashboard-yearly-jahr">{label}</p>
				{daten === null ? (
					<p className="dashboard-yearly-hint">{t('yearlyCard.laden')}</p>
				) : daten.erledigteAufgaben === 0 ? (
					<p className="dashboard-yearly-hint">{t('yearlyCard.leer')}</p>
				) : (
					<dl className="dashboard-yearly-liste">
						<div className="dashboard-yearly-zeile">
							<dt>{t('yearlyCard.aufgaben')}</dt> <dd>{zahl.format(daten.erledigteAufgaben)}</dd>{' '}
						</div>
						<div className="dashboard-yearly-zeile">
							<dt>{t('yearlyCard.stunden')}</dt> <dd>{zahl.format(daten.stunden)}</dd>{' '}
						</div>
						<div className="dashboard-yearly-zeile">
							<dt>{t('yearlyCard.streak')}</dt> <dd>{zahl.format(daten.laengsterStreak)}</dd>{' '}
						</div>
						<div className="dashboard-yearly-zeile">
							<dt>{t('yearlyCard.projekte')}</dt> <dd>{zahl.format(daten.abgeschlosseneProjekte)}</dd>{' '}
						</div>
						{daten.staerksteSaeule && (
							<div className="dashboard-yearly-zeile">
								<dt>{t('yearlyCard.saeule')}</dt> <dd>{daten.staerksteSaeule.name}</dd>{' '}
							</div>
						)}
					</dl>
				)}
				{rastert && <KolSpin _label={t('yearlyCard.erzeuge')} />}
				{fehler && <KolAlert _type="error">{t('yearlyCard.fehler')}</KolAlert>}
				<div className="dashboard-yearly-aktionen">
					<KolButton
						data-testid="yearly-share"
						_label={t('yearlyCard.teilen')}
						_on={{ onClick: () => void teilen() }}
					/>
					<KolButton
						data-testid="yearly-download"
						_label={t('yearlyCard.speichern')}
						_on={{ onClick: () => void speichern() }}
					/>
				</div>
			</div>
		</KolCard>
	);
};
