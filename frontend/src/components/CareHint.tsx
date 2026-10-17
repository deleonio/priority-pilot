import { KolAlert, KolButton, KolInputRadio } from '@public-ui/react-v19';
import type { CareVorschlag, Pillar, TaskCreate } from 'client';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { fillContributions } from '../lib/pillar';
import { TASKS_CHANGED_EVENT } from '../lib/tasksChanged';

const TAG_MS = 24 * 60 * 60 * 1000;
/** Spiegel von `CARE_ABLEHNUNG_TAGE` (`server/src/logics/careSuggestions.ts`) — der Server kennt nur Vorlagen-Ablehnungen. */
const ABLEHNUNG_MS = 14 * TAG_MS;
/** „Nicht jetzt“-Nachrücken (#1977): Cursor in die geladene Vorschlagsliste, gilt bis Tagesende —
 *  ein Reload am selben Tag zeigt den nächsten statt dem übersprungenen Vorschlag (Test-Pflege #1793-AK4). */
const NACHRUECK_KEY = 'pp-care-hint-nachrueck';
const TASK_ABLEHNUNG_KEY = 'pp-care-hint-rejected-tasks';
/** #1873: KI-Vorschlag hat keinen `templateKey` — Ablehnung lokal bis Tagesende (der Server liefert ihn den Tag über gleich). */
const KI_ABLEHNUNG_KEY = 'pp-care-hint-ki-rejected-until';

/** Die fünf Gründe der Grundauswahl (#1977) — sprachunabhängige Werte wie `templateKey`, Labels aus i18n. */
const GRUENDE = [
	'zu-gross',
	'gerade-nicht-moeglich',
	'keine-energie',
	'warte-auf-jemanden',
	'falsche-prioritaet',
] as const;
type Grund = (typeof GRUENDE)[number];

const readNumber = (key: string): number => Number(window.localStorage.getItem(key) ?? 0);

const readJsonMap = (key: string): Record<string, number> => {
	try {
		return JSON.parse(window.localStorage.getItem(key) ?? '{}') as Record<string, number>;
	} catch {
		return {};
	}
};

const readRejectedTasks = (): Record<string, number> => readJsonMap(TASK_ABLEHNUNG_KEY);

/** Persistierter Nachrück-Cursor (#1977) — nur am Tag des Eintrags gültig, danach wieder von vorn. */
const liesNachrueck = (): number => {
	try {
		const gespeichert = JSON.parse(window.localStorage.getItem(NACHRUECK_KEY) ?? 'null') as {
			index: number;
			tag: string;
		} | null;
		return gespeichert !== null && gespeichert.tag === new Date().toDateString() && Number.isInteger(gespeichert.index)
			? gespeichert.index
			: 0;
	} catch {
		return 0;
	}
};

/** Lokal unterdrückt: abgelehnter KI-Vorschlag bis Tagesende, abgelehnte eigene Aufgabe für 14 Tage. */
const istUnterdrueckt = (vorschlag: CareVorschlag, jetzt: number): boolean =>
	(vorschlag.typ === 'ki' && readNumber(KI_ABLEHNUNG_KEY) > jetzt) ||
	(vorschlag.taskId !== undefined && (readRejectedTasks()[vorschlag.taskId] ?? 0) > jetzt);

const endeDesTages = (jetzt: Date): number =>
	new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1).getTime();

