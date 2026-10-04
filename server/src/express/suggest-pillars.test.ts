import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar, PillarFeedback } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer, setTestLlmProvider } from '../test/helpers.js';

// Die DB ist ein Singleton, das von allen describe-Blöcken geteilt wird. Daher genau
// einmal am Dateiende schließen — nicht je describe, sonst reißt das erste after()
// die Verbindung für die folgenden Suites ab ("connection manager was closed").
after(closeDb);
import {
	classifyPillarsWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	weakSignalPillarIds,
	type ClassifyPillarsInput,
	type PillarClassifier,
	type PillarSuggestion,
} from '../llm/llm.js';

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

	// AK5 (#2076, Spec docs/spec/issue-2076.md): Korrekturen mit Anteil lernen den Anteil, alte
	// Korrekturen ohne Anteil bleiben gültige Beispiele.
	it('übergibt gelernte Korrekturen mit Anteil — alte ohne Anteil bleiben gültig (#2076, AK5)', async () => {
		const pillars = await seedPillars();
		const neuePillars = [{ pillarId: pillars[0].id, confidence: 95, share: 40 }];
		await PillarFeedback.create({ title: 'Neue Korrektur mit Anteil', description: null, pillars: neuePillars });
		await PillarFeedback.create({
			title: 'Alte Korrektur ohne Anteil',
			description: null,
			pillars: [{ pillarId: pillars[1].id, confidence: 80 }],
		});

		classifierImpl = async () => [{ pillarId: pillars[0].id, confidence: 50 }];
		const res = await post(server.baseUrl, { title: 'Irgendein Task' });
		assert.equal(res.status, 200);

		const examples = lastInput?.examples ?? [];
		assert.equal(examples.length, 2, 'beide Korrekturen bleiben nutzbar');
		const neu = examples.find((example) => example.title === 'Neue Korrektur mit Anteil');
		const alt = examples.find((example) => example.title === 'Alte Korrektur ohne Anteil');
		assert.equal((neu?.pillars[0] as { share?: number }).share, 40, 'Anteil fließt mit');
		assert.equal(alt?.pillars[0].confidence, 80);
		assert.equal((alt?.pillars[0] as { share?: number }).share, undefined, 'Altzeile ohne Anteil');
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

	it('leere Korrektur-Samples verdrängen nicht die nützlichen im Beispiel-Fenster', async () => {
		const pillars = await seedPillars();
		// Eine nützliche Korrektur (älter) …
		await PillarFeedback.create({
			title: 'Nützliche Korrektur',
			description: null,
			pillars: [{ pillarId: pillars[0].id, confidence: 90 }],
		});
		// … gefolgt von vielen jüngeren leeren Samples (alle Vorschläge verworfen). Würden diese
		// das 10er-Fenster belegen, käme die nützliche Korrektur nie beim Klassifikator an.
		for (let i = 0; i < 15; i++) {
			await PillarFeedback.create({ title: `Verworfen ${i}`, description: null, pillars: [] });
		}

		await post(server.baseUrl, { title: 'Irgendein Task' });

		const examples = lastInput?.examples ?? [];
		assert.equal(examples.length, 1);
		assert.equal(examples[0]?.title, 'Nützliche Korrektur');
	});

	it('degradiert graceful: ein Lesefehler der Feedback-Tabelle liefert trotzdem 200 (ohne Beispiele)', async () => {
		const pillars = await seedPillars();
		const expected: PillarSuggestion[] = [{ pillarId: pillars[0].id, confidence: 80 }];
		classifierImpl = async () => expected;

		// Best-Effort: das Laden der optionalen Korrektur-Tabelle schlägt fehl …
		const originalFindAll = PillarFeedback.findAll;
		PillarFeedback.findAll = (async () => {
			throw new Error('pillar_feedback kaputt');
		}) as typeof PillarFeedback.findAll;
		try {
			const res = await post(server.baseUrl, { title: 'Joggen gehen' });
			// … die Kern-Klassifikation bleibt funktionsfähig (kein HTTP 500).
			assert.equal(res.status, 200);
			assert.deepEqual(await res.json(), { suggestions: expected });
			// … und der Klassifikator erhält schlicht keine gelernten Beispiele.
			assert.deepEqual(lastInput?.examples, []);
		} finally {
			PillarFeedback.findAll = originalFindAll;
		}
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
			throw new MissingApiKeyError('Mistral: API-Key fehlt (MISTRAL_API_KEY) — Provider in den Einstellungen prüfen.');
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

	// AK3 (#2076, Spec docs/spec/issue-2076.md): Fokus- und Misch-Aufgabe führen über den
	// gestubbten Klassifikator zu unterschiedlich verteilten Vorschlägen — die Response trägt
	// je Säule einen ganzzahligen Anteil.
	it('liefert für Fokus- und Misch-Aufgabe unterschiedlich verteilte Vorschläge (#2076, AK3)', async () => {
		await seedPillars();
		const verteilungen: Record<string, number[]> = { Fokus: [80, 5, 5, 5, 5], Misch: [30, 25, 20, 15, 10] };
		classifierImpl = async (input) =>
			input.pillars.map((pillar, index) => ({
				pillarId: pillar.id,
				confidence: 50,
				share: verteilungen[input.title][index],
			})) as PillarSuggestion[];

		const focusRes = await post(server.baseUrl, { title: 'Fokus' });
		assert.equal(focusRes.status, 200);
		const focus = (await focusRes.json()) as { suggestions: { pillarId: number; share?: number }[] };
		const mixedRes = await post(server.baseUrl, { title: 'Misch' });
		assert.equal(mixedRes.status, 200);
		const mixed = (await mixedRes.json()) as { suggestions: { pillarId: number; share?: number }[] };

		for (const suggestions of [focus.suggestions, mixed.suggestions]) {
			assert.equal(suggestions.length, 5, 'Verteilung über alle Säulen');
			const shares = suggestions.map((entry) => entry.share ?? Number.NaN);
			assert.ok(
				shares.every((share) => Number.isInteger(share) && share >= 5 && share <= 80),
				`Anteile ganzzahlig 5–80: ${JSON.stringify(shares)}`,
			);
		}
		assert.notDeepEqual(
			focus.suggestions.map((entry) => entry.share),
			mixed.suggestions.map((entry) => entry.share),
		);
		assert.deepEqual(
			focus.suggestions.map((entry) => entry.share),
			verteilungen.Fokus,
			'die Fokus-Verteilung kommt unverändert durch',
		);
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

	// AK5 (#2076, Spec docs/spec/issue-2076.md): optionale Anteile — additiv zur Konfidenz.
	it('201 akzeptiert zusätzlich einen Anteil je Säule und speichert ihn (#2076, AK5)', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'Joggen gehen',
			pillars: [{ pillarId: pillars[0].id, confidence: 95, share: 40 }],
		});
		assert.equal(res.status, 201);
		const body = (await res.json()) as { id: number };
		const stored = await PillarFeedback.findByPk(body.id);
		assert.deepEqual(stored?.pillars, [{ pillarId: pillars[0].id, confidence: 95, share: 40 }]);
	});

	it('400 wenn der Anteil keine Zahl ist (#2076, AK5)', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'X',
			pillars: [{ pillarId: pillars[0].id, confidence: 50, share: 'viel' }],
		});
		assert.equal(res.status, 400);
	});

	// AK1 (#2152, Spec docs/spec/issue-2152.md): Anteils-Grenzen 5–80 auch im Feedback —
	// außerhalb → 400, Grenzen inklusive gültig (konsistent mit openapi.yml und validatePillars).
	it('400 wenn der Anteil unterhalb der Untergrenze liegt (share 4) (#2152, AK1)', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'X',
			pillars: [{ pillarId: pillars[0].id, confidence: 50, share: 4 }],
		});
		assert.equal(res.status, 400);
	});

	it('400 wenn der Anteil oberhalb der Obergrenze liegt (share 81) (#2152, AK1)', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'X',
			pillars: [{ pillarId: pillars[0].id, confidence: 50, share: 81 }],
		});
		assert.equal(res.status, 400);
	});

	it('201 an der Untergrenze (share 5) (#2152, AK1)', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'X',
			pillars: [{ pillarId: pillars[0].id, confidence: 50, share: 5 }],
		});
		assert.equal(res.status, 201);
	});

	it('201 an der Obergrenze (share 80) (#2152, AK1)', async () => {
		const pillars = await seedPillars();
		const res = await postFeedback({
			title: 'X',
			pillars: [{ pillarId: pillars[0].id, confidence: 50, share: 80 }],
		});
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
	});

	it('wirft MissingApiKeyError ohne API-Key', async () => {
		await setTestLlmProvider(false);
		await assert.rejects(() => classifyPillarsWithMistral(input), MissingApiKeyError);
	});

	// TEST-PFLEGE #2076 (Spec docs/spec/issue-2076.md, AK2): Teilmengen-Antworten werden seit #2076
	// über ALLE Säulen vervollständigt — die alte Erwartung (nur die vorgeschlagenen Säulen zurück)
	// widersprach AK2. Unbekannte IDs bleiben gefiltert, sortiert nach pillarId.
	it('parst gültige Antwort, vervollständigt die Teilmenge über alle Säulen und filtert unbekannte IDs', async () => {
		await setTestLlmProvider(true);
		stubFetch(
			JSON.stringify({
				pillars: [
					{ pillarId: 5, confidence: 80, share: 10 },
					{ pillarId: 1, confidence: 95, share: 40 },
					{ pillarId: 999, confidence: 100, share: 50 },
				],
			}),
		);
		const result = (await classifyPillarsWithMistral(input)) as {
			pillarId: number;
			confidence: number;
			share?: number;
		}[];
		assert.deepEqual(
			result.map((entry) => entry.pillarId),
			[1, 2, 3, 4, 5],
		);
		assert.equal(result.find((entry) => entry.pillarId === 1)?.confidence, 95);
		assert.equal(result.find((entry) => entry.pillarId === 5)?.confidence, 80);
		const shares = result.map((entry) => entry.share ?? Number.NaN);
		assert.equal(
			shares.reduce((acc, share) => acc + share, 0),
			100,
		);
		assert.ok(
			shares.every((share) => Number.isInteger(share) && share >= 5 && share <= 80),
			JSON.stringify(shares),
		);
	});

	it('deckelt die Konfidenz der schwachen Säulen (Sinn/Mentale Gesundheit) auf 60', async () => {
		await setTestLlmProvider(true);
		stubFetch(
			JSON.stringify({
				pillars: [
					{ pillarId: 3, confidence: 100 },
					{ pillarId: 4, confidence: 90 },
				],
			}),
		);
		const result = (await classifyPillarsWithMistral(input)) as { pillarId: number; confidence: number }[];
		// TEST-PFLEGE #2076: der Server vervollständigt Teilmengen über ALLE Säulen (AK2) — die Deckelung
		// der schwachen Säulen bleibt, die übrigen Säulen kommen mit Konfidenz 0 dazu.
		assert.equal(result.length, 5, 'AK2 (#2076): die Verteilung deckt alle Säulen ab');
		assert.equal(result.find((entry) => entry.pillarId === 3)?.confidence, 60);
		assert.equal(result.find((entry) => entry.pillarId === 4)?.confidence, 60);
	});

	it('clamped Konfidenz auf [0,100] und rundet', async () => {
		await setTestLlmProvider(true);
		stubFetch(JSON.stringify({ pillars: [{ pillarId: 1, confidence: 150.6 }] }));
		const result = (await classifyPillarsWithMistral(input)) as { pillarId: number; confidence: number }[];
		// TEST-PFLEGE #2076: der Server vervollständigt Teilmengen über ALLE Säulen (AK2); das Clamping
		// selbst bleibt unverändert geprüft.
		assert.equal(result.length, 5, 'AK2 (#2076): die Verteilung deckt alle Säulen ab');
		assert.equal(result.find((entry) => entry.pillarId === 1)?.confidence, 100);
	});

	it('wirft MistralRequestError bei ungültigem JSON-Content', async () => {
		await setTestLlmProvider(true);
		stubFetch('das ist kein json');
		await assert.rejects(() => classifyPillarsWithMistral(input), MistralRequestError);
	});

	it('wirft MistralRequestError bei HTTP-Fehlerstatus', async () => {
		await setTestLlmProvider(true);
		stubFetch('', false, 429);
		await assert.rejects(() => classifyPillarsWithMistral(input), MistralRequestError);
	});

	it('hängt gelernte Feedback-Beispiele als user/assistant-Paare an den Prompt (nur gültige Säulen)', async () => {
		await setTestLlmProvider(true);
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

	it('deckelt die Konfidenz der schwachen Säulen auch in gelernten Feedback-Beispielen auf 60', async () => {
		await setTestLlmProvider(true);
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
					title: 'Sinn bestätigt',
					pillars: [
						{ pillarId: 3, confidence: 100 }, // Sinn → auf 60 gedeckelt
						{ pillarId: 4, confidence: 90 }, // Mentale Gesundheit → auf 60 gedeckelt
						{ pillarId: 1, confidence: 95 }, // Körper → unverändert
					],
				},
			],
		});

		const messages = sentBody?.messages ?? [];
		const expectedAssistant = JSON.stringify({
			pillars: [
				{ pillarId: 3, confidence: 60 },
				{ pillarId: 4, confidence: 60 },
				{ pillarId: 1, confidence: 95 },
			],
		});
		assert.ok(
			messages.some((message) => message.role === 'assistant' && message.content === expectedAssistant),
			'die gelernte assistant-Antwort deckelt Sinn/Mentale Gesundheit auf 60, lässt Körper unverändert',
		);
	});

	it('AK4 (#424): Feedback-Beispiele mit gelöschten pillarIds brechen die Klassifikation nicht', async () => {
		// Wenn ein Feedback-Eintrag pillarIds referenziert, die nicht (mehr) in der
		// gültigen Säulen-Liste stehen, müssen diese einfach herausgefiltert werden —
		// ohne Ausnahme, ohne Crash. Das gesamte Feedback-Sample wird verworfen, wenn
		// danach keine gültige pillarId mehr übrig ist.
		await setTestLlmProvider(true);
		let sentBody: { messages: { role: string; content: string }[] } | undefined;
		globalThis.fetch = (async (_url: string, init: { body: string }) => {
			sentBody = JSON.parse(init.body);
			return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ pillars: [] }) } }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as unknown as typeof fetch;

		const customPillars = [
			{ id: 10, name: 'Garten' },
			{ id: 20, name: 'Haushalt' },
		];
		await classifyPillarsWithMistral({
			title: 'Test',
			pillars: customPillars,
			examples: [
				{
					title: 'Alte Korrektur',
					description: 'pillarId 5 existiert nicht mehr',
					pillars: [
						{ pillarId: 5, confidence: 80 }, // gelöschte Säule
						{ pillarId: 10, confidence: 60 }, // noch gültig
					],
				},
				{
					title: 'Nur tote IDs',
					pillars: [
						{ pillarId: 5, confidence: 80 },
						{ pillarId: 999, confidence: 50 },
					],
				},
			],
		});

		// Die Klassifikation läuft ohne Fehler (keine Exception).
		// Das erste Sample wird mit nur pillarId 10 angehängt (5 gefiltert).
		// Das zweite Sample (nur tote IDs) wird komplett verworfen.
		const messages = sentBody?.messages ?? [];
		const alteKorrekturUser = messages.find(
			(message) => message.role === 'user' && message.content.includes('Alte Korrektur'),
		);
		assert.ok(alteKorrekturUser, 'Gültiges Feedback-Sample (mit gemischten IDs) wird als user-Message angehängt');
		const expectedAssistant = JSON.stringify({ pillars: [{ pillarId: 10, confidence: 60 }] });
		const matchingAssistant = messages.find(
			(message) => message.role === 'assistant' && message.content === expectedAssistant,
		);
		assert.ok(
			matchingAssistant,
			'assistant-Antwort enthält nur die noch gültige pillarId (10), pillarId 5 wurde gefiltert',
		);
		// Das zweite Sample (nur tote IDs) taucht gar nicht im Prompt auf.
		assert.ok(
			!messages.some((message) => message.content.includes('Nur tote IDs')),
			'Sample ohne gültige pillarId wird komplett verworfen',
		);
	});

	it('AK5 (#424): Ende-zu-Ende — Klassifikation mit Custom-Säulen funktioniert fehlerfrei', async () => {
		// Vollständiger Durchlauf: Klassifikation mit ausschließlich Custom-Säulen,
		// ohne Seed-Namen. Die Weak-Signal-Nachschärfung greift dann einfach nicht.
		await setTestLlmProvider(true);
		const customPillars = [
			{ id: 10, name: 'Garten' },
			{ id: 20, name: 'Haushalt' },
			{ id: 30, name: 'Kreativität' },
		];
		stubFetch(
			JSON.stringify({
				pillars: [
					{ pillarId: 10, confidence: 95 },
					{ pillarId: 30, confidence: 70 },
				],
			}),
		);

		const result = (await classifyPillarsWithMistral({
			title: 'Rasen mähen',
			pillars: customPillars,
		})) as { pillarId: number; confidence: number; share?: number }[];

		// Gültige pillarIds aus der Custom-Liste, keine Seed-IDs. TEST-PFLEGE #2076: der Server
		// vervollständigt Teilmengen über ALLE Säulen (AK2) — drei Custom-Säulen mit gültiger Verteilung.
		assert.equal(result.length, 3);
		assert.equal(result.find((entry) => entry.pillarId === 10)?.confidence, 95);
		assert.equal(result.find((entry) => entry.pillarId === 30)?.confidence, 70);
		assert.equal(result.find((entry) => entry.pillarId === 20)?.confidence, 0, 'ohne Modell-Stimme keine Konfidenz');
		const shares = result.map((entry) => entry.share ?? Number.NaN);
		assert.equal(
			shares.reduce((acc, share) => acc + share, 0),
			100,
		);
		assert.ok(
			shares.every((share) => Number.isInteger(share) && share >= 5 && share <= 80),
			JSON.stringify(shares),
		);
		// Keine Weak-Signal-Ceiling-Effekte: Custom-Säulen werden nicht gedeckelt
		assert.ok(
			result.every((s) => s.confidence > 60 || !weakSignalPillarIds(customPillars).has(s.pillarId)),
			'Custom-Säulen werden nicht von Weak-Signal-Ceiling betroffen',
		);
	});
});

