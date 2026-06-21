import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, PillarFeedback } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';
import {
	classifyPillarsWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type ClassifyPillarsInput,
	type PillarClassifier,
	type PillarSuggestion,
} from '../llm/mistral.js';

/** Legt die fünf Standard-Säulen an und gibt sie (nach id sortiert) zurück. */
const seedPillars = async (): Promise<Pillar[]> => {
	const names = ['Körper', 'Beziehungen', 'Sinn', 'Mentale Gesundheit', 'Wirksamkeit'];
	await Pillar.bulkCreate(names.map((name) => ({ name, weight: 20 })));
	return Pillar.findAll({ order: [['id', 'ASC']] });
};

const post = (baseUrl: string, body: unknown) =>
	fetch(`${baseUrl}/tasks/suggest-pillars`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

describe('POST /tasks/suggest-pillars', () => {
	let server: TestServer;
	let lastInput: ClassifyPillarsInput | undefined;
	let classifierImpl: PillarClassifier;

	// Ein einziger Server, dessen Klassifikator pro Test über `classifierImpl` umgeschaltet wird.
	const classifier: PillarClassifier = (input) => {
		lastInput = input;
		return classifierImpl(input);
	};

	beforeEach(async () => {
		await resetDb();
		lastInput = undefined;
		classifierImpl = async () => [];
		if (!server) {
			server = await startTestServer({ pillarClassifier: classifier });
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('200 liefert die Klassifikation und übergibt die existierenden Säulen', async () => {
		const pillars = await seedPillars();
		const expected: PillarSuggestion[] = [
			{ pillarId: pillars[0].id, confidence: 90 },
			{ pillarId: pillars[4].id, confidence: 40 },
		];
		classifierImpl = async () => expected;

		const res = await post(server.baseUrl, { title: 'Joggen gehen', description: 'morgens 5 km' });
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { suggestions: expected });

		// Der reale Säulen-Satz wird dem Klassifikator als gültige IDs/Namen übergeben.
		assert.equal(lastInput?.title, 'Joggen gehen');
		assert.equal(lastInput?.description, 'morgens 5 km');
		assert.deepEqual(
			lastInput?.pillars.map((pillar) => pillar.id),
			pillars.map((pillar) => pillar.id),
		);
	});

	it('übergibt die jüngsten Feedback-Korrekturen als gelernte Beispiele an den Klassifikator', async () => {
		const pillars = await seedPillars();
		// Zwei gespeicherte Korrekturen — die jüngste zuerst erwartet (createdAt DESC).
		await PillarFeedback.create({
			title: 'Meditation am Morgen',
			description: '10 Minuten Achtsamkeit',
			pillars: [{ pillarId: pillars[3].id, confidence: 55 }],
		});
		await PillarFeedback.create({
			title: 'Halbmarathon vorbereiten',
			description: null,
			pillars: [{ pillarId: pillars[0].id, confidence: 95 }],
		});

		await post(server.baseUrl, { title: 'Irgendein Task' });

		const examples = lastInput?.examples ?? [];
		assert.equal(examples.length, 2);
		// Beide Korrekturen werden (egal in welcher Reihenfolge) durchgereicht.
		const titles = examples.map((example) => example.title).sort();
		assert.deepEqual(titles, ['Halbmarathon vorbereiten', 'Meditation am Morgen']);
		const marathon = examples.find((example) => example.title === 'Halbmarathon vorbereiten');
		assert.deepEqual(marathon?.pillars, [{ pillarId: pillars[0].id, confidence: 95 }]);
	});

	it('400 wenn title fehlt oder leer ist', async () => {
		await seedPillars();
		assert.equal((await post(server.baseUrl, {})).status, 400);
		assert.equal((await post(server.baseUrl, { title: '   ' })).status, 400);
	});

	it('400 wenn Body kein Objekt ist', async () => {
		await seedPillars();
		const res = await fetch(`${server.baseUrl}/tasks/suggest-pillars`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(null),
		});
		assert.equal(res.status, 400);
	});

	it('400 wenn description kein String ist', async () => {
		await seedPillars();
		const res = await post(server.baseUrl, { title: 'X', description: 5 });
		assert.equal(res.status, 400);
	});

	it('503 wenn keine Säulen konfiguriert sind', async () => {
		const res = await post(server.baseUrl, { title: 'Irgendwas' });
		assert.equal(res.status, 503);
	});

	it('503 wenn der API-Key fehlt (MissingApiKeyError)', async () => {
		await seedPillars();
		classifierImpl = async () => {
			throw new MissingApiKeyError();
		};
		const res = await post(server.baseUrl, { title: 'X' });
		assert.equal(res.status, 503);
	});

	it('502 bei Upstream-/Format-Fehler (MistralRequestError)', async () => {
		await seedPillars();
		classifierImpl = async () => {
			throw new MistralRequestError('kaputt');
		};
		const res = await post(server.baseUrl, { title: 'X' });
		assert.equal(res.status, 502);
	});

	it('500 bei unerwartetem Fehler im Klassifikator', async () => {
		await seedPillars();
		classifierImpl = async () => {
			throw new Error('boom');
		};
		const res = await post(server.baseUrl, { title: 'X' });
		assert.equal(res.status, 500);
	});
});

describe('POST /tasks/suggest-pillars/feedback', () => {
	let server: TestServer;

	const postFeedback = (body: unknown) =>
		fetch(`${server.baseUrl}/tasks/suggest-pillars/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	beforeEach(async () => {
		await resetDb();
		if (!server) {
			server = await startTestServer({ pillarClassifier: async () => [] });
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
		await closeDb();
	});

	it('201 speichert eine Korrektur und legt eine Zeile in pillar_feedback an', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'Joggen gehen',
			description: 'morgens 5 km',
			pillars: [{ pillarId: pillars[0].id, confidence: 95 }],
		});
		assert.equal(res.status, 201);
		const body = (await res.json()) as { id: number };
		assert.equal(typeof body.id, 'number');

		const stored = await PillarFeedback.findByPk(body.id);
		assert.equal(stored?.title, 'Joggen gehen');
		assert.deepEqual(stored?.pillars, [{ pillarId: pillars[0].id, confidence: 95 }]);
	});

	it('201 akzeptiert eine leere Säulen-Liste (Nutzer verwirft alle Vorschläge)', async () => {
		await seedPillars();
		const res = await postFeedback({ title: 'Ohne Säule', pillars: [] });
		assert.equal(res.status, 201);
	});

	it('400 wenn title fehlt', async () => {
		await seedPillars();
		assert.equal((await postFeedback({ pillars: [] })).status, 400);
	});

	it('400 wenn pillars keine Liste ist', async () => {
		await seedPillars();
		assert.equal((await postFeedback({ title: 'X', pillars: 'nope' })).status, 400);
	});

	it('400 bei unbekannter pillarId', async () => {
		await seedPillars();
		const res = await postFeedback({ title: 'X', pillars: [{ pillarId: 9999, confidence: 50 }] });
		assert.equal(res.status, 400);
	});

	it('400 bei Konfidenz außerhalb [0,100]', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({ title: 'X', pillars: [{ pillarId: pillars[0].id, confidence: 150 }] });
		assert.equal(res.status, 400);
	});

	it('400 bei doppelter pillarId', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'X',
			pillars: [
				{ pillarId: pillars[0].id, confidence: 50 },
				{ pillarId: pillars[0].id, confidence: 60 },
			],
		});
		assert.equal(res.status, 400);
	});
});

describe('classifyPillarsWithMistral (Unit, gemockter fetch)', () => {
	const pillars = [
		{ id: 1, name: 'Körper' },
		{ id: 2, name: 'Beziehungen' },
		{ id: 3, name: 'Sinn' },
		{ id: 4, name: 'Mentale Gesundheit' },
		{ id: 5, name: 'Wirksamkeit' },
	];
	const input: ClassifyPillarsInput = { title: 'Test', pillars };

	const originalFetch = globalThis.fetch;
	const originalKey = process.env.MISTRAL_API_KEY;

	// Hilfsfunktion: stellt eine Chat-Completion-Antwort mit gegebenem JSON-Content bereit.
	const stubFetch = (content: string, ok = true, status = 200): void => {
		globalThis.fetch = (async () =>
			new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
				status,
				headers: { 'Content-Type': 'application/json' },
			})) as typeof fetch;
		if (!ok) {
			globalThis.fetch = (async () => new Response('error', { status })) as typeof fetch;
		}
	};

	after(() => {
		globalThis.fetch = originalFetch;
		if (originalKey === undefined) {
			delete process.env.MISTRAL_API_KEY;
		} else {
			process.env.MISTRAL_API_KEY = originalKey;
		}
	});

	it('wirft MissingApiKeyError ohne API-Key', async () => {
		delete process.env.MISTRAL_API_KEY;
		await assert.rejects(() => classifyPillarsWithMistral(input), MissingApiKeyError);
	});

	it('parst gültige Antwort, filtert unbekannte IDs und sortiert nach pillarId', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch(
			JSON.stringify({
				pillars: [
					{ pillarId: 5, confidence: 80 },
					{ pillarId: 1, confidence: 95 },
					{ pillarId: 999, confidence: 100 },
				],
			}),
		);
		const result = await classifyPillarsWithMistral(input);
		assert.deepEqual(result, [
			{ pillarId: 1, confidence: 95 },
			{ pillarId: 5, confidence: 80 },
		]);
	});

	it('deckelt die Konfidenz der schwachen Säulen (Sinn/Mentale Gesundheit) auf 60', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch(
			JSON.stringify({
				pillars: [
					{ pillarId: 3, confidence: 100 },
					{ pillarId: 4, confidence: 90 },
				],
			}),
		);
		const result = await classifyPillarsWithMistral(input);
		assert.deepEqual(result, [
			{ pillarId: 3, confidence: 60 },
			{ pillarId: 4, confidence: 60 },
		]);
	});

	it('clamped Konfidenz auf [0,100] und rundet', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch(JSON.stringify({ pillars: [{ pillarId: 1, confidence: 150.6 }] }));
		const result = await classifyPillarsWithMistral(input);
		assert.deepEqual(result, [{ pillarId: 1, confidence: 100 }]);
	});

	it('wirft MistralRequestError bei ungültigem JSON-Content', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch('das ist kein json');
		await assert.rejects(() => classifyPillarsWithMistral(input), MistralRequestError);
	});

	it('wirft MistralRequestError bei HTTP-Fehlerstatus', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch('', false, 429);
		await assert.rejects(() => classifyPillarsWithMistral(input), MistralRequestError);
	});

	it('hängt gelernte Feedback-Beispiele als user/assistant-Paare an den Prompt (nur gültige Säulen)', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		let sentBody: { messages: { role: string; content: string }[] } | undefined;
		globalThis.fetch = (async (_url: string, init: { body: string }) => {
			sentBody = JSON.parse(init.body);
			return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ pillars: [] }) } }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as unknown as typeof fetch;

		await classifyPillarsWithMistral({
			...input,
			examples: [
				{
					title: 'Yoga am Abend',
					pillars: [
						{ pillarId: 4, confidence: 50 },
						{ pillarId: 999, confidence: 80 }, // unbekannt → verworfen
					],
				},
				{ title: 'Nur Müll', pillars: [{ pillarId: 999, confidence: 80 }] }, // bleibt leer → komplett weg
			],
		});

		const messages = sentBody?.messages ?? [];
		const yogaUser = messages.find((message) => message.role === 'user' && message.content.includes('Yoga am Abend'));
		assert.ok(yogaUser, 'das gültige Beispiel landet als user-Message im Prompt');
		const expectedAssistant = JSON.stringify({ pillars: [{ pillarId: 4, confidence: 50 }] });
		const assistantWithPillar4 = messages.find(
			(message) => message.role === 'assistant' && message.content === expectedAssistant,
		);
		assert.ok(assistantWithPillar4, 'die assistant-Antwort enthält nur die gültige Säule');
		assert.ok(
			!messages.some((message) => message.content.includes('Nur Müll')),
			'ein Beispiel ohne gültige Säule wird gar nicht angehängt',
		);
	});
});
