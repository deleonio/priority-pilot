import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { resetDb, closeDb, startTestServer, type TestServer, applyTestAuthEnv } from '../test/helpers.js';
import { User, Pillar } from '../models/index.js';
import { saeulenBeitraegeFuerZiel } from '../logics/careSuggestions.js';

// Auth-Kontext muss vor dem Server-Start feststehen.
process.env.GOOGLE_ALLOWED_EMAIL = 'testuser@example.com';
applyTestAuthEnv('test-secret-for-tests');

/**
 * Fixture: die fünf Standard-Säulen des Registrierungs-Seedings (`SEED_PILLARS`) — reale Kontonorm
 * (#2077). Der Test-Login seedt keine Säulen, das Payload braucht aber eine gültige Vollverteilung
 * über ALLE Konto-Säulen (Muster ai-quota.test.ts).
 */
const seedFuenfSaeulen = async (email: string): Promise<{ id: number }[]> => {
	const user = await User.findOne({ where: { email } });
	return Promise.all(
		['Körper', 'Mentale Gesundheit', 'Beziehungen', 'Wirksamkeit', 'Sinn'].map((name) =>
			Pillar.create({ name, description: 'Kurzbeschreibung', userId: user?.id }),
		),
	);
};

let server: TestServer;

/**
 * Fürsorge-Übernahme-Vertrag (#2010, docs/spec/issue-2010.md AK3), Spiegel zwischen
 * `CareHint.uebernehmen()` (`frontend/src/components/CareHint.tsx`) und Server-Validierung:
 * das Frontend normiert die Vorschlags-Beiträge (`saeulenBeitraege` mit confidence 100) über
 * `fillContributions` zu einer gültigen Vollverteilung (alle Konto-Säulen, jeder Anteil 5–80,
 * Summe 100 — #2077) und schickt genau diese an `POST /tasks`. Der Server nimmt sie an und
 * persistiert sie unverändert — bricht eine Seite den Vertrag, wird der Test rot. Der leerer-
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

	it('Vorlage-Pfad: vollständige Vorschlags-Verteilung wird 1:1 übernommen (confidence 100)', async () => {
		const saeulen = await seedFuenfSaeulen('testuser@example.com');
		const [ersteId] = saeulen.map((saeule) => saeule.id);

		// Serverseitiger Vorschlags-Bauplan (#2075): Ziel-Säule 50 %, Rest gleichmäßig — genau das,
		// was `GET /scores/care-suggestions` als `saeulenBeitraege` liefert. `fillContributions`
		// lässt die bereits gültige Verteilung unverändert, hängt aber confidence 100 an.
		const saeulenBeitraege = saeulenBeitraegeFuerZiel(ersteId, saeulen);
		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				title: 'Mit Anna wandern gehen',
				description: 'Du planst öfter Bewegung mit Freunden.',
				priority: 3,
				estimatedEffort: 0.5,
				pillars: saeulenBeitraege.map(({ pillarId, share }) => ({ pillarId, share, confidence: 100 })),
			}),
		});

		assert.equal(res.status, 201, 'Das CareHint-Payload muss POST /tasks passieren');
		const body = (await res.json()) as {
			title: string;
			pillars: { pillarId: number; share: number; confidence: number }[];
		};
		assert.equal(body.title, 'Mit Anna wandern gehen');
		const erwartet = saeulenBeitraege
			.map(({ pillarId, share }) => ({ pillarId, share, confidence: 100 }))
			.sort((a, b) => a.pillarId - b.pillarId);
		assert.deepEqual(
			body.pillars.sort((a, b) => a.pillarId - b.pillarId),
			erwartet,
		);
	});

	it('Normierungs-Pfad: Teilverteilung einer Bestandsaufgabe wird zur gültigen Vollverteilung', async () => {
		const saeulen = await seedFuenfSaeulen('testuser@example.com');
		const [ersteId] = saeulen.map((saeule) => saeule.id);

		// Urdaten einer Bestandsaufgabe (#2077): Teilverteilung, nur eine Säule mit 60 %. Das
		// Frontend staucht sie per `fillContributions` auf alle fünf Säulen — Höchstanteil 80,
		// übrige je 5, Summe 100.
		const res = await fetch(`${server.baseUrl}/tasks`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Cookie: cookie },
			body: JSON.stringify({
				title: 'Mit Anna wandern gehen',
				priority: 3,
				estimatedEffort: 0.5,
				pillars: [
					{ pillarId: ersteId, share: 80, confidence: 100 },
					...saeulen.slice(1).map(({ id }) => ({ pillarId: id, share: 5, confidence: 100 })),
				],
			}),
		});

		assert.equal(res.status, 201, 'Das normierte CareHint-Payload muss POST /tasks passieren');
		const body = (await res.json()) as { pillars: { pillarId: number; share: number; confidence: number }[] };
		const erwartet = [
			{ pillarId: ersteId, share: 80, confidence: 100 },
			...saeulen.slice(1).map(({ id }) => ({ pillarId: id, share: 5, confidence: 100 })),
		].sort((a, b) => a.pillarId - b.pillarId);
		assert.deepEqual(
			body.pillars.sort((a, b) => a.pillarId - b.pillarId),
			erwartet,
		);
	});
});
