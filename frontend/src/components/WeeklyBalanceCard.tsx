import { KolAlert, KolButton, KolCard, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import {
	KARTE_BREITE,
	KARTE_HOEHE,
	erzeugeWochenKarteSvg,
	kalenderWoche,
	kartenDateiname,
	montagDerWoche,
} from '../lib/weeklyShareCard';

/**
 * Dashboard-Card „Meine Woche in fünf Säulen" (#1968): die Wochenbalance als teilbares Standbild —
 * Säulenwerte und Streak, bewusst ohne Aufgabentitel oder -inhalte (AK1).
 *
 * Die Card lädt selbst (Muster `StreakCard`, keine Prop-Kette) und erscheint selbstständig erst
 * am Sonntag der laufenden Kalenderwoche (Montag–Sonntag, Nutzerzeitzone, AK4) — vorher rendert
 * sie nichts. Die Werte stehen zusätzlich als Text im Card-DOM: die AK1-Zahlen sind damit auch
 * ohne Bild zugänglich und SR-lesbar (UX-Beratung #1968).
 *
 * Teilen (Web Share mit der gerasterten PNG) ist die Hauptaktion, Download der Fallback — beides
 * bewusst sekundäre Buttons: die eine Primary der Sicht bleibt der „Nächsten Aufgabe" vorbehalten
 * (ux-design §4). Abbruch des Systemdialogs (`AbortError`) ist kein Fehlerzustand.
 */

/** Rasterungs-Skalierung: 2× aus dem SVG, damit das PNG auf Retina nicht matscht (UX-Beratung). */
const RASTER_SKALA = 2;

interface WochenDaten {
	saeulen: { id: number; name: string; wert: number }[];
	streak: number;
}

/** SVG→PNG ohne neue npm-Abhängigkeit: data-URL ins `Image`, auf 2×-Canvas gemalt, als Blob. */
const rasterisiere = (svg: string): Promise<Blob> =>
	new Promise((resolve, reject) => {
		const bild = new Image();
		bild.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = KARTE_BREITE * RASTER_SKALA;
			canvas.height = KARTE_HOEHE * RASTER_SKALA;
			const kontext = canvas.getContext('2d');
			// Optional call: ohne zeichenfähigen 2D-Kontext (jsdom, blockiertes Canvas) bleibt das
			// Bild leer, statt die Erzeugung crashen zu lassen.
			kontext?.drawImage?.(bild, 0, 0, canvas.width, canvas.height);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Rasterisierung lieferte kein PNG'))),
				'image/png',
			);
		};
		bild.onerror = () => reject(new Error('SVG ließ sich nicht laden'));
		bild.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});

