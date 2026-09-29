/**
 * Kontingent-Zähler für die fünf LLM-Routen (Issue #1459, T4 des Gesamtkonzepts
 * `docs/gesamtkonzept-monetarisierung.md`, Spec `docs/spec/issue-1459.md`). Die Paketgrenzen selbst
 * liegen ausschließlich in `logics/plans.ts` — diese Middleware bucht nur und fragt den Rollout-
 * Schalter ab. Sie läuft HINTER `requirePlanFeature('ai_assist')`: wem das Paket die KI gar nicht
 * erlaubt, der erreicht den Zähler nicht (403 statt 429).
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Op, UniqueConstraintError, literal } from 'sequelize';
import {
	AI_ASSIST_MONTHLY_QUOTA,
	AI_FAIR_USE_INTERVAL_SECONDS,
	effectivePlan,
	isMonetizationEnforced,
} from '../logics/plans.js';
import { getUserId, isAuthActive } from './requireAuth.js';
import { AiUsage, User } from '../models/index.js';
import { hasOwnProviderSelection } from '../llm/llmProviders.js';
import { hasProviderPin } from './llmProviderQuery.js';

/**
 * Ein von {@link meterAiQuota} erzeugter Handler trägt die Marker-Eigenschaft — der Abdeckungstest
 * (`ai-quota-coverage.test.ts`, AK5) liest sie aus dem Express-Router-Stack und erkennt so eine
 * neue LLM-Route ohne Zähler. Muster: `PlanFeatureHandler.planFeature` aus `planGuard.ts`.
 */
export interface AiQuotaHandler extends RequestHandler {
	aiQuotaMetered: true;
}

/** Abrechnungsfenster des Verbrauchs: Kalendermonat als `YYYY-MM` (UTC). */
export const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

/**
 * Ein einziges bedingtes `UPDATE ... SET count = count + 1 WHERE … AND count < limit` — kein
 * Read-Modify-Write in JavaScript, sonst kämen gleichzeitige Anfragen unbemerkt über das Budget.
 * `limit === null` bucht ohne Grenze.
 * @returns `false`, wenn keine Zeile betroffen war — Zeile fehlt oder Budget ist erreicht.
 */
const increment = async (userId: number, yearMonth: string, limit: number | null): Promise<boolean> => {
	const [affected] = await AiUsage.update(
		{ count: literal('count + 1') },
		{ where: limit === null ? { userId, yearMonth } : { userId, yearMonth, count: { [Op.lt]: limit } } },
	);
	return affected > 0;
};

/**
 * Bucht einen Punkt: erst das bedingte `UPDATE`, und nur falls es ins Leere lief, die Monatszeile
 * anlegen und nachbuchen. Bewusst OHNE `findOrCreate` — das eröffnet eine Transaktion, und bei
 * gleichzeitigen Anfragen auf derselben SQLite-Verbindung (`pool.max = 1` im Testbetrieb) überlagern
 * sich die Transaktionen. Beim Wettlauf um die erste Zeile gewinnt genau ein `create`, die Verlierer
 * laufen in den Unique-Index (`UniqueConstraintError`). Das heißt NICHT "Budget erreicht": die
 * Zeile steht nach dem Konflikt garantiert und ist in aller Regel noch fast leer (erster Request des
 * Monats). Deshalb buchen die Verlierer über dasselbe bedingte `UPDATE` nach — erst wenn auch das ins
 * Leere läuft, ist das Budget wirklich erreicht.
 */
const book = async (userId: number, yearMonth: string, limit: number | null): Promise<boolean> => {
	if (await increment(userId, yearMonth, limit)) {
		return true;
	}
	try {
		await AiUsage.create({ userId, yearMonth, count: 0 });
	} catch (error) {
		if (!(error instanceof UniqueConstraintError)) {
			throw error;
		}
	}
	return increment(userId, yearMonth, limit);
};

/** Macht eine Buchung rückgängig (nie unter 0) — für Anfragen, die keinen Provider-Call gekostet haben. */
const refund = async (userId: number, yearMonth: string): Promise<void> => {
	await AiUsage.update({ count: literal('count - 1') }, { where: { userId, yearMonth, count: { [Op.gt]: 0 } } });
};

/**
 * Zeitpunkt (ms) der letzten über dem Budget durchgelassenen Anfrage je Konto — Grundlage der
 * Fair-Use-Drossel (#1783). Bewusst im Speicher wie der Store von `express-rate-limit`
 * (`geocodeRateLimit.ts`): nach einem Neustart darf die erste Anfrage sofort durch.
 */
const lastOverBudgetAt = new Map<string, number>();

