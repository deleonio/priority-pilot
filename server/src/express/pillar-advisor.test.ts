import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../test/helpers.js';

// Die DB ist ein Singleton, das von allen describe-Blöcken geteilt wird. Daher genau
// einmal am Dateiende schließen — nicht je describe, sonst reißt das erste after()
// die Verbindung für die folgenden Suites ab ("connection manager was closed").
after(closeDb);
import {
	adviseActivitiesWithMistral,
	MissingApiKeyError,
	MistralRequestError,
	type ActivityAdvice,
	type ActivityAdvisor,
	type AdviseActivitiesInput,
} from '../llm/mistral.js';
import { SEED_PILLARS } from '../models/pillarData.js';

/** Legt die fünf Standard-Säulen samt Kurzbeschreibung an und gibt sie (nach id sortiert) zurück. */
const seedPillars = async (): Promise<Pillar[]> => {
	await Pillar.bulkCreate(SEED_PILLARS.map((pillar) => ({ ...pillar })));
	return Pillar.findAll({ order: [['id', 'ASC']] });
};

describe('POST /pillars/advisor', () => {
	let server: TestServer;
	let lastInput: AdviseActivitiesInput | undefined;
	let advisorImpl: ActivityAdvisor;

	// Ein einziger Server, dessen Berater pro Test über `advisorImpl` umgeschaltet wird.
	const advisor: ActivityAdvisor = (input) => {
		lastInput = input;
		return advisorImpl(input);
	};

	const post = (body: unknown) =>
		fetch(`${server.baseUrl}/pillars/advisor`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

	beforeEach(async () => {
		await resetDb();
		lastInput = undefined;
		advisorImpl = async () => [];
		if (!server) {
			server = await startTestServer({ activityAdvisor: advisor });
		}
	});

	after(async () => {
		if (server) {
			await server.close();
		}
	});

	it('200 liefert die Beratung und übergibt die Säulen samt Kurzbeschreibung aus den Einstellungen', async () => {
		const pillars = await seedPillars();
		const expected: ActivityAdvice[] = [
			{ activity: 'Joggen im Park', reason: 'Bewegung an der frischen Luft.', pillarIds: [pillars[0].id] },
			{
				activity: 'Spieleabend mit Freunden',
				reason: 'Gemeinsame Zeit stärkt soziale Kontakte.',
				pillarIds: [pillars[1].id, pillars[3].id],
			},
		];
		advisorImpl = async () => expected;

		const res = await post({ question: 'Was kann ich am Wochenende für mich tun?' });
		assert.equal(res.status, 200);
		assert.deepEqual(await res.json(), { advice: expected });

		// Die Frage und der reale Säulen-Satz (inkl. der Kurzbeschreibungen aus den Einstellungen —
		// die Rubrik des Beraters) werden durchgereicht.
		assert.equal(lastInput?.question, 'Was kann ich am Wochenende für mich tun?');
		assert.deepEqual(
			lastInput?.pillars,
			pillars.map((pillar) => ({ id: pillar.id, name: pillar.name, description: pillar.description })),
		);
	});

	it('200 ohne Frage: question kommt als undefined beim Berater an (auch bei leerem String)', async () => {
		await seedPillars();

		assert.equal((await post({})).status, 200);
		assert.equal(lastInput?.question, undefined);

		assert.equal((await post({ question: '   ' })).status, 200);
		assert.equal(lastInput?.question, undefined);
	});

	it('200 reicht die vom Client mitgeschickte Säulen-Verteilung an den Berater durch', async () => {
		const pillars = await seedPillars();
		const distribution = [
			{ pillarId: pillars[0].id, weight: 20, actualShare: 0.4 },
			{ pillarId: pillars[1].id, weight: 20, actualShare: 0 },
		];

		assert.equal((await post({ distribution })).status, 200);
		// Die Verteilung kommt unverändert (Soll/Ist je Säule) beim Berater an.
		assert.deepEqual(lastInput?.distribution, distribution);
	});

	it('200 filtert unbekannte pillarIds aus der Verteilung heraus (nur konfigurierte Säulen)', async () => {
		const pillars = await seedPillars();
		const known = { pillarId: pillars[0].id, weight: 20, actualShare: 0.1 };

		assert.equal(
			(await post({ distribution: [known, { pillarId: 99999, weight: 20, actualShare: 0.5 }] })).status,
			200,
		);
		assert.deepEqual(lastInput?.distribution, [known]);
	});

	it('200 ohne verbleibende gültige Verteilungs-Einträge: distribution kommt als undefined an', async () => {
		await seedPillars();

		assert.equal((await post({ distribution: [{ pillarId: 99999, weight: 20, actualShare: 0.5 }] })).status, 200);
		assert.equal(lastInput?.distribution, undefined);
	});

	it('400 wenn distribution kein Array ist', async () => {
		await seedPillars();
		assert.equal((await post({ distribution: { pillarId: 1, weight: 20, actualShare: 0.1 } })).status, 400);
	});

	it('400 wenn ein Verteilungs-Eintrag ungültige Werte hat (actualShare > 1, weight > 100, kein pillarId)', async () => {
		const pillars = await seedPillars();
		assert.equal(
			(await post({ distribution: [{ pillarId: pillars[0].id, weight: 20, actualShare: 1.5 }] })).status,
			400,
		);
		assert.equal(
			(await post({ distribution: [{ pillarId: pillars[0].id, weight: 150, actualShare: 0.1 }] })).status,
			400,
		);
		assert.equal((await post({ distribution: [{ weight: 20, actualShare: 0.1 }] })).status, 400);
	});

	it('400 wenn question kein String ist', async () => {
		await seedPillars();
		assert.equal((await post({ question: 42 })).status, 400);
	});

	it('400 wenn question länger als 500 Zeichen ist', async () => {
		await seedPillars();
		assert.equal((await post({ question: 'x'.repeat(501) })).status, 400);
	});

	it('400 wenn Body kein Objekt ist', async () => {
		await seedPillars();
		assert.equal((await post(null)).status, 400);
	});

	it('503 wenn keine Säulen konfiguriert sind', async () => {
		const res = await post({});
		assert.equal(res.status, 503);
	});

	it('503 wenn der API-Key fehlt (MissingApiKeyError)', async () => {
		await seedPillars();
		advisorImpl = async () => {
			throw new MissingApiKeyError();
		};
		assert.equal((await post({})).status, 503);
	});

	it('502 bei Upstream-/Format-Fehler (MistralRequestError)', async () => {
		await seedPillars();
		advisorImpl = async () => {
			throw new MistralRequestError('kaputt');
		};
		assert.equal((await post({})).status, 502);
	});

	it('500 bei unerwartetem Fehler im Berater', async () => {
		await seedPillars();
		advisorImpl = async () => {
			throw new Error('boom');
		};
		assert.equal((await post({})).status, 500);
	});
});

describe('adviseActivitiesWithMistral (Unit, gemockter fetch)', () => {
	const pillars = [
		{ id: 1, name: 'Körper', description: 'Physische Gesundheit: Bewegung, Ernährung, Schlaf, Vorsorge.' },
		{ id: 2, name: 'Beziehungen', description: 'Soziale Verbundenheit: Familie, Freunde, Partnerschaft.' },
		{ id: 3, name: 'Sinn', description: 'Das „Wofür": Werte, Lebensziele, Spiritualität, Ehrenamt.' },
	];
	const input: AdviseActivitiesInput = { pillars };

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
		await assert.rejects(() => adviseActivitiesWithMistral(input), MissingApiKeyError);
	});

	it('parst gültige Antworten; unbekannte/doppelte pillarIds werden gefiltert und sortiert', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch(
			JSON.stringify({
				advice: [
					{ activity: '  Joggen  ', reason: ' Bewegung. ', pillarIds: [2, 1, 999, 1] },
					{ activity: 'Nur Müll', reason: 'keine gültige Säule', pillarIds: [999] },
					{ activity: '', reason: 'ohne Aktivität', pillarIds: [1] },
					{ activity: 'Ehrenamt', pillarIds: [3] },
				],
			}),
		);
		const result = await adviseActivitiesWithMistral(input);
		assert.deepEqual(result, [
			{ activity: 'Joggen', reason: 'Bewegung.', pillarIds: [1, 2] },
			{ activity: 'Ehrenamt', reason: '', pillarIds: [3] },
		]);
	});

	it('begrenzt die Vorschläge auf 8 Einträge', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch(
			JSON.stringify({
				advice: Array.from({ length: 12 }, (_, i) => ({
					activity: `Aktivität ${i}`,
					reason: 'x',
					pillarIds: [1],
				})),
			}),
		);
		const result = await adviseActivitiesWithMistral(input);
		assert.equal(result.length, 8);
	});

	it('wirft MistralRequestError bei unerwartetem Format', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch(JSON.stringify({ falsch: [] }));
		await assert.rejects(() => adviseActivitiesWithMistral(input), MistralRequestError);
	});

	it('wirft MistralRequestError bei HTTP-Fehlerstatus', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		stubFetch('', false, 429);
		await assert.rejects(() => adviseActivitiesWithMistral(input), MistralRequestError);
	});

	it('injiziert die Säulen-Kurzbeschreibungen und die Frage in den Prompt', async () => {
		process.env.MISTRAL_API_KEY = 'test-key';
		let sentBody: { messages: { role: string; content: string }[] } | undefined;
		globalThis.fetch = (async (_url: string, init: { body: string }) => {
			sentBody = JSON.parse(init.body);
			return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ advice: [] }) } }] }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as unknown as typeof fetch;

		await adviseActivitiesWithMistral({ ...input, question: 'Was tut mir diese Woche gut?' });

		const userMessage = sentBody?.messages.find((message) => message.role === 'user');
		assert.ok(userMessage, 'es gibt eine user-Message');
		// Die Rubrik kommt aus den übergebenen Säulen (Name + Kurzbeschreibung aus den Einstellungen).
		for (const pillar of pillars) {
			assert.ok(userMessage.content.includes(pillar.name), `Prompt enthält den Säulen-Namen ${pillar.name}`);
			assert.ok(userMessage.content.includes(pillar.description), `Prompt enthält die Beschreibung von ${pillar.name}`);
		}
		assert.ok(userMessage.content.includes('Was tut mir diese Woche gut?'), 'Prompt enthält die Frage');
	});
});
