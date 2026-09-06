import type { Pillar } from 'client';

/**
 * Rechenkern der „Balance-Priorisierung" (#1220, `docs/spec/issue-1220.md`) — Client-Übertragung
 * der Defizit-Mathematik aus `server/src/logics/find.ts`. Bewusst — wie `heartBalance.ts` und
 * `pillar.ts` — als reine Funktionen ohne React, damit die Mathematik ohne DOM prüfbar bleibt.
 *
 * **Maß:** Ein offener Task ist umso dringender, je mehr seiner Säulen-Beiträge in Säulen fallen,
 * die gegenüber ihrem Soll unterversorgt sind. Der Score eines Tasks ist das Defizit-gewichtete
 * Mittel seiner Anteile und liegt in [0, 1]; die virtuelle Priorität hebt ihn auf die gewohnte
 * P-Skala (5 = am dringendsten), ohne die Server-`priority` je anzufassen.
 */

/** Task-Sicht der Rechnung: nur was die Balance-Berechnung braucht (Säulen-Beitrag optional, s. `sortTasksByBalance`). */
export interface BalanceTask {
	id: number;
	priority: number;
	/** Säulen-Beiträge (Anteil 0–100); ohne Beitrag ist der Score des Tasks neutral 0. */
	pillars?: ReadonlyArray<{ pillarId: number; share: number }>;
}

/** Ergebnis je Task: Balance-Score (0–1) und die daraus abgeleitete virtuelle Priorität (1–5). */
export interface BalancePriority {
	balanceScore: number;
	virtualPriority: number;
	/**
	 * Original-`priority` zum Zeitpunkt der Berechnung. Gehört in den Stand, weil sie den
	 * Gleichstand bricht (`sortTasksByBalance`): Läse die Sortierung sie live, sortierte sich die
	 * eingefrorene Liste bei score-gleichen Tasks um, sobald jemand eine Prio ändert. Bewusst
	 * nicht `priority` genannt — daneben steht `virtualPriority`, die beiden dürfen nicht
	 * verwechselbar sein.
	 */
	originalPriority: number;
}

/**
 * Berechnet die virtuellen Balance-Prioritäten für offene Tasks aus dem übergebenen Datenstand:
 * `pillars` liefert das Soll (`weight`), `doneEffortByPillar` das Ist (erledigter
 * `estimatedEffort` je Säule, anteilig nach `share` — Quelle `buildPillarSummaries` wie im
 * Dashboard). Die Funktion ist rein; ob das Ergebnis mitläuft oder einfriert (AK2), entscheidet
 * allein der Aufrufer daran, wann er sie aufruft.
 *
 * Randfälle bewusst wie `heartBalance.ts` festgelegt:
 * - **Kein erledigter Aufwand** → jede Säule hat ihr volles Defizit.
 * - **Gesamtgewicht 0** (kein Soll gepflegt) → Gleichverteilung als Soll.
 * - **Säule ohne Soll** → kein Defizit; dort eingezahlte Anteile zählen nicht.
 */
export const buildBalancePriorities = (
	pillars: Pillar[],
	doneEffortByPillar: ReadonlyMap<number, number>,
	tasks: ReadonlyArray<BalanceTask>,
): Map<number, BalancePriority> => {
	const totalDone = pillars.reduce((sum, pillar) => sum + (doneEffortByPillar.get(pillar.id) ?? 0), 0);
	const totalWeight = pillars.reduce((sum, pillar) => sum + pillar.weight, 0);

	// Defizit je Säule: Soll-Antil minus Ist-Anteil, gemessen am Soll (nDefizit aus find.ts).
	const deficits = new Map<number, number>();
	for (const pillar of pillars) {
		const targetShare = totalWeight > 0 ? pillar.weight / totalWeight : 1 / pillars.length;
		const actualShare = totalDone > 0 ? (doneEffortByPillar.get(pillar.id) ?? 0) / totalDone : 0;
		deficits.set(pillar.id, targetShare > 0 ? Math.max(0, targetShare - actualShare) / targetShare : 0);
	}

	const priorities = new Map<number, BalancePriority>();
	for (const task of tasks) {
		const balanceScore = (task.pillars ?? []).reduce(
			(sum, contribution) => sum + (contribution.share / 100) * (deficits.get(contribution.pillarId) ?? 0),
			0,
		);
		priorities.set(task.id, {
			balanceScore,
			virtualPriority: 1 + Math.round(balanceScore * 4),
			originalPriority: task.priority,
		});
	}
	return priorities;
};

/**
 * Vergleicht zwei Balance-Stände auf inhaltliche Gleichheit — gleiche Task-IDs, gleicher Score und
 * gleiche virtuelle Priorität. Damit erkennt die Oberfläche, ob der eingefrorene Stand von der
 * aktuellen Datenlage abweicht, und kann ihn als veraltet ausweisen; ohne dieses Signal wäre für
 * den Nutzer nicht erkennbar, wann eine Neuberechnung überhaupt etwas ändert.
 *
 * `null` ist kein Stand und damit nie gleich einem vorhandenen.
 */
export const balancePrioritiesEqual = (
	a: ReadonlyMap<number, BalancePriority> | null,
	b: ReadonlyMap<number, BalancePriority> | null,
): boolean => {
	if (a === null || b === null) return a === b;
	if (a.size !== b.size) return false;
	for (const [taskId, priority] of a) {
		const other = b.get(taskId);
		if (other === undefined) return false;
		if (other.balanceScore !== priority.balanceScore) return false;
		if (other.virtualPriority !== priority.virtualPriority) return false;
		// Auch die Original-Prio: Sie bricht den Gleichstand, eine Änderung verschiebt die
		// Reihenfolge also selbst dann, wenn kein Score sich rührt.
		if (other.originalPriority !== priority.originalPriority) return false;
	}
	return true;
};

/**
 * Sortiert Tasks nach Balance: Score absteigend, bei Gleichstand Original-`priority` absteigend,
 * sonst stabil (keine Gleichstands-Umsortierung). Das Eingabe-Array wird nicht mutiert.
 *
 * **Beide** Kriterien kommen aus dem Snapshot, nicht aus den übergebenen Task-Objekten — sonst
 * bliebe der Gleichstand live und die eingefrorene Liste sortierte sich um, sobald jemand die
 * Prio eines score-gleichen Tasks ändert. Nur wo ein Task im Stand fehlt, zählt sein eigener
 * Wert; `pillars` ist im `BalanceTask` aus demselben Grund optional (Wald-Knoten ohne Beiträge).
 */
export const sortTasksByBalance = <T extends BalanceTask>(
	tasks: readonly T[],
	priorities: ReadonlyMap<number, BalancePriority>,
): T[] =>
	[...tasks].sort((a, b) => {
		const scoreA = priorities.get(a.id)?.balanceScore ?? 0;
		const scoreB = priorities.get(b.id)?.balanceScore ?? 0;
		if (scoreA !== scoreB) return scoreB - scoreA;
		const priorityA = priorities.get(a.id)?.originalPriority ?? a.priority;
		const priorityB = priorities.get(b.id)?.originalPriority ?? b.priority;
		return priorityB - priorityA;
	});

/** Label der virtuellen Priorität — Tilde-Präfix hält sie vom echten `P{n}`-Badge unterscheidbar (KI-UX). */
export const virtualPriorityLabel = (virtualPriority: number): string => `~P${virtualPriority}`;
