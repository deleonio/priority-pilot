/**
 * Werkzeugkatalog v1 des MCP-Servers (#1353).
 *
 * Die Werkzeuge **spiegeln** die vorhandenen HTTP-Routen, statt deren Fachlogik ein zweites Mal zu
 * bauen: jeder Aufruf geht als Loopback-Request mit demselben `Authorization: Bearer …`-Header
 * gegen den eigenen Server. Damit gelten Validierung, Eigentümer-Filter (`ownerScope`),
 * Unteraufgaben-Guard, Score-Vergabe und Push-Versand unverändert — es gibt keinen zweiten
 * Fachlogik- oder Auth-Pfad (AK3, AK6). Der Katalog ist ab dem Merge eingefroren (AK8) und enthält
 * bewusst kein Admin-Werkzeug (AK7, Admin-Werkzeuge gehören nach #1338).
 */

/** Aufrufkontext eines Werkzeugs: Basis-URL des eigenen Servers + Bearer-Token des Aufrufers. */
export interface McpToolContext {
	/** z. B. `http://127.0.0.1:3000` — feste Loopback-Adresse mit dem Port, auf dem der Prozess lauscht. */
	baseUrl: string;
	/** Der `Authorization`-Header des MCP-Requests; wird unverändert weitergereicht. */
	authorization: string;
}

/** JSON-Schema eines Werkzeug-Eingangs (Teilmenge, die MCP-Clients auswerten). */
interface McpInputSchema {
	type: 'object';
	properties: Record<string, { type: string; description: string }>;
	required?: string[];
}

export interface McpTool {
	name: string;
	description: string;
	inputSchema: McpInputSchema;
	/**
	 * Gesetzt, wenn das Werkzeug Daten verändert (#1356). Der JSON-RPC-Rahmen weist einen solchen
	 * Aufruf mit einem Nur-lese-Token ab, bevor der Loopback überhaupt losgeht — so bekommt der
	 * Client einen lesbaren JSON-RPC-Fehler statt einer nackten HTTP-403 aus der Tiefe der Kette.
	 */
	write?: true;
	/** Führt das Werkzeug aus; wirft bei einem Fehler der gespiegelten Route. */
	run: (ctx: McpToolContext, args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Antwortkörper der gespiegelten Route lesen. Ist er kein JSON, hat nicht die Route geantwortet,
 * sondern etwas davor (Reverse Proxy, Express-Default-Handler mit HTML-Fehlerseite) — dann sagt
 * der Anfang des Texts, wer es war. Ein durchschlagender `SyntaxError` meldete dem Client
 * stattdessen nur „Unexpected token <".
 */
const parseJsonBody = (text: string, status: number): unknown => {
	if (text === '') {
		return null;
	}
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`Unerwartete Antwort (HTTP ${status}): ${text.slice(0, 200)}`);
	}
};

/**
 * Loopback-Aufruf gegen die eigene HTTP-API. Ein Fehlerstatus der Route (404 bei fremder Aufgabe,
 * 400 bei ungültiger Eingabe …) wird zu einer Exception, die der JSON-RPC-Rahmen in ein
 * `error`-Objekt übersetzt — die gespiegelte Route bleibt die einzige Entscheidungsinstanz.
 */
const callApi = async (
	ctx: McpToolContext,
	path: string,
	init: { method?: string; body?: unknown } = {},
): Promise<unknown> => {
	const res = await fetch(`${ctx.baseUrl}${path}`, {
		method: init.method ?? 'GET',
		headers: {
			Authorization: ctx.authorization,
			...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
		},
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
	});
	const text = await res.text();
	const payload = parseJsonBody(text, res.status);
	if (!res.ok) {
		// Der zentrale Fehlervertrag (express/http-error.ts) sendet `{ message }` — genau diesen Text
		// braucht der Client, um zu wissen, WELCHES Feld ihm um die Ohren flog. Der Statuscode reist
		// immer mit: er ordnet ein, ob die Eingabe (4xx) oder der Server (5xx) schuld ist.
		const message = (payload as { message?: string } | null)?.message ?? 'Anfrage fehlgeschlagen.';
		throw new Error(`${message} (HTTP ${res.status})`);
	}
	return payload;
};

