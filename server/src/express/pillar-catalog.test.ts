import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pillar } from '../models/index.js';
import { SEED_PILLARS } from '../models/pillarData.js';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import type { ActivityAdvisor, AdviseActivitiesInput, ClassifyPillarsInput, PillarClassifier } from '../llm/llm.js';

// Rote Spec-Tests für #1848 (docs/spec/issue-1848.md), AK1/AK2/AK4: Beschreibung und `key` der
// Standard-Säulen kommen aus dem zentralen Katalog, nicht aus der nutzer-eigenen DB-Zeile.

process.env.GOOGLE_ALLOWED_EMAILS = 'alice@example.com,bob@example.com';
applyTestAuthEnv('pillar-catalog-test');

/** Katalog inkl. `key` — `key` existiert erst mit der Umsetzung, daher lokaler Typ statt Import-Typ. */
const catalog = SEED_PILLARS as unknown as readonly {
	key: string;
	name: string;
	description: string;
	weight: number;
}[];

interface PillarBody {
	id: number;
	key?: string | null;
	name: string;
	description: string;
}

let server: TestServer;
let lastClassifierInput: ClassifyPillarsInput | undefined;
let lastAdvisorInput: AdviseActivitiesInput | undefined;
const classifier: PillarClassifier = async (input) => {
	lastClassifierInput = input;
	return [];
};
const advisor: ActivityAdvisor = async (input) => {
	lastAdvisorInput = input;
	return [];
};

after(async () => {
	await server?.close();
	await closeDb();
});

describe('#1848 Säulen-Katalog: GET /pillars', () => {
	beforeEach(async () => {
		await resetDb();
		server ??= await startTestServer({ pillarClassifier: classifier, activityAdvisor: advisor });
	});

	const listPillars = async (cookie: string): Promise<PillarBody[]> => {
		const res = await fetch(`${server.baseUrl}/pillars`, { headers: { cookie } });
		assert.equal(res.status, 200);
		return (await res.json()) as PillarBody[];
	};

	it('AK1: liefert je Standard-Säule key und Katalog-Beschreibung, für zwei Nutzer identisch', async () => {
		const alice = await listPillars(await server.register('alice@example.com'));
		const bob = await listPillars(await server.register('bob@example.com'));

		for (const body of [alice, bob]) {
			assert.deepEqual(
				body.map((p) => ({ key: p.key, name: p.name, description: p.description })),
				catalog.map((p) => ({ key: p.key, name: p.name, description: p.description })),
			);
		}
	});

	it('AK2: leere oder abweichende DB-description ändert die Antwort nicht (Katalogtext)', async () => {
		const cookie = await server.register('alice@example.com');
		const [erste, zweite] = await Pillar.findAll({ order: [['id', 'ASC']] });
		await erste.update({ description: '' });
		await zweite.update({ description: 'Alttext aus einer früheren Version' });

		const body = await listPillars(cookie);

		assert.equal(body[0].description, catalog[0].description);
		assert.equal(body[1].description, catalog[1].description);
	});
});

describe('#1848 Säulen-Katalog: KI-Vorschlag und Säulen-Berater (AK4)', () => {
	beforeEach(async () => {
		await resetDb();
		lastClassifierInput = undefined;
		lastAdvisorInput = undefined;
		server ??= await startTestServer({ pillarClassifier: classifier, activityAdvisor: advisor });
	});

	/** Registriert einen Nutzer (Konto-Anlage sät die Säulen) und leert deren DB-Beschreibung. */
	const nutzerMitLeererDbBeschreibung = async (): Promise<string> => {
		const cookie = await server.register('alice@example.com');
		await Pillar.update({ description: '' }, { where: {} });
		return cookie;
	};

	const post = (path: string, body: unknown, cookie: string) =>
		fetch(`${server.baseUrl}${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', cookie },
			body: JSON.stringify(body),
		});

	it('der Klassifikator erhält die Katalog-Beschreibung', async () => {
		const cookie = await nutzerMitLeererDbBeschreibung();
		assert.equal((await post('/tasks/suggest-pillars', { title: 'Joggen' }, cookie)).status, 200);
		assert.deepEqual(
			lastClassifierInput?.pillars.map((p) => p.description),
			catalog.map((p) => p.description),
		);
	});

	it('der Säulen-Berater erhält die Katalog-Beschreibung', async () => {
		const cookie = await nutzerMitLeererDbBeschreibung();
		assert.equal((await post('/pillars/advisor', { question: 'Was tun?' }, cookie)).status, 200);
		assert.deepEqual(
			lastAdvisorInput?.pillars.map((p) => p.description),
			catalog.map((p) => p.description),
		);
	});
});
