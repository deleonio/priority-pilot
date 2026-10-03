import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { User, Pillar } from '../models/index.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('test-secret-for-tests');

/** Fixture: zwei Konto-Säulen für eine gültige Vollverteilung (#2077) — der Test-Login seedt keine. */
const seedZweiSaeulen = async (email: string): Promise<[number, number]> => {
	const user = await User.findOne({ where: { email } });
	const erste = await Pillar.create({ name: 'Körper', description: 'Kurzbeschreibung', userId: user?.id });
	const zweite = await Pillar.create({ name: 'Sinn', description: 'Kurzbeschreibung', userId: user?.id });
	return [erste.id, zweite.id];
};

let server: TestServer;

/**
 * Fürsorge-Übernahme-Vertrag (#2010, docs/spec/issue-2010.md AK3): das Payload, das
 * `CareHint.uebernehmen()` für Vorlagen- und KI-Vorschläge an `POST /tasks` schickt (Titel,
 * Beschreibung, priority 3, estimatedEffort 0.5, die Vollverteilung des Vorschlags als
 * `saeulenBeitraege` mit confidence 100), passiert die Server-Validierung und wird mit
 * persistierten Beiträgen beantwortet. Spiegel zwischen Frontend-Payload
 * (`frontend/src/components/CareHint.tsx`) und Server-Validierung — bricht eine Seite den
 * Vertrag, wird der Test rot. Seit #2077 verlangt der Server gültige Vollverteilungen (jeder
 * Anteil 5–80, Summe 100, alle Konto-Säulen) — das Payload spiegelt exakt das. Der leerer-
 * Titel-Fall ist bereits in `tasks-title-length.test.ts` („Task mit leerem Titel wird
 * abgelehnt") abgedeckt.
 */
describe('POST /tasks — CareHint-Übernahme-Payload (#2010)', () => {
	let cookie: string;

	before(async () => {
		server = await startTestServer();
	});

	beforeEach(async () => {
		await resetDb();
		cookie = await server.login('testuser@example.com', { displayName: 'Test User' });
	});

	after(async () => {
		if (server) await server.close();
		await closeDb();
	});

	it('CareHint-Payload wird angenommen, Vollverteilung mit confidence 100 persistiert', async () => {
		// Fixture: zwei Konto-Säulen, damit das Payload eine gültige Vollverteilung tragen kann
		// (der Test-Login seedt keine Säulen — Muster ai-quota.test.ts).
		const [ersteId, zweiteId] = await seedZweiSaeulen('testuser@example.com');

		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				title: 'Mit Anna wandern gehen',
				description: 'Du planst öfter Bewegung mit Freunden.',
				priority: 3,
				estimatedEffort: 0.5,
				pillars: [
					{ pillarId: ersteId, share: 60, confidence: 100 },
					{ pillarId: zweiteId, share: 40, confidence: 100 },
				],
			}),
		});

		assert.equal(res.status, 201, 'Das CareHint-Payload muss POST /tasks passieren');
		const body = (await res.json()) as {
			title: string;
			description: string | null;
			priority: number;
			estimatedEffort: number;
			pillars: { pillarId: number; share: number; confidence: number }[];
		};
		assert.equal(body.title, 'Mit Anna wandern gehen');
		assert.equal(body.description, 'Du planst öfter Bewegung mit Freunden.');
		assert.equal(body.priority, 3);
		assert.equal(body.estimatedEffort, 0.5);
		const erwartet = [
			{ pillarId: ersteId, share: 60, confidence: 100 },
			{ pillarId: zweiteId, share: 40, confidence: 100 },
		].sort((a, b) => a.pillarId - b.pillarId);
		assert.deepEqual(
			body.pillars.sort((a, b) => a.pillarId - b.pillarId),
			erwartet,
		);
	});
});