/**
 * Ganzzahlige Pflicht-ID aus den Werkzeug-Argumenten. Der Schlüsselname steht im Fehlertext, damit
 * ein Aufruf mit mehreren IDs (`task_link`) sagt, welche davon fehlt. Werkzeugunabhängig — der
 * Fehlertext nennt nur den Schlüssel, keine Herkunft (die IDs von `task_link`/`group_members_list`
 * kommen aus verschiedenen List-Werkzeugen).
 */
const requireIntegerId = (args: Record<string, unknown>, key: string): number => {
	const id = args[key];
	if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
		throw new Error(`${key} muss eine Ganzzahl >= 1 sein.`);
	}
	return id;
};

/**
 * Umrechnungsfaktor des Aufwandsfelds: `estimatedEffort` zählt in **Tagen** zu je 14 h regulärer
 * Wachzeit und läuft von 0.1 bis 1 (openapi.yml, Schema `Task.estimatedEffort`).
 */
const HOURS_PER_EFFORT_DAY = 14;
const MIN_EFFORT = 0.1;
const MAX_EFFORT = 1;

/**
 * Rechnet eine Stundenschätzung in das Tage-Feld der API um. Das Kappen an den Rändern ist kein
 * Informationsverlust, sondern die Auflösung der Skala selbst: das Feld beginnt bei 0.1 Tagen
 * (~1,4 h) und endet bei einem Tag. Auf zwei Nachkommastellen gerundet (≙ ~8 min), damit in der
 * Aufwands-Spalte der Oberfläche keine 17-stellige Division steht.
 */
const effortFromHours = (hours: unknown): number => {
	if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
		throw new Error('estimatedEffortHours muss eine endliche Zahl > 0 sein.');
	}
	const days = Math.round((hours / HOURS_PER_EFFORT_DAY) * 100) / 100;
	return Math.min(MAX_EFFORT, Math.max(MIN_EFFORT, days));
};

/** Nur die gesetzten Felder übernehmen — die Route unterscheidet „fehlt" von „null". */
const pickTaskFields = (args: Record<string, unknown>): Record<string, unknown> => {
	const fields: Record<string, unknown> = {};
	for (const key of ['title', 'description', 'priority', 'estimatedEffort', 'deadline', 'categoryId', 'status']) {
		if (args[key] !== undefined) {
			fields[key] = args[key];
		}
	}
	if (args.estimatedEffortHours !== undefined) {
		// Beide Angaben zusammen sind ein Widerspruch, kein Komfort: raten hieße, den Aufwand still
		// falsch zu speichern.
		if (args.estimatedEffort !== undefined) {
			throw new Error('estimatedEffort und estimatedEffortHours schließen sich aus — bitte nur eines angeben.');
		}
		fields.estimatedEffort = effortFromHours(args.estimatedEffortHours);
	}
	return fields;
};

/** Kantengewicht aus den Argumenten; ohne Angabe der Standardwert der Route. */
const readWeight = (value: unknown): number => {
	if (value === undefined) {
		return 1;
	}
	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		throw new Error('weight muss eine endliche Zahl >= 0 sein.');
	}
	return value;
};

/**
 * Beide Enden einer Verknüpfung — ausschließlich über die numerische ID. Eine Auflösung über den
 * Titel gab es einmal; sie ist zurückgebaut, weil sie je Ende einen zusätzlichen Loopback-Aufruf
 * kostete und bei mehrdeutigen Titeln ohnehin abbrach. Die IDs holt sich der Client vorher über
 * `task_list`.
 */
