import { Op, type Sequelize } from 'sequelize';
import { PLAN_VALUES, type Plan } from './plans.js';

/**
 * Übergangs-Setzung vor dem Scharfschalten von `MONETIZATION_ENFORCED` (#1463, T8): Konten, die
 * vor dem Stichtag angelegt wurden und noch nie ein Paket gebucht haben (`plan = 'free'`), bekommen
 * das Übergangs-Tier `ultimate`. Bewusst NICHT Teil von `migrate.ts` — ein Lauf bei jedem
 * Serverstart hübe manuell auf `free` zurückgesetzte Konten wieder an. Aufruf nur über das
 * CLI-Skript `src/cli/grandfatherPlans.ts`. Rückgabe: Anzahl geänderter Konten.
 */
export async function grandfatherPlans(seq: Sequelize, cutoff: Date): Promise<number> {
	const [changed] = await seq.models.User.update(
		{ plan: 'ultimate' },
		{ where: { plan: 'free', createdAt: { [Op.lt]: cutoff } } },
	);
	return changed;
}

/** Prüfabfrage vor dem Umlegen des Schalters: Anzahl Konten je Paket, 0 für Pakete ohne Konten. */
export async function planDistribution(seq: Sequelize): Promise<Record<Plan, number>> {
	const rows = (await seq.models.User.count({ group: ['plan'] })) as unknown as { plan: Plan; count: number }[];
	const distribution = Object.fromEntries(PLAN_VALUES.map((plan) => [plan, 0])) as Record<Plan, number>;
	for (const { plan, count } of rows) distribution[plan] = count;
	return distribution;
}
