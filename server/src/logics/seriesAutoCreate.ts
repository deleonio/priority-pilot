import { GENERATE_HORIZON_DAYS, materializeDueSeries } from './series.js';
import type { PushSender } from './push.js';

/**
 * Täglicher Job (#2356): legt die fälligen Instanzen aller aktiven Serien mit `autoCreate` aller
 * Nutzer bis `now + GENERATE_HORIZON_DAYS` an (idempotent, höchstens fünf offene je Serie).
 * Fremd angelegte Serien lösen die gebündelte Benachrichtigung aus (#1253).
 */
export const runSeriesAutoCreate = async (now: Date, pushSender?: PushSender): Promise<void> => {
	const until = new Date(now);
	until.setUTCDate(until.getUTCDate() + GENERATE_HORIZON_DAYS);
	await materializeDueSeries(undefined, until, pushSender);
};
