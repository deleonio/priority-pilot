import { createHmac } from 'node:crypto';
import { col, fn } from 'sequelize';
import { ScoreEntry, Task, User } from '../models/index.js';
import CareSuggestionEvent, { type CareReaktion } from '../models/careSuggestionEvent.js';
import CarePushToggle from '../models/carePushToggle.js';

/**
 * Wirkungsmessung der Fürsorge (#1798): anonyme Protokollierung der Reaktionen auf Vorlagen,
 * Verlauf des Fürsorge-Push-Schalters und die Admin-Auswertung daraus (Wochenquoten, 4-/12-Wochen-
 * Bindung je Push-Gruppe). Die Auswertung enthält nur Summen; Zellen unter {@link MIN_ZELLE}
 * Nutzern werden unterdrückt.
 */

const TAG_MS = 86_400_000;
const WOCHE_MS = 7 * TAG_MS;
/** Kleinste ausgewiesene Gruppengröße (AK6). */
const MIN_ZELLE = 5;
const ZIELWOCHEN = { w4: 4, w12: 12 } as const;

type Gruppe = 'push_an' | 'push_aus';
type Ziel = keyof typeof ZIELWOCHEN;
type BindungsZelle = { nutzer: number; aktiv: number; quote: number } | 'unterdrueckt';

interface CareWirkungWoche {
	woche: string;
	angezeigt: number;
	uebernommen: number;
	abgelehnt: number;
	ignoriert: number;
}

export interface CareWirkung {
	wochen: CareWirkungWoche[];
	bindung: Record<Gruppe, Record<Ziel, BindungsZelle>>;
}

export interface CareWirkungEingabe {
	ereignisse: { woche: string; reaktion: CareReaktion; anzahl: number }[];
	nutzer: { id: number; registriertAm: Date; carePushEnabled: boolean }[];
	/** Schalterwechsel, aufsteigend nach `geaendertAm`. */
	pushWechsel: { userId: number; aktiv: boolean; geaendertAm: Date }[];
	erledigungen: { userId: number; zeitpunkt: Date }[];
}

/** Montag 00:00 UTC der Woche von `zeitpunkt`. */
const wochenStart = (zeitpunkt: Date): number => {
	const tag = Date.UTC(zeitpunkt.getUTCFullYear(), zeitpunkt.getUTCMonth(), zeitpunkt.getUTCDate());
	return tag - ((new Date(tag).getUTCDay() + 6) % 7) * TAG_MS;
};

const dedupSecret = (): string => process.env.SESSION_SECRET?.trim() || 'care-wirkung';

/**
 * Protokolliert Reaktionen auf Vorlagen (AK1/AK2) ohne Nutzerbezug. Anzeigen tragen einen
 * HMAC-`dedupKey` aus Nutzer, Vorlage und Woche — je Woche zählt nur die erste. Fehler werden nur
 * geloggt, die Nutzer-Anfrage darf daran nicht scheitern.
 */
export const protokolliereCareReaktion = async (
	userId: number | undefined,
	reaktion: CareReaktion,
	templateKeys: string[],
	jetzt = new Date(),
): Promise<void> => {
	if (templateKeys.length === 0) return;
	const woche = new Date(wochenStart(jetzt)).toISOString().slice(0, 10);
	try {
		await CareSuggestionEvent.bulkCreate(
			templateKeys.map((templateKey) => ({
				woche,
				templateKey,
				reaktion,
				dedupKey:
					reaktion === 'angezeigt'
						? createHmac('sha256', dedupSecret())
								.update(`${userId ?? 0}|${templateKey}|${woche}`)
								.digest('hex')
						: null,
			})),
			{ ignoreDuplicates: true },
		);
	} catch (error) {
		console.warn('Fürsorge-Reaktion nicht protokolliert:', error);
	}
};

/** Protokolliert einen tatsächlichen Wechsel des Fürsorge-Push-Schalters (AK5); Fehler nur geloggt. */
export const protokolliereCarePushWechsel = async (
	userId: number,
	vorher: boolean,
	nachher: boolean,
): Promise<void> => {
	if (vorher === nachher) return;
	try {
		await CarePushToggle.create({ userId, aktiv: nachher, geaendertAm: new Date() });
	} catch (error) {
		console.warn('Wechsel des Fürsorge-Pushs nicht protokolliert:', error);
	}
};

/**
 * Push-Stand zum `zeitpunkt`: letzter Wechsel davor; liegt jeder Wechsel danach, das Gegenteil des
 * ersten; ohne Verlauf der aktuelle Wert.
 */
const pushStandZu = (wechsel: CareWirkungEingabe['pushWechsel'], zeitpunkt: number, aktuell: boolean): boolean => {
	const davor = wechsel.filter((w) => w.geaendertAm.getTime() <= zeitpunkt);
	if (davor.length > 0) return davor[davor.length - 1].aktiv;
	return wechsel.length > 0 ? !wechsel[0].aktiv : aktuell;
};

