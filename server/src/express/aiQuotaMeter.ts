/**
 * Kontingent-Zähler für die fünf LLM-Routen (Issue #1459, T4 des Gesamtkonzepts
 * `docs/gesamtkonzept-monetarisierung.md`, Spec `docs/spec/issue-1459.md`). Die Paketgrenzen selbst
 * liegen ausschließlich in `logics/plans.ts` — diese Middleware bucht nur und fragt den Rollout-
 * Schalter ab. Sie läuft HINTER `requirePlanFeature('ai_assist')`: wem das Paket die KI gar nicht
 * erlaubt, der erreicht den Zähler nicht (403 statt 429).
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { Op, UniqueConstraintError, literal } from 'sequelize';
import { AI_ASSIST_MONTHLY_QUOTA, isMonetizationEnforced, type Plan } from '../logics/plans.js';
import { sendPlanError } from './http-error.js';
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
const currentYearMonth = (): string => new Date().toISOString().slice(0, 7);

/** Verbrauch des laufenden Monats — Grundlage für `quotaRemaining` in `GET /auth/me` (AK7). */
export const getAiUsageCount = async (userId: number): Promise<number> => {
	const row = await AiUsage.findOne({ where: { userId, yearMonth: currentYearMonth() } });
	return row?.count ?? 0;
};

/**
 * Ein einziges bedingtes `UPDATE ... SET count = count + 1 WHERE … AND count < limit` — kein
 * Read-Modify-Write in JavaScript, sonst kämen gleichzeitige Anfragen am Deckel vorbei (AK3).
 * `limit === null` (Rollout aus) bucht ohne Obergrenze, damit der ausgeschaltete Schalter nie
 * implizit deckelt (AK8).
 * @returns `false`, wenn keine Zeile betroffen war — Zeile fehlt oder Kontingent ist erschöpft.
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
 * laufen in den Unique-Index (`UniqueConstraintError`). Das heißt NICHT "Kontingent erschöpft": die
 * Zeile steht nach dem Konflikt garantiert und ist in aller Regel noch fast leer (erster Request des
 * Monats). Deshalb buchen die Verlierer über dasselbe bedingte `UPDATE` nach — erst wenn auch das ins
 * Leere läuft, ist das Kontingent wirklich aufgebraucht.
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

/** Bucht und storniert einzelne Punkte innerhalb EINES Requests — siehe {@link createAiQuotaCounter}. */
export interface AiQuotaCounter {
	/** Bucht einen Punkt; `false` heißt „Kontingent erschöpft". */
	book: () => Promise<boolean>;
	/** Nimmt eine Buchung zurück, deren Provider-Aufruf nichts geliefert hat. */
	refund: () => Promise<void>;
	/** Paket des Kontos — die 429-Antwort nennt es. */
	plan: Plan;
	/** Monatsgrenze des Pakets (unabhängig vom Rollout-Schalter), für die Fehlermeldung. */
	monthlyLimit: number;
	/** Verbleibende Anfragen des Monats, frisch gelesen — erst NACH dem Lauf aussagekräftig. */
	remaining: () => Promise<number>;
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
	const plan = (await User.findByPk(userId))?.plan;
	if (plan === undefined) {
		return undefined;
	}
	const yearMonth = currentYearMonth();
	const monthlyLimit = AI_ASSIST_MONTHLY_QUOTA[plan];
	// `null` bucht ohne Obergrenze — bei ausgeschaltetem Rollout deckelt nichts (AK8).
	const limit = isMonetizationEnforced() ? monthlyLimit : null;
	return {
		book: () => book(userId, yearMonth, limit),
		refund: () => refund(userId, yearMonth),
		plan,
		monthlyLimit,
		remaining: async () => Math.max(0, monthlyLimit - (await getAiUsageCount(userId))),
	};
};

/**
 * Middleware-Fabrik: bucht vor dem Routen-Handler einen Punkt des Monatskontingents und weist bei
 * erschöpftem Kontingent mit 429 `quota_exhausted` ab (AK1, AK6).
 *
 * Die Buchung steht bewusst VOR dem Provider-Call (sonst zählt ein paralleler Schwung Anfragen am
 * Deckel vorbei). Weil die Anfrage danach trotzdem noch scheitern kann, hängt sich die Middleware in
 * `res.json` ein — die einzige Stelle, an der alle fünf Routen antworten. Dort wird
 * - bei Status ≥ 400 die Buchung zurückgenommen (AK4: weder ein Provider-Fehler ≥ 500 noch eine 400
 *   aus der Eingabevalidierung kostet Kontingent) — und zwar VOR dem Senden der Antwort, damit der
 *   Zähler steht, sobald der Aufrufer die Antwort hat;
 * - bei Erfolg `quotaRemaining` in den Antwort-Body ergänzt (AK7).
 *
 * Bewusste Abweichung vom Handler-Muster der übrigen Guards: der Alternativweg wäre, dieselbe
 * Rückbuchung und dasselbe Zusatzfeld in fünf Routen-Handlern zu duplizieren.
 */
export const meterAiQuota = (): AiQuotaHandler => {
	const handler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		// Pass-Through-Modus (keine Auth konfiguriert) — wie `requireAuth`/`requirePlanFeature`
		// deaktiviert; ohne Nutzer gibt es kein Kontingent, das gezählt werden könnte.
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
		// buchen noch (bei Fehlerantworten) zurückbuchen; der Monatszähler bleibt unangetastet (AK5).
		// Ein `?provider=`-Pin übersteuert die eigene Auswahl (resolveProvider ist pin-first) und
		// läuft je nach Name auf einem instanzweiten Provider — dann wird gezählt wie bisher (AK6).
		if (!hasProviderPin(req.query as Record<string, unknown>) && (await hasOwnProviderSelection(userId))) {
			next();
			return;
		}
		const plan = (await User.findByPk(userId))?.plan;
		if (plan === undefined) {
			next();
			return;
		}

		const yearMonth = currentYearMonth();
		const limit = AI_ASSIST_MONTHLY_QUOTA[plan];
		const booked = await book(userId, yearMonth, isMonetizationEnforced() ? limit : null);
		if (!booked) {
			sendPlanError(res, 429, `Das monatliche KI-Kontingent von ${limit} Anfragen ist aufgebraucht.`, {
				code: 'quota_exhausted',
				feature: 'ai_assist',
				currentPlan: plan,
			});
			return;
		}

		const remaining = Math.max(0, limit - (await getAiUsageCount(userId)));
		const sendJson = res.json.bind(res);
		res.json = (body: unknown): Response => {
			if (res.statusCode >= 400) {
				// Ohne `.catch()` endet eine fehlgeschlagene Rückbuchung als unbehandelte Rejection —
				// `index.ts` beendet den Prozess darauf mit `process.exit(1)` und reißt alle Nutzer mit.
				// Eine verlorene Rückbuchung kostet einen Kontingentpunkt, mehr nicht; die Fehlerantwort
				// muss in jedem Fall raus.
				void refund(userId, yearMonth)
					.catch((error: unknown) => {
						console.warn('KI-Kontingent-Rückbuchung fehlgeschlagen', error);
					})
					.then(() => sendJson(body));
				return res;
			}
			const enriched =
				typeof body === 'object' && body !== null && !Array.isArray(body)
					? { ...body, quotaRemaining: remaining }
					: body;
			return sendJson(enriched);
		};
		next();
	};
	return markAiQuotaMetered(handler as RequestHandler);
};