export const WeeklyBalanceCard = () => {
	const { t } = useTranslation('common');
	// Sonntag-Gate (AK4) als Mount-Zustand — das Dashboard remountet ohnehin regelmäßig.
	const [istSonntag] = useState(() => new Date().getDay() === 0);
	const [daten, setDaten] = useState<WochenDaten | null>(null);
	const [rastert, setRastert] = useState(false);
	const [fehler, setFehler] = useState(false);

	useEffect(() => {
		if (!istSonntag) {
			return;
		}
		let cancelled = false;
		const lade = async (): Promise<void> => {
			try {
				const montag = montagDerWoche(new Date());
				const sonntag = new Date(montag);
				sonntag.setDate(sonntag.getDate() + 6);
				const isoDatum = (d: Date): string =>
					`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
				// Die Kalendertagsgrenze richtet sich nach der Zeitzone des Nutzers (Muster StreakCard).
				const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
				// Der Verlauf ist kumulativ: Wochenwerte = Stand am Wochenendeintrag minus Stand am
				// Vorabend des Montags — deshalb beginnt das Fenster schon am Sonntag davor.
				const vorDemMontag = new Date(montag);
				vorDemMontag.setDate(vorDemMontag.getDate() - 1);
				const [verlauf, streak] = await Promise.all([
					api.getBalanceHistory({ von: isoDatum(vorDemMontag), bis: isoDatum(sonntag), tz }),
					api.getStreak({ tz }),
				]);
				if (cancelled) {
					return;
				}
				// Absicherung gegen Nicht-Array-Antworten (Vertrag der Spec-Tests): dann bleibt die
				// Karte leer, statt beim Auswerten zu crashen.
				const tage = Array.isArray(verlauf) ? verlauf : [];
				const standVorDerWoche = new Map((tage[0]?.saeulen ?? []).map((s) => [s.id, s.punkte]));
				const saeulen = (tage.at(-1)?.saeulen ?? []).map((s) => ({
					id: s.id,
					name: s.name,
					wert: Math.max(0, Math.round(s.punkte - (standVorDerWoche.get(s.id) ?? 0))),
				}));
				setDaten({ saeulen, streak: streak.aktuell });
			} catch {
				// Netzwerk-/Serverfehler bleiben im Ladezustand statt einen Fehlerzustand zu malen —
				// eine nicht erreichbare Wochenbalance ist keine schlechte Nachricht (Muster StreakCard).
				if (!cancelled) {
					setDaten(null);
				}
			}
		};
		void lade();
		return () => {
			cancelled = true;
		};
	}, [istSonntag]);

	if (!istSonntag) {
		return null;
	}

	const heute = new Date();
	const { kw, jahr } = kalenderWoche(heute);
	const wocheLabel = t('weeklyCard.woche', { kw, jahr });

	/** Erst im Klickpfad erzeugt — bloßes Ansehen der Karte rasterisiert nichts. */
	const erzeugeKarte = async (): Promise<{ blob: Blob; dateiname: string } | null> => {
		setRastert(true);
		setFehler(false);
		try {
			const blob = await rasterisiere(
				erzeugeWochenKarteSvg({
					saeulen: daten?.saeulen ?? [],
					streak: daten?.streak ?? 0,
					woche: wocheLabel,
				}),
			);
			return { blob, dateiname: kartenDateiname(heute) };
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
		// Download-Pfad (AK2, kein toter Button).
		if (navigator.canShare?.({ files: [datei] })) {
			try {
				await navigator.share({ files: [datei], title: t('weeklyCard.label'), text: wocheLabel });
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
			className="dashboard-weekly"
			role="region"
			aria-label={t('weeklyCard.label')}
			_label={t('weeklyCard.label')}
			_level={3}
			data-testid="weekly-balance-card"
		>
			<div className="dashboard-weekly-content">
				<p className="dashboard-weekly-woche">{wocheLabel}</p>
				{daten === null ? (
					<p className="dashboard-weekly-hint">{t('weeklyCard.laden')}</p>
				) : daten.saeulen.length === 0 ? (
					<p className="dashboard-weekly-hint">{t('weeklyCard.leer')}</p>
				) : (
					<>
						<p className="dashboard-weekly-streak">
							<span className="dashboard-weekly-streak-wert">{daten.streak}</span>
							<span className="dashboard-weekly-streak-label">Streak</span>
						</p>
						<ul className="dashboard-weekly-liste">
							{daten.saeulen.map((saeule) => (
								<li key={saeule.id} className="dashboard-weekly-zeile">
									<span>{saeule.name}</span>
									<span className="dashboard-weekly-punkte">{saeule.wert}</span>
								</li>
							))}
						</ul>
					</>
				)}
				{rastert && <KolSpin _label={t('weeklyCard.erzeuge')} />}
				{fehler && <KolAlert _type="error">{t('weeklyCard.fehler')}</KolAlert>}
				<div className="dashboard-weekly-aktionen">
					<KolButton
						data-testid="weekly-share"
						_label={t('weeklyCard.teilen')}
						_on={{ onClick: () => void teilen() }}
					/>
					<KolButton
						data-testid="weekly-download"
						_label={t('weeklyCard.speichern')}
						_on={{ onClick: () => void speichern() }}
					/>
				</div>
			</div>
		</KolCard>
	);
};
