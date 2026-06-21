import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
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
});