/**
 * Rechnet die Auswertung (AK3/AK4/AK6). „Ignoriert“ = angezeigt − übernommen − abgelehnt, erst für
 * Wochen, deren Ende mindestens 7 Tage zurückliegt. Bindung: Kohorte = Registrierungswoche, aktiv =
 * mindestens eine Erledigung in Woche 4 bzw. 12 danach; nur Nutzer, deren Zielwoche vorbei ist.
 */
export const berechneCareWirkung = (eingabe: CareWirkungEingabe, jetzt: Date): CareWirkung => {
	const jeWoche = new Map<string, CareWirkungWoche>();
	for (const { woche, reaktion, anzahl } of eingabe.ereignisse) {
		const eintrag = jeWoche.get(woche) ?? { woche, angezeigt: 0, uebernommen: 0, abgelehnt: 0, ignoriert: 0 };
		eintrag[reaktion] += anzahl;
		jeWoche.set(woche, eintrag);
	}
	const wochen = [...jeWoche.values()]
		.map((w) => ({
			...w,
			ignoriert:
				Date.parse(w.woche) + 2 * WOCHE_MS <= jetzt.getTime()
					? Math.max(0, w.angezeigt - w.uebernommen - w.abgelehnt)
					: 0,
		}))
		.sort((a, b) => a.woche.localeCompare(b.woche));

	const zelle = (nutzer: number, aktiv: number): BindungsZelle =>
		nutzer < MIN_ZELLE ? 'unterdrueckt' : { nutzer, aktiv, quote: aktiv / nutzer };
	const bindung = { push_an: {}, push_aus: {} } as CareWirkung['bindung'];
	for (const [ziel, n] of Object.entries(ZIELWOCHEN) as [Ziel, number][]) {
		const zaehler = { push_an: { nutzer: 0, aktiv: 0 }, push_aus: { nutzer: 0, aktiv: 0 } };
		for (const nutzer of eingabe.nutzer) {
			const start = wochenStart(nutzer.registriertAm) + n * WOCHE_MS;
			const ende = start + WOCHE_MS;
			if (ende > jetzt.getTime()) continue;
			const wechsel = eingabe.pushWechsel.filter((w) => w.userId === nutzer.id);
			const gruppe: Gruppe = pushStandZu(wechsel, start, nutzer.carePushEnabled) ? 'push_an' : 'push_aus';
			zaehler[gruppe].nutzer += 1;
			const aktiv = eingabe.erledigungen.some(
				(e) => e.userId === nutzer.id && e.zeitpunkt.getTime() >= start && e.zeitpunkt.getTime() < ende,
			);
			if (aktiv) zaehler[gruppe].aktiv += 1;
		}
		bindung.push_an[ziel] = zelle(zaehler.push_an.nutzer, zaehler.push_an.aktiv);
		bindung.push_aus[ziel] = zelle(zaehler.push_aus.nutzer, zaehler.push_aus.aktiv);
	}
	return { wochen, bindung };
};

/** Lädt die Rohdaten für {@link berechneCareWirkung} — nur Summen, Zeitpunkte und interne Ids. */
export const ladeCareWirkung = async (jetzt = new Date()): Promise<CareWirkung> => {
	const [ereignisse, nutzer, pushWechsel, erledigungen] = await Promise.all([
		CareSuggestionEvent.findAll({
			attributes: ['woche', 'reaktion', [fn('COUNT', col('id')), 'anzahl']],
			group: ['woche', 'reaktion'],
			raw: true,
		}) as unknown as Promise<{ woche: string; reaktion: CareReaktion; anzahl: number | string }[]>,
		User.findAll({ attributes: ['id', 'createdAt', 'carePushEnabled'] }),
		CarePushToggle.findAll({ order: [['geaendertAm', 'ASC']] }),
		ScoreEntry.findAll({
			attributes: ['zeitpunkt'],
			include: [{ model: Task, attributes: ['userId'], required: true }],
		}),
	]);
	return berechneCareWirkung(
		{
			ereignisse: ereignisse.map((e) => ({ woche: e.woche, reaktion: e.reaktion, anzahl: Number(e.anzahl) })),
			nutzer: nutzer.map((u) => ({ id: u.id, registriertAm: u.createdAt, carePushEnabled: u.carePushEnabled ?? true })),
			pushWechsel: pushWechsel.map((w) => ({ userId: w.userId, aktiv: w.aktiv, geaendertAm: w.geaendertAm })),
			erledigungen: erledigungen.flatMap((e) =>
				e.Task?.userId != null ? [{ userId: e.Task.userId, zeitpunkt: e.zeitpunkt }] : [],
			),
		},
		jetzt,
	);
};