/**
 * Fürsorge-Hinweis auf dem Dashboard (#1793, Ton: `docs/fuersorge-tonalitaet.md`): zeigt den ersten
 * nicht lokal unterdrückten Vorschlag aus `GET /scores/care-suggestions` mit Übernehmen / Nicht
 * jetzt / Ablehnen. Bei `anlass: 'ueberlast'` (#1795) rahmt der Hinweis den Vorschlag als Ausgleich
 * statt als Defizit; bei `anlass: 'ermutigung'` (#2521) und `anlass: 'einstieg'` (#2527) zeigt er
 * nur den Fürsorge-Satz — ohne
 * Aktionsreihe (nichts anzunehmen oder abzulehnen, kein Nachrücken, kein Dismissal). Ein
 * KI-Vorschlag (`typ: 'ki'`, #1873) trägt die Kennzeichnung „KI-Vorschlag“.
 * Lädt selbst (Muster `DayDoneHint`); bis zur ersten Antwort trägt ein dekorativer Platzhalter die
 * endgültige Kartenhöhe (#2625 — kein Layout-Sprung), bei Ladefehler wird nichts gerendert. Auf
 * `TASKS_CHANGED_EVENT` (#2522) lädt er wie beim Mount neu — bis zur Antwort bleibt der alte
 * Hinweis stehen (der Platzhalter betrifft nur den ersten Ladevorgang).
 *
 * „Nicht jetzt“ (#1977) öffnet eine Inline-Grundauswahl (fünf Gründe, ersetzt die Aktionsreihe):
 * mit Grund geht ein `POST …/rejections` je Aufgabe/Vorlage, ohne Grund wird nur übersprungen —
 * beides rückt über einen bis Tagesende gültigen Cursor zum nächsten Vorschlag vor; bleibt keiner,
 * erscheint der Leerzustand. KI-Vorschläge behalten das lokale Sofort-Snooze ohne Grundprompt.
 * Aktionen wirken optimistisch — schlägt der Server fehl, kommt der Vorschlag mit Fehlermeldung
 * zurück. Die Statusregion ist ein `div`, weil `KolAlert` ohne `_alert` keine Live-Region setzt
 * und der Hinweis nichts vorlesen soll.
 */
interface CareHintProps {
	/**
	 * #2645: Meldet, ob der Hinweis gerade den Einstiegssatz zeigt — das Dashboard unterdrückt
	 * dann die inhaltsgleiche Begründungszeile der nächsten Aufgabe (der Satz steht genau einmal).
	 */
	onEinstiegssatzGezeigt?: (gezeigt: boolean) => void;
}