const linkProperties = {
	taskId: { type: 'integer', description: 'ID der übergeordneten Aufgabe (aus task_list).' },
	dependsOnId: { type: 'integer', description: 'ID der Vorgänger-Aufgabe/Unteraufgabe (aus task_list).' },
} as const;

const taskFieldProperties = {
	title: { type: 'string', description: 'Titel der Aufgabe.' },
	description: { type: 'string', description: 'Beschreibung der Aufgabe.' },
	priority: { type: 'integer', description: 'Priorität: Ganzzahl 1 (niedrigste) bis 5 (höchste), Standard 3.' },
	estimatedEffort: {
		type: 'number',
		description:
			'Geschätzter Eigenaufwand in TAGEN: Zahl zwischen 0.1 und 1, Standard 0.5 (ein Tag ≙ 14 h ' +
			'reguläre Wachzeit). Wer in Stunden schätzt, nutzt stattdessen estimatedEffortHours.',
	},
	estimatedEffortHours: {
		type: 'number',
		description:
			'Geschätzter Eigenaufwand in Stunden; wird in das Tage-Feld umgerechnet (Stunden / 14) und ' +
			'an den Rändern der Skala auf 0.1–1 Tage begrenzt. Alternative zu estimatedEffort.',
	},
	deadline: { type: 'string', description: 'Fälligkeit als ISO-8601-Zeitpunkt.' },
	categoryId: { type: 'integer', description: 'ID einer eigenen Kategorie.' },
} as const;

/**
 * Der eingefrorene v1-Katalog. Reihenfolge = Reihenfolge in `tools/list`; der Snapshot-Test
 * (`tools.test.ts`, AK8) sortiert selbst.
 */
