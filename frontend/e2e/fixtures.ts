// Feste API-Fixtures für die Visual-Snapshot-Tests. Die Shapes folgen exakt den Schemas in
// `openapi.yml` (Task/Pillar/TaskTreeNode) bzw. der Verarbeitung in `frontend/src/api.ts`
// (z. B. `deadline` als ISO-String). Dadurch rendert die UI deterministisch in den Erfolgszustand.
//
// Die Typen werden direkt aus den `client`-Schema-Typen abgeleitet, damit Schema-Drift künftig von
// `tsc` erkannt wird. Die Fixtures beschreiben die **rohen** JSON-Antworten der API: Das `Task`-Schema
// typisiert `deadline` ohnehin als ISO-String, während das revivte UI-Modell aus `client` (`deadline`
// als `Date`) hier bewusst nicht verwendet wird.
import type { components } from 'client';

type Schemas = components['schemas'];

/** Roh-Task, wie ihn `GET /tasks`/`GET /next` liefern (Datumsfelder als ISO-String). */
export type RawTask = Schemas['Task'];

/** Säule, wie sie `GET /pillars` liefert. */
export type RawPillar = Schemas['Pillar'];

/** Baumknoten, wie ihn `GET /forest` liefert. */
export type RawTreeNode = Schemas['TaskTreeNode'];

/** Gemockte API-Antworten eines kompletten Lade-Vorgangs (alle vier Endpunkte). */
export interface ApiFixture {
	tasks: RawTask[];
	pillars: RawPillar[];
	forest: RawTreeNode[];
	next: RawTask | null;
}

const pillars: RawPillar[] = [
	{ id: 1, name: 'Körper', weight: 25 },
	{ id: 2, name: 'Beziehungen', weight: 20 },
	{ id: 3, name: 'Sinn', weight: 20 },
	{ id: 4, name: 'Mentale Gesundheit', weight: 20 },
	{ id: 5, name: 'Wirksamkeit', weight: 15 },
];

const tasks: RawTask[] = [
	{
		id: 1,
		title: 'Architektur-Konzept schreiben',
		status: 'In process',
		priority: 1,
		estimatedEffort: 2,
		actualEffort: 0.5,
		description: 'Grobentwurf der Modul-Grenzen.',
		deadline: '2026-07-01T00:00:00.000Z',
		pillars: [{ pillarId: 5, share: 100, confidence: 100 }],
	},
	{
		id: 2,
		title: 'Datenbank-Schema migrieren',
		status: 'Open',
		priority: 2,
		estimatedEffort: 1.5,
		actualEffort: null,
		description: null,
		deadline: '2026-07-10T00:00:00.000Z',
		pillars: [{ pillarId: 5, share: 100, confidence: 100 }],
	},
	{
		id: 3,
		title: 'Sport-Routine etablieren',
		status: 'Open',
		priority: 3,
		estimatedEffort: 0.5,
		actualEffort: null,
		description: 'Dreimal pro Woche.',
		deadline: null,
		pillars: [{ pillarId: 1, share: 100, confidence: 100 }],
	},
	{
		id: 4,
		title: 'Onboarding-Doku fertigstellen',
		status: 'Done',
		priority: 2,
		estimatedEffort: 1,
		actualEffort: 1.25,
		description: null,
		deadline: '2026-06-20T00:00:00.000Z',
		pillars: [{ pillarId: 3, share: 100, confidence: 100 }],
	},
];

const forest: RawTreeNode[] = [
	{
		id: 1,
		title: 'Architektur-Konzept schreiben',
		priority: 1,
		estimatedEffort: 2,
		totalEstimatedEffort: 3.5,
		value: 9.5,
		dependents: [
			{
				id: 2,
				title: 'Datenbank-Schema migrieren',
				priority: 2,
				estimatedEffort: 1.5,
				totalEstimatedEffort: 1.5,
				value: 4,
				dependents: [],
			},
		],
	},
	{
		id: 3,
		title: 'Sport-Routine etablieren',
		priority: 3,
		estimatedEffort: 0.5,
		totalEstimatedEffort: 0.5,
		value: 2.5,
		dependents: [],
	},
];

/** Vollständig befüllter Datenstand: mehrere Tasks, Säulen, ein Wald und eine nächste Aufgabe. */
export const filledFixture: ApiFixture = {
	tasks,
	pillars,
	forest,
	next: tasks[0],
};

/** Leerer Datenstand: keine Tasks, kein Wald, keine nächste Aufgabe (Säulen bleiben vorhanden). */
export const emptyFixture: ApiFixture = {
	tasks: [],
	pillars,
	forest: [],
	next: null,
};

/** Standard-Fehlertext eines Endpunkts (Shape entspricht `Error` aus `openapi.yml`). */
export const errorBody = { message: 'Interner Serverfehler (Datenbank nicht erreichbar).' };