export const CareHint = ({ onEinstiegssatzGezeigt }: CareHintProps) => {
	const { t } = useTranslation('common');
	const [vorschlaege, setVorschlaege] = useState<CareVorschlag[] | undefined>(undefined);
	// Konto-Säulen für die Vollverteilungs-Normierung des Übernahme-Payloads (#2077-Fixup #2132).
	const [saeulen, setSaeulen] = useState<Pillar[]>([]);
	const [ausgeblendet, setAusgeblendet] = useState(false);
	const [fehler, setFehler] = useState(false);
	// Nachrück-Cursor-Spiegel (#1977): localStorage + State, damit das Nachrücken ohne Reload rendert.
	const [nachrueck, setNachrueck] = useState<number>(() => liesNachrueck());
	// Grundauswahl: ersetzt die Aktionsreihe, bis gespeichert/übersprungen/abgebrochen wird.
	const [grundOffen, setGrundOffen] = useState(false);
	const [grund, setGrund] = useState<Grund | undefined>(undefined);
	// Leerzustand erst zeigen, wenn eine „Nicht jetzt“-Aktion die Liste leert — ein frischer Mount
	// mit nur unterdrückten Vorschlägen bleibt unsichtbar (bestehender #1793-Vertrag).
	const [leerzustand, setLeerzustand] = useState(false);
	// #2522: Refresh-Key auf TASKS_CHANGED_EVENT (Muster NearbyCard) — Erledigen auf dem Dashboard
	// lässt den Hinweis wie beim Mount neu laden.
	const [refreshKey, setRefreshKey] = useState(0);
	// #2625: Kennmarke für den ERSTEN Ladevorgang — nur solange trägt der Platzhalter die reservierte
	// Höhe; der #2522-Refresh lässt den alten Hinweis stehen (kein Platzhalter-Flash).
	const [initialGeladen, setInitialGeladen] = useState(false);

	useEffect(() => {
		const onTasksChanged = () => setRefreshKey((key) => key + 1);
		window.addEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		return () => {
			window.removeEventListener(TASKS_CHANGED_EVENT, onTasksChanged);
		};
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		api
			.getCareSuggestions({ signal: controller.signal })
			.then((result) => setVorschlaege(result.vorschlaege))
			.catch(() => undefined)
			.finally(() => {
				// Abbruch (Refresh/Unmount/StrictMode-Doppelmount) setzt die Kennmarke nicht — sonst
				// würde der Platzhalter verschwinden, während der Nachfolge-Fetch noch läuft.
				if (!controller.signal.aborted) {
					setInitialGeladen(true);
				}
			});
		api
			.listPillars({ signal: controller.signal })
			.then((result) => setSaeulen(result))
			.catch(() => undefined);
		return () => controller.abort();
	}, [refreshKey]);

	/*
	 * Nachrücken (#1977): ab Cursor; liegt er hinter dem Listenende, gilt die ganze Liste — so bleibt
	 * bei nur noch einem Vorschlag die Karte bedienbar statt verschwunden. Bewusst vor den frühen
	 * Returns berechnet, damit der gezeigte Anlass unten per Effect gemeldet werden kann (Rules of
	 * Hooks).
	 */
	const abCursor = vorschlaege?.slice(nachrueck) ?? [];
	const vorschlag = (abCursor.length > 0 ? abCursor : (vorschlaege ?? [])).find(
		(kandidat) => !istUnterdrueckt(kandidat, Date.now()),
	);
	// #2645: Der Einstiegssatz steht auf dem Dashboard genau einmal — zeigt der Hinweis ihn, meldet
	// er das hier (das Dashboard unterdrückt dann die inhaltsgleiche Begründungszeile). Ermutigung
	// scheidet aus: deren Satz ist ein anderer.
	const zeigtEinstiegssatz = !ausgeblendet && !leerzustand && vorschlag?.anlass === 'einstieg';
	// Layout-Effekt (#2645): die Meldung muss IM SELBEN Commit ankommen, in dem der Satz erscheint —
	// sonst zeigt das Dashboard für einen Commit Satz + duplizierte Begründungszeile zusammen.
	useLayoutEffect(() => {
		onEinstiegssatzGezeigt?.(zeigtEinstiegssatz);
	}, [onEinstiegssatzGezeigt, zeigtEinstiegssatz]);

	// #2625: Bis zur ersten Antwort reserviert der Platzhalter die Höhe der späteren Karte
	// (Übergang Laden → Geladen hoehenneutral, AK1); Ladefehler, Ausblenden und nur Unterdrücktes
	// bleiben unsichtbar (#1793-Vertrag).
	if (!initialGeladen) {
		return <div className="care-hint care-hint-platzhalter" data-testid="care-hint" aria-hidden="true" />;
	}

	if (vorschlaege === undefined || ausgeblendet) {
		return null;
	}

	if (vorschlaege.length === 0 || leerzustand) {
		return (
			<div className="care-hint" data-testid="care-hint" role="status" aria-label={t('care.label')}>
				<KolAlert _type="info" _variant="card" _label={t('care.label')}>
					<p>{t('care.empty')}</p>
				</KolAlert>
			</div>
		);
	}

	if (vorschlag === undefined) {
		// Frischer Mount mit nur unterdrückten Vorschlägen: unsichtbar bleiben (#1793-Vertrag).
		return null;
	}

	// #2521/#2527: Ermutigungs- und Einstiegs-Eintrag sind reine Fürsorge-Sätze — nichts anzunehmen
	// oder abzulehnen, daher ohne Aktionsreihe, Grundauswahl, Nachrück-Cursor oder Dismissal; sie
	// verschwinden von selbst, sobald die Überlast-Mindestmenge erreicht ist.
	if (vorschlag.anlass === 'ermutigung' || vorschlag.anlass === 'einstieg') {
		return (
			<div className="care-hint" data-testid="care-hint" role="status" aria-label={t('care.label')}>
				<KolAlert _type="info" _variant="card" _label={t('care.label')}>
					<p>{vorschlag.titel}</p>
				</KolAlert>
			</div>
		);
	}

	const schliessen = (aktion: () => Promise<unknown>): void => {
		setFehler(false);
		setAusgeblendet(true);
		aktion().catch(() => {
			setAusgeblendet(false);
			setFehler(true);
		});
	};

	const uebernehmen = (): Promise<unknown> => {
		if (vorschlag.typ === 'task' && vorschlag.taskId !== undefined) {
			return api.updateTask({ id: vorschlag.taskId, taskUpdate: { status: 'In process' } });
		}
		// #2077: `POST /tasks` nimmt nur gültige Vollverteilungen (alle Konto-Säulen, jeder Anteil
		// 5–80, Summe 100) — die Vorschlags-Beiträge werden deshalb über `fillContributions` auf die
		// Konto-Säulen normiert (bereits Gültiges bleibt unverändert); confidence wie bisher 100.
		const beitraege = vorschlag.saeulenBeitraege.map(({ pillarId, share }) => ({ pillarId, share, confidence: 100 }));
		const taskCreate: TaskCreate = {
			title: vorschlag.titel,
			description: vorschlag.beschreibung,
			priority: 3,
			estimatedEffort: 0.5,
			pillars: saeulen.length > 0 ? fillContributions(saeulen, beitraege) : beitraege,
		};
		return api.createTask({ taskCreate });
	};

	const ablehnen = (): Promise<unknown> => {
		if (vorschlag.typ === 'task' && vorschlag.taskId !== undefined) {
			const abgelehnt = { ...readRejectedTasks(), [vorschlag.taskId]: Date.now() + ABLEHNUNG_MS };
			window.localStorage.setItem(TASK_ABLEHNUNG_KEY, JSON.stringify(abgelehnt));
			return Promise.resolve();
		}
		if (vorschlag.typ === 'ki') {
			window.localStorage.setItem(KI_ABLEHNUNG_KEY, String(endeDesTages(new Date())));
			return Promise.resolve();
		}
		return api.dismissCareSuggestion({ templateKey: vorschlag.templateKey ?? '' });
	};

	/** „Nicht jetzt“ (#1977): rückt den Cursor hinter den aktuellen Vorschlag (bis Tagesende persistent)
	 *  und zeigt den Leerzustand, wenn keiner übrig bleibt. */
	const vorruecken = (): void => {
		const index = vorschlaege.indexOf(vorschlag) + 1;
		window.localStorage.setItem(NACHRUECK_KEY, JSON.stringify({ index, tag: new Date().toDateString() }));
		setNachrueck(index);
		setLeerzustand(!vorschlaege.slice(index).some((kandidat) => !istUnterdrueckt(kandidat, Date.now())));
	};

	/** „Nicht jetzt“: KI-Vorschlag ohne Schlüssel snoozed lokal sofort (#1873), sonst öffnet die Grundauswahl. */
	const nichtJetzt = (): void => {
		if (vorschlag.typ === 'ki') {
			schliessen(() => {
				window.localStorage.setItem(KI_ABLEHNUNG_KEY, String(endeDesTages(new Date())));
				return Promise.resolve();
			});
			return;
		}
		setFehler(false);
		setGrundOffen(true);
	};

	const grundSpeichern = (): void => {
		if (grund === undefined) {
			return;
		}
		const vorherRaw = window.localStorage.getItem(NACHRUECK_KEY);
		vorruecken();
		setGrundOffen(false);
		setGrund(undefined);
		const bezug =
			vorschlag.taskId !== undefined ? { taskId: vorschlag.taskId } : { templateKey: vorschlag.templateKey ?? '' };
		api.rejectCareSuggestion({ grund, ...bezug }).catch(() => {
			// Optimismus zurücknehmen: Vorschlag wieder zeigen, bestehendes Fehlerfeedback (#1793).
			if (vorherRaw === null) {
				window.localStorage.removeItem(NACHRUECK_KEY);
			} else {
				window.localStorage.setItem(NACHRUECK_KEY, vorherRaw);
			}
			setNachrueck(liesNachrueck());
			setLeerzustand(false);
			setFehler(true);
		});
	};

	const ueberspringen = (): void => {
		vorruecken();
		setGrundOffen(false);
		setGrund(undefined);
	};

	const abbrechen = (): void => {
		setGrundOffen(false);
		setGrund(undefined);
	};

	const grundLabels: Record<Grund, string> = {
		'zu-gross': t('care.reason.tooBig'),
		'gerade-nicht-moeglich': t('care.reason.notPossible'),
		'keine-energie': t('care.reason.noEnergy'),
		'warte-auf-jemanden': t('care.reason.waitingFor'),
		'falsche-prioritaet': t('care.reason.wrongPriority'),
	};

	return (
		<div className="care-hint" data-testid="care-hint" role="status" aria-label={t('care.label')}>
			<KolAlert _type="info" _variant="card" _label={t('care.label')}>
				{/* #1873: `span` statt `KolBadge` wie `SeriesBadge`/`GeoBadge` — der Text läge sonst im Shadow-DOM. */}
				{vorschlag.typ === 'ki' && (
					<span className="care-hint-ki" data-testid="care-hint-ki">
						{t('care.kiBadge')}
					</span>
				)}
				{/* Platzhalter = heutiges `beschreibung ?? titel` — die de-Tests (#1793 AK1) pinnen die Beschreibung. */}
				{/* #1977: Titelzeile — der Rahmensatz trägt die Beschreibung; ohne eigene Titelzeile wären
				   Vorschläge mit gleicher Beschreibung (Nachrücken) ununterscheidbar. */}
				{vorschlag.beschreibung != null && <p className="care-hint-titel">{vorschlag.titel}</p>}
				{vorschlag.anlass === 'ueberlast' ? (
					<p>{t('care.overload', { beschreibung: vorschlag.beschreibung ?? vorschlag.titel })}</p>
				) : (
					<p>
						{t('care.deficit', { saeuleName: vorschlag.saeuleName, titel: vorschlag.beschreibung ?? vorschlag.titel })}
					</p>
				)}
				{fehler && <p role="alert">{t('care.error')}</p>}
				{grundOffen ? (
					/* #1977: Grundauswahl ersetzt die Aktionsreihe (ein Screen, eine Aufgabe); Radio-Gruppe
					   mit Legend, vertikale Ein-Spalten-Liste; Speichern secondary — „Übernehmen“ bleibt die
					   eine Primäraktion der Karte. */
					<div className="care-hint-grund">
						<KolInputRadio
							_label={t('care.reasonLegend')}
							_orientation="vertical"
							_options={GRUENDE.map((wert) => ({ value: wert, label: grundLabels[wert] }))}
							_on={{ onChange: (_event, value) => setGrund(value as Grund) }}
						/>
						<div className="care-hint-actions">
							<KolButton _label={t('care.saveReason')} _variant="secondary" _on={{ onClick: grundSpeichern }} />
							<KolButton _label={t('care.skip')} _variant="tertiary" _on={{ onClick: ueberspringen }} />
							<KolButton _label={t('care.cancel')} _variant="tertiary" _on={{ onClick: abbrechen }} />
						</div>
					</div>
				) : (
					/* #2445: eine Zeile — „Übernehmen“ inhaltsbreit mit Text, Nebenaktionen als Icon-Schalter. */
					<div className="care-hint-actions">
						<KolButton
							_label={t('care.accept')}
							_variant="secondary"
							_on={{ onClick: () => schliessen(uebernehmen) }}
						/>
						<KolButton
							_label={t('care.notNow')}
							_hideLabel
							_variant="secondary"
							_icons={{ left: { icon: 'fa-regular fa-clock' } }}
							_on={{ onClick: nichtJetzt }}
						/>
						<KolButton
							_label={t('care.dismiss')}
							_hideLabel
							_variant="secondary"
							_icons={{ left: { icon: 'fa-solid fa-trash' } }}
							_on={{ onClick: () => schliessen(ablehnen) }}
						/>
					</div>
				)}
			</KolAlert>
		</div>
	);
};