/** Id plus Anlagezeitpunkt — ein neu angelegtes Konto mit wiederverwendeter Id erbt keine fremde Wartezeit. */
const fairUseKey = (user: User): string => `${user.id}:${user.createdAt.getTime()}`;

/**
 * Prüft die Drossel und belegt bei Erfolg das Intervall.
 * @returns Restwartezeit in Sekunden (> 0 = abweisen) oder `0`, wenn die Anfrage durch darf.
 */
const claimFairUseSlot = (key: string): number => {
	const now = Date.now();
	const waitMs = (lastOverBudgetAt.get(key) ?? 0) + AI_FAIR_USE_INTERVAL_SECONDS * 1000 - now;
	if (waitMs > 0) {
		return Math.ceil(waitMs / 1000);
	}
	lastOverBudgetAt.set(key, now);
	return 0;
};

/**
 * Bucht einen Punkt nach Fair Use (#1783): unter dem Budget ohne Weiteres, darüber höchstens einmal
 * je {@link AI_FAIR_USE_INTERVAL_SECONDS}. Es gibt keinen Deckel — auch weit über dem Budget wird
 * gebucht, nur gedrosselt. Bei ausgeschaltetem Rollout wird nie gedrosselt.
 * @returns `{ retryAfter }` (Sekunden) bei zu früher Anfrage — dann ist NICHT gebucht; sonst
 *   `{ throttled }`, ob die Buchung über dem Budget lag.
 */
const bookFairUse = async (
	userId: number,
	key: string,
	yearMonth: string,
	budget: number,
): Promise<{ throttled: boolean } | { retryAfter: number }> => {
	if (!isMonetizationEnforced()) {
		await book(userId, yearMonth, null);
		return { throttled: false };
	}
	if (await book(userId, yearMonth, budget)) {
		return { throttled: false };
	}
	const retryAfter = claimFairUseSlot(key);
	if (retryAfter > 0) {
		return { retryAfter };
	}
	await book(userId, yearMonth, null);
	return { throttled: true };
};

/** Gibt ein belegtes Drossel-Intervall frei — die Anfrage hat keinen Provider-Call gekostet. */
const releaseFairUseSlot = (key: string): void => {
	lastOverBudgetAt.delete(key);
};

/** 429 `ai_throttled` mit `Retry-After` — Fair-Use-Drossel über dem Budget (#1783 AK2). */
const sendThrottled = (res: Response, retryAfter: number): void => {
	res.setHeader('Retry-After', String(retryAfter));
	res.status(429).json({
		message: `Die KI-Hilfe antwortet gerade etwas langsamer — in etwa ${retryAfter} Sekunden geht es weiter.`,
		code: 'ai_throttled',
	});
};

/** Bucht und storniert einzelne Punkte innerhalb EINES Requests — siehe {@link createAiQuotaCounter}. */
export interface AiQuotaCounter {
	/** Bucht einen Punkt nach Fair Use (#1783); `false` heißt „über dem Budget gedrosselt". */
	book: () => Promise<boolean>;
	/** Nimmt eine Buchung zurück, deren Provider-Aufruf nichts geliefert hat. */
	refund: () => Promise<void>;
}

/**
 * Hängt die Marker-Eigenschaft an einen Handler, den der Abdeckungstest
 * (`ai-quota-coverage.test.ts`, AK5) im Router-Stack sucht. {@link meterAiQuota} nutzt sie für
 * die Middleware; eine Route, die ihr Kontingent selbst je Provider-Aufruf bucht (Säulen-Batch,
 * #1614), markiert damit ihren eigenen Handler — gezählt wird sie, nur nicht von der Middleware.
 */
export const markAiQuotaMetered = (handler: RequestHandler): AiQuotaHandler =>
	Object.assign(handler, { aiQuotaMetered: true as const });

/**
 * Kontingent-Haken für Läufe, die in EINEM Request mehrere Provider-Aufrufe auslösen — der
 * Säulen-Batch über die eigenen Aufgaben (#1614) klassifiziert je Aufgabe einmal.
 * {@link meterAiQuota} bucht pro Request; ein Batch über N Aufgaben käme damit für N Aufrufe mit
 * einem einzigen Punkt davon und hebelte das Monatskontingent aus.
 *
 * Liefert `undefined`, wenn für diesen Aufruf gar nichts zu zählen ist — dieselben Ausnahmen wie
 * in der Middleware: Pass-Through-Modus ohne Auth, kein Nutzer, eigener Provider des Nutzers ohne
 * `?provider=`-Pin (#1548), oder ein Konto ohne auflösbares Paket.
 */
