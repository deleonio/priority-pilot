/**
 * Freie Zeit (#1990): Lücken im heutigen Kalender finden und passende Aufgaben zuordnen.
 * Reine Logik ohne DB-Zugriff — die Route liefert Termine, `now` und die sortierten Aufgaben.
 */

export interface FreeSlot {
	start: Date;
	end: Date;
}

interface SlotEvent {
	start: Date;
	end: Date;
	allDay: boolean;
}

interface SlotTask {
	id: number;
	title: string;
	estimatedEffort: number;
}

const MINUTE_MS = 60_000;

/** Aufwand (0.1–1) linear in Minuten: 0.1 → 15, 1.0 → 120 (PO-Entscheidung #1990). */
export const effortToMinutes = (effort: number): number => Math.round(15 + ((effort - 0.1) / 0.9) * 105);

/**
 * Lücken von `now` bis `endHour`:00 desselben Tags (Serverzeit), mindestens `minMinutes` lang.
 * Ganztägige Termine blockieren nicht; überlappende Termine werden zusammengefasst.
 */
export const findFreeSlots = ({
	events,
	now,
	minMinutes,
	endHour = 22,
}: {
	events: SlotEvent[];
	now: Date;
	minMinutes: number;
	endHour?: number;
}): FreeSlot[] => {
	const windowEnd = new Date(now);
	windowEnd.setHours(endHour, 0, 0, 0);
	const busy = events
		.filter((event) => !event.allDay && event.end > now && event.start < windowEnd)
		.sort((a, b) => a.start.getTime() - b.start.getTime());

	const slots: FreeSlot[] = [];
	let cursor = now.getTime();
	const addSlot = (until: number): void => {
		if (until - cursor >= minMinutes * MINUTE_MS) {
			slots.push({ start: new Date(cursor), end: new Date(until) });
		}
	};
	for (const event of busy) {
		addSlot(event.start.getTime());
		cursor = Math.max(cursor, event.end.getTime());
	}
	addSlot(windowEnd.getTime());
	return slots;
};

/**
 * Ordnet die Aufgaben (bereits in `find.ts`-Score-Reihenfolge) den Lücken zu: nur was in die Lücke
 * passt, höchstens `maxPerSlot` je Lücke, jede Aufgabe nur in der ersten passenden Lücke.
 * Lücken ohne Aufgabe entfallen.
 */
export const fitTasksToSlots = (
	slots: FreeSlot[],
	tasks: SlotTask[],
	maxPerSlot = 3,
): (FreeSlot & { tasks: { id: number; title: string }[] })[] => {
	const used = new Set<number>();
	return slots
		.map((slot) => {
			const minutes = (slot.end.getTime() - slot.start.getTime()) / MINUTE_MS;
			const fitting = tasks
				.filter((task) => !used.has(task.id) && effortToMinutes(task.estimatedEffort) <= minutes)
				.slice(0, maxPerSlot);
			for (const task of fitting) used.add(task.id);
			return { ...slot, tasks: fitting.map(({ id, title }) => ({ id, title })) };
		})
		.filter((slot) => slot.tasks.length > 0);
};
