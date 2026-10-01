import { KolAlert, KolButton } from '@public-ui/react-v19';
import type { CareVorschlag, TaskCreate } from 'client';
import { useEffect, useState } from 'react';
import { api } from '../api';

const TAG_MS = 24 * 60 * 60 * 1000;
/** Spiegel von `CARE_ABLEHNUNG_TAGE` (`server/src/logics/careSuggestions.ts`) — der Server kennt nur Vorlagen-Ablehnungen. */
const ABLEHNUNG_MS = 14 * TAG_MS;
const SNOOZE_KEY = 'pp-care-hint-snooze-until';
const TASK_ABLEHNUNG_KEY = 'pp-care-hint-rejected-tasks';
/** #1873: KI-Vorschlag hat keinen `templateKey` — Ablehnung lokal bis Tagesende (der Server liefert ihn den Tag über gleich). */
const KI_ABLEHNUNG_KEY = 'pp-care-hint-ki-rejected-until';

const readNumber = (key: string): number => Number(window.localStorage.getItem(key) ?? 0);

const readRejectedTasks = (): Record<string, number> => {
	try {
		return JSON.parse(window.localStorage.getItem(TASK_ABLEHNUNG_KEY) ?? '{}') as Record<string, number>;
	} catch {
		return {};
	}
};

/** Lokal unterdrückt: „Nicht jetzt" und abgelehnter KI-Vorschlag bis Tagesende, abgelehnte eigene Aufgabe für 14 Tage. */
const istUnterdrueckt = (vorschlag: CareVorschlag, jetzt: number): boolean =>
	readNumber(SNOOZE_KEY) > jetzt ||
	(vorschlag.typ === 'ki' && readNumber(KI_ABLEHNUNG_KEY) > jetzt) ||
	(vorschlag.taskId !== undefined && (readRejectedTasks()[vorschlag.taskId] ?? 0) > jetzt);

const endeDesTages = (jetzt: Date): number =>
	new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + 1).getTime();

/** #1967: Zweckbestimmung + Krisenhinweis; Light-DOM-`a` statt KolLink (sonst im Shadow-DOM, #1873). */
const HILFE = (
	<p className="care-hint-help">
		Kein Ersatz für ärztlichen Rat. In einer Krise erreichst du die{' '}
		<a href="tel:08001110111">TelefonSeelsorge: 0800 111 0 111</a> (kostenfrei, rund um die Uhr).
	</p>
);

/**
 * Fürsorge-Hinweis auf dem Dashboard (#1793, Ton: `docs/fuersorge-tonalitaet.md`): zeigt höchstens
 * EINEN Vorschlag aus `GET /scores/care-suggestions` (der erste; kein Nachrücken nach einer Aktion)
 * mit Übernehmen / Nicht jetzt / Ablehnen. Bei `anlass: 'ueberlast'` (#1795) rahmt der Hinweis den
 * Vorschlag als Ausgleich statt als Defizit; ein KI-Vorschlag (`typ: 'ki'`, #1873) trägt die Kennzeichnung
 * „KI-Vorschlag". Lädt selbst (Muster `DayDoneHint`); bis zur Antwort und
 * bei Ladefehler wird nichts gerendert, damit „Nächste Aufgabe" nicht springt.
 *
 * Aktionen wirken optimistisch — der Hinweis verschwindet sofort, schlägt Übernehmen/Ablehnen einer
 * Vorlage serverseitig fehl, kommt er mit Fehlermeldung zurück. Die Statusregion ist ein `div`, weil
 * `KolAlert` ohne `_alert` keine Live-Region setzt und der Hinweis nichts vorlesen soll.
 */
export const CareHint = () => {
	const [vorschlaege, setVorschlaege] = useState<CareVorschlag[] | undefined>(undefined);
	const [ausgeblendet, setAusgeblendet] = useState(false);
	const [fehler, setFehler] = useState(false);

	useEffect(() => {
		const controller = new AbortController();
		api
			.getCareSuggestions({ signal: controller.signal })
			.then((result) => setVorschlaege(result.vorschlaege))
			.catch(() => undefined);
		return () => controller.abort();
	}, []);

	if (vorschlaege === undefined) {
		return null;
	}

	if (vorschlaege.length === 0) {
		return (
			<div className="care-hint" data-testid="care-hint" role="status" aria-label="Fürsorge-Hinweis">
				<KolAlert _type="info" _variant="card" _label="Fürsorge-Hinweis">
					<p>Gerade gibt es keinen Vorschlag für dich. Mach in deinem Tempo weiter.</p>
					{HILFE}
				</KolAlert>
			</div>
		);
	}

	const vorschlag = vorschlaege[0]!;
	if (ausgeblendet || istUnterdrueckt(vorschlag, Date.now())) {
		return null;
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
		const taskCreate: TaskCreate = {
			title: vorschlag.titel,
			description: vorschlag.beschreibung,
			priority: 3,
			estimatedEffort: 0.5,
			pillars: vorschlag.saeulenBeitraege.map(({ pillarId, share }) => ({ pillarId, share, confidence: 100 })),
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

	const nichtJetzt = (): Promise<unknown> => {
		window.localStorage.setItem(SNOOZE_KEY, String(endeDesTages(new Date())));
		return Promise.resolve();
	};

	return (
		<div className="care-hint" data-testid="care-hint" role="status" aria-label="Fürsorge-Hinweis">
			<KolAlert _type="info" _variant="card" _label="Fürsorge-Hinweis">
				{/* #1873: `span` statt `KolBadge` wie `SeriesBadge`/`GeoBadge` — der Text läge sonst im Shadow-DOM. */}
				{vorschlag.typ === 'ki' && (
					<span className="care-hint-ki" data-testid="care-hint-ki">
						KI-Vorschlag
					</span>
				)}
				{vorschlag.anlass === 'ueberlast' ? (
					<p>
						Du hast zuletzt viel geleistet. Ein Ausgleich darf heute sein: {vorschlag.beschreibung ?? vorschlag.titel}
					</p>
				) : (
					<p>
						{vorschlag.saeuleName} kam diese Woche zu kurz. {vorschlag.beschreibung ?? vorschlag.titel}?
					</p>
				)}
				{HILFE}
				{fehler && <p role="alert">Konnte nicht angelegt werden. Versuch es gleich noch einmal.</p>}
				<div className="care-hint-actions">
					<KolButton
						className="care-hint-accept"
						_label="Vorschlag übernehmen"
						_variant="secondary"
						_on={{ onClick: () => schliessen(uebernehmen) }}
					/>
					<KolButton _label="Nicht jetzt" _variant="tertiary" _on={{ onClick: () => schliessen(nichtJetzt) }} />
					<KolButton _label="Vorschlag ablehnen" _variant="tertiary" _on={{ onClick: () => schliessen(ablehnen) }} />
				</div>
			</KolAlert>
		</div>
	);
};