/**
 * Rote Spec-Tests #2076 (Spec docs/spec/issue-2076.md): Der Klassifikator liefert je Säule einen
 * Anteil (ganzzahlig 5–80, Summe 100) NEBEN der Konfidenz. Testebene: öffentliche
 * `classifyPillarsWithMistral` mit gemocktem fetch — die (noch) nicht exportierte
 * `extractSuggestions` wird über den vollen Pfad geprüft (#1310-Muster in llm.test.ts).
 */
describe('classifyPillarsWithMistral — Anteil und Konfidenz je Säule (#2076)', () => {
	const pillars = [
		{ id: 1, name: 'Körper' },
		{ id: 2, name: 'Beziehungen' },
		{ id: 3, name: 'Sinn' },
		{ id: 4, name: 'Mentale Gesundheit' },
		{ id: 5, name: 'Wirksamkeit' },
	];
	const input: ClassifyPillarsInput = { title: 'Test', pillars };
	const originalFetch = globalThis.fetch;

	type SuggestionWithShare = { pillarId: number; confidence: number; share?: number };

	let lastBody: { messages?: { role: string; content: string }[] } | undefined;

	/** Mockt NUR den LLM-API-Call und zeichnet den gesendeten Body auf (Muster llm.test.ts, #1310). */
	const stubModelResponse = (parsedJson: unknown): void => {
		globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
			lastBody = init?.body ? (JSON.parse(String(init.body)) as typeof lastBody) : undefined;
			return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(parsedJson) } }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch;
	};

	/** Anteils-Invarianten des Vertrags (AK1/AK2): alle erwarteten Säulen, ganzzahlig 5–80, Summe 100. */
	const assertValidShares = (suggestions: SuggestionWithShare[], expectedIds: number[]): void => {
		assert.deepEqual(
			suggestions.map((entry) => entry.pillarId),
			expectedIds,
		);
		const shares = suggestions.map((entry) => entry.share ?? Number.NaN);
		assert.ok(
			shares.every((share) => Number.isInteger(share) && share >= 5 && share <= 80),
			`Anteile ganzzahlig 5–80: ${JSON.stringify(shares)}`,
		);
		assert.equal(
			shares.reduce((acc, share) => acc + share, 0),
			100,
			`Summe exakt 100: ${JSON.stringify(shares)}`,
		);
	};

	beforeEach(async () => {
		await setTestLlmProvider(true);
		lastBody = undefined;
	});

	after(() => {
		globalThis.fetch = originalFetch;
	});

	// AK1: gültige Modell-Antwort — Anteil je Säule kommt unverändert durch, auch über 60
	// (Anteile werden — anders als Konfidenzen — nicht auf das Weak-Signal-Ceiling gedeckelt).
	it('AK1: gibt je Säule Anteil und Konfidenz zurück; Anteile unterliegen nicht dem 60er-Ceiling', async () => {
		stubModelResponse({
			pillars: pillars.map((pillar, index) => ({
				pillarId: pillar.id,
				confidence: index === 0 ? 95 : 30,
				share: [5, 5, 70, 15, 5][index],
			})),
		});
		const result = (await classifyPillarsWithMistral(input)) as SuggestionWithShare[];
		assertValidShares(result, [1, 2, 3, 4, 5]);
		assert.equal(result.find((entry) => entry.pillarId === 1)?.confidence, 95, 'Konfidenz unverändert');
		assert.equal(
			result.find((entry) => entry.pillarId === 3)?.share,
			70,
			'Sinn-Anteil 70 bleibt 70 — keine 60er-Deckelung für Anteile',
		);
	});

	// AK1: System-Prompt und Antwortformat verlangen den Anteil.
	it('AK1: der System-Prompt verlangt Anteil 5–80 mit Summe 100 und gibt die „leere Liste“-Regel auf', async () => {
		stubModelResponse({ pillars: [] });
		await classifyPillarsWithMistral(input);
		const system = lastBody?.messages?.find((message) => message.role === 'system')?.content ?? '';
		assert.match(system, /Anteil/i, 'der Prompt spricht den Anteil an');
		assert.match(system, /\bshare\b/, 'das Antwortformat führt das share-Feld');
		assert.match(system, /5\s*[–-]\s*80/, 'die Grenzen 5–80 stehen im Prompt');
		assert.match(system, /\b100\b/, 'die Sollsumme 100 steht im Prompt');
		assert.doesNotMatch(system, /leere Liste/, 'die „leere Liste“-Regel ist entfallen');
	});

	// AK3: die Few-Shot-Beispiele formen den Vorschlag vor — Fokusfall UND Mischfall mit Anteilen.
	it('AK3: Few-Shot-Beispiele tragen gültige Anteile — mindestens ein Fokus- und ein Mischfall', async () => {
		stubModelResponse({ pillars: [] });
		await classifyPillarsWithMistral(input);
		const fewShot = (lastBody?.messages ?? [])
			.filter((message) => message.role === 'assistant')
			.map((message) => JSON.parse(message.content) as { pillars: SuggestionWithShare[] });
		assert.ok(fewShot.length >= 2, 'mindestens zwei Few-Shot-Beispiele');
		for (const example of fewShot) {
			assertValidShares(example.pillars, [1, 2, 3, 4, 5]);
		}
		const topShares = fewShot.map((example) => Math.max(...example.pillars.map((entry) => entry.share ?? 0)));
		assert.ok(
			topShares.some((top) => top >= 50),
			'Fokusfall vorhanden (eine Säule dominant)',
		);
		assert.ok(
			topShares.some((top) => top < 50),
			'Mischfall vorhanden — die Treppenform ist nicht die einzige Form',
		);
	});

	// AK2: unvollständige/ungültige Antworten werden über ALLE Säulen auf die Invarianten gebracht.
	it('AK2: ungültige Antworten werden über alle Säulen auf die Invarianten gebracht', async () => {
		const fehlerfaelle: { name: string; payload: unknown }[] = [
			{
				name: 'Anteile fehlen',
				payload: { pillars: pillars.map((pillar) => ({ pillarId: pillar.id, confidence: 20 })) },
			},
			{
				name: 'Summe 150',
				payload: {
					pillars: pillars.map((pillar, index) => ({
						pillarId: pillar.id,
						confidence: 20,
						share: [80, 20, 15, 20, 15][index],
					})),
				},
			},
			{
				name: 'Anteil 90',
				payload: {
					pillars: pillars.map((pillar, index) => ({
						pillarId: pillar.id,
						confidence: 20,
						share: [90, 5, 5, 0, 0][index],
					})),
				},
			},
			{
				name: 'nur 2 von 5 Säulen',
				payload: {
					pillars: [
						{ pillarId: 1, confidence: 90, share: 60 },
						{ pillarId: 3, confidence: 30, share: 25 },
					],
				},
			},
		];
		for (const fehlerfall of fehlerfaelle) {
			lastBody = undefined;
			stubModelResponse(fehlerfall.payload);
			const result = (await classifyPillarsWithMistral(input)) as SuggestionWithShare[];
			assertValidShares(result, [1, 2, 3, 4, 5]);
		}
	});
});