export const mcpTools: McpTool[] = [
	{
		name: 'task_list',
		description:
			'Listet die Aufgaben des Token-Besitzers samt ihrer IDs. Diese IDs benennen eine Aufgabe in allen ' +
			'übrigen Werkzeugen (task_update, task_complete, task_link, task_unlink, task_links).',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/tasks'),
	},
	{
		name: 'task_create',
		description: 'Legt eine neue Aufgabe für den Token-Besitzer an.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: { ...taskFieldProperties },
			required: ['title'],
		},
		run: (ctx, args) => callApi(ctx, '/tasks', { method: 'POST', body: pickTaskFields(args) }),
	},
	{
		name: 'task_update',
		description: 'Ändert Felder einer eigenen Aufgabe.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'integer', description: 'ID der zu ändernden Aufgabe (aus task_list).' },
				...taskFieldProperties,
				status: { type: 'string', description: 'Status: "Open", "In process" oder "Done".' },
			},
			required: ['id'],
		},
		run: (ctx, args) =>
			callApi(ctx, `/tasks/${requireIntegerId(args, 'id')}`, { method: 'PATCH', body: pickTaskFields(args) }),
	},
	{
		name: 'task_complete',
		description: 'Setzt eine eigene Aufgabe auf erledigt.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'integer', description: 'ID der zu erledigenden Aufgabe (aus task_list).' } },
			required: ['id'],
		},
		run: (ctx, args) =>
			callApi(ctx, `/tasks/${requireIntegerId(args, 'id')}`, { method: 'PATCH', body: { status: 'Done' } }),
	},
	{
		name: 'task_link',
		description:
			'Verknüpft eine Aufgabe mit einer Vorgänger-Aufgabe (Unteraufgabe) und setzt das Gewicht der Kante. ' +
			'Besteht die Verknüpfung schon, ändert der Aufruf nur ihr Gewicht. Beide Enden werden über ihre ' +
			'numerische ID angegeben — die IDs liefert task_list, also zuerst dort nachsehen.',
		write: true,
		inputSchema: {
			type: 'object',
			properties: {
				...linkProperties,
				weight: { type: 'number', description: 'Gewicht der Verknüpfung, Zahl >= 0. Ohne Angabe 1.' },
			},
			required: ['taskId', 'dependsOnId'],
		},
		run: (ctx, args) => {
			const weight = readWeight(args.weight);
			const taskId = requireIntegerId(args, 'taskId');
			const dependsOnId = requireIntegerId(args, 'dependsOnId');
			return callApi(ctx, `/tasks/${taskId}/dependencies`, {
				method: 'POST',
				body: { dependingTaskId: dependsOnId, weight },
			});
		},
	},
	{
		name: 'task_unlink',
		description:
			'Löst die Verknüpfung zwischen einer Aufgabe und einer ihrer Vorgänger-Aufgaben. ' +
			'Beide Enden werden über ihre numerische ID angegeben — die IDs liefert task_list.',
		write: true,
		inputSchema: { type: 'object', properties: { ...linkProperties }, required: ['taskId', 'dependsOnId'] },
		run: (ctx, args) => {
			const taskId = requireIntegerId(args, 'taskId');
			const dependsOnId = requireIntegerId(args, 'dependsOnId');
			return callApi(ctx, `/tasks/${taskId}/dependencies/${dependsOnId}`, { method: 'DELETE' });
		},
	},
	{
		name: 'task_links',
		description:
			'Listet die Verknüpfungen einer Aufgabe: ihre Vorgänger (Unteraufgaben) und die Aufgaben, die auf ihr ' +
			'aufbauen, je mit Gewicht. Die Aufgabe wird über ihre numerische ID angegeben (aus task_list). ' +
			'Erledigte Aufgaben fehlen, weil der gespiegelte Graph nur offene Aufgaben führt.',
		inputSchema: {
			type: 'object',
			properties: { taskId: linkProperties.taskId },
			required: ['taskId'],
		},
		run: async (ctx, args) => {
			const taskId = requireIntegerId(args, 'taskId');
			const graph = (await callApi(ctx, '/graph')) as {
				nodes: { id: number; title: string }[];
				edges: { from: number; to: number; weight: number }[];
			};
			const titleById = new Map(graph.nodes.map((node) => [node.id, node.title]));
			if (!titleById.has(taskId)) {
				throw new Error('Aufgabe nicht gefunden oder bereits erledigt.');
			}
			const neighbor = (id: number, weight: number) => ({ id, title: titleById.get(id), weight });
			return {
				id: taskId,
				title: titleById.get(taskId),
				// Kantenrichtung laut logics/graph.ts: `from` ist der Vorgänger, `to` die übergeordnete Aufgabe.
				dependsOn: graph.edges.filter((edge) => edge.to === taskId).map((edge) => neighbor(edge.from, edge.weight)),
				requiredBy: graph.edges.filter((edge) => edge.from === taskId).map((edge) => neighbor(edge.to, edge.weight)),
			};
		},
	},
	{
		name: 'next_task',
		description: 'Liefert die nächste wichtige Aufgabe des Token-Besitzers oder null.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/next'),
	},
	{
		name: 'pillar_list',
		description: 'Listet die Säulen des Token-Besitzers samt Gewichtung.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/pillars'),
	},
	{
		name: 'category_list',
		description: 'Listet die Kategorien des Token-Besitzers.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/categories'),
	},
	{
		name: 'group_list',
		description: 'Listet die Gruppen, in denen der Token-Besitzer Mitglied ist, samt Rolle und Mitgliederzahl.',
		inputSchema: { type: 'object', properties: {} },
		run: (ctx) => callApi(ctx, '/groups'),
	},
	{
		name: 'group_members_list',
		description: 'Listet die Mitglieder einer eigenen Gruppe. Fremde Gruppen liefern einen Fehler statt Daten.',
		inputSchema: {
			type: 'object',
			properties: { groupId: { type: 'integer', description: 'ID der Gruppe (aus group_list).' } },
			required: ['groupId'],
		},
		run: (ctx, args) => callApi(ctx, `/groups/${requireIntegerId(args, 'groupId')}/members`),
	},
];

export const findMcpTool = (name: unknown): McpTool | undefined => mcpTools.find((tool) => tool.name === name);