export const createAiQuotaCounter = async (
	userId: number | undefined,
	providerPinned: boolean,
): Promise<AiQuotaCounter | undefined> => {
	if (!isAuthActive() || typeof userId !== 'number') {
		return undefined;
	}
	if (!providerPinned && (await hasOwnProviderSelection(userId))) {
		return undefined;
	}
	const user = await User.findByPk(userId);
	if (user === null) {
		return undefined;
	}
	const yearMonth = currentYearMonth();
	const budget = AI_ASSIST_MONTHLY_QUOTA[effectivePlan(user.plan)];
	return {
		book: async () => !('retryAfter' in (await bookFairUse(userId, fairUseKey(user), yearMonth, budget))),
		refund: () => refund(userId, yearMonth),
	};
};

/**
 * Middleware-Fabrik: bucht vor dem Routen-Handler einen Punkt des Monatsbudgets. Über dem Budget
 * drosselt sie nach Fair Use (#1783): höchstens eine Anfrage je Intervall, schnellere Anfragen
 * erhalten 429 `ai_throttled` mit `Retry-After` und zählen nicht.
 *
 * Die Buchung steht bewusst VOR dem Provider-Call (sonst zählt ein paralleler Schwung Anfragen am
 * Budget vorbei). Weil die Anfrage danach trotzdem noch scheitern kann, hängt sich die Middleware in
 * `res.json` ein — die einzige Stelle, an der alle fünf Routen antworten. Dort wird
 * - bei Status ≥ 400 die Buchung zurückgenommen (AK4: weder ein Provider-Fehler ≥ 500 noch eine 400
 *   aus der Eingabevalidierung kostet Budget) — und zwar VOR dem Senden der Antwort, damit der
 *   Zähler steht, sobald der Aufrufer die Antwort hat;
 * - bei einer gedrosselten Buchung `fairUse: 'throttled'` in den Antwort-Body ergänzt, damit die App
 *   den Hinweis zeigt.
 *
 * Bewusste Abweichung vom Handler-Muster der übrigen Guards: der Alternativweg wäre, dieselbe
 * Rückbuchung und dasselbe Zusatzfeld in fünf Routen-Handlern zu duplizieren.
 */
export const meterAiQuota = (): AiQuotaHandler => {
	const handler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		// Pass-Through-Modus (keine Auth konfiguriert) — wie `requireAuth`/`requirePlanFeature`
		// deaktiviert; ohne Nutzer gibt es kein Budget, das gezählt werden könnte.
		if (!isAuthActive()) {
			next();
			return;
		}
		const userId = getUserId(req);
		if (typeof userId !== 'number') {
			next();
			return;
		}
		// #1548: Aufrufe über den eigenen Provider des Nutzers kosten die Instanz nichts — weder
		// buchen noch drosseln noch (bei Fehlerantworten) zurückbuchen (AK5).
		// Ein `?provider=`-Pin übersteuert die eigene Auswahl (resolveProvider ist pin-first) und
		// läuft je nach Name auf einem instanzweiten Provider — dann wird gezählt wie bisher (AK6).
		if (!hasProviderPin(req.query as Record<string, unknown>) && (await hasOwnProviderSelection(userId))) {
			next();
			return;
		}
		const user = await User.findByPk(userId);
		if (user === null) {
			next();
			return;
		}

		const yearMonth = currentYearMonth();
		const key = fairUseKey(user);
		const booking = await bookFairUse(userId, key, yearMonth, AI_ASSIST_MONTHLY_QUOTA[effectivePlan(user.plan)]);
		if ('retryAfter' in booking) {
			sendThrottled(res, booking.retryAfter);
			return;
		}

		const sendJson = res.json.bind(res);
		res.json = (body: unknown): Response => {
			if (res.statusCode >= 400) {
				if (booking.throttled) {
					releaseFairUseSlot(key);
				}
				// Ohne `.catch()` endet eine fehlgeschlagene Rückbuchung als unbehandelte Rejection —
				// `index.ts` beendet den Prozess darauf mit `process.exit(1)` und reißt alle Nutzer mit.
				// Eine verlorene Rückbuchung kostet einen Budgetpunkt, mehr nicht; die Fehlerantwort
				// muss in jedem Fall raus.
				void refund(userId, yearMonth)
					.catch((error: unknown) => {
						console.warn('KI-Budget-Rückbuchung fehlgeschlagen', error);
					})
					.then(() => sendJson(body));
				return res;
			}
			const enriched =
				booking.throttled && typeof body === 'object' && body !== null && !Array.isArray(body)
					? { ...body, fairUse: 'throttled' }
					: body;
			return sendJson(enriched);
		};
		next();
	};
	return markAiQuotaMetered(handler as RequestHandler);
};
