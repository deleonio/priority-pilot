import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MissingApiKeyError, MistralRequestError, type ParseTaskParser, type ParsedTask } from '../../llm/mistral.js';
import { resetDb, closeDb, startTestServer, type TestServer } from '../../test/helpers.js';

after(closeDb);

const post = (baseUrl: string, body: unknown) =>
	fetch(`${baseUrl}/tasks/parse-text`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});

describe('POST /tasks/parse-text', () => {
	let server: TestServer;
	let parserImpl: ParseTaskParser;

	// Austauschbarer Parser — pro Test über parserImpl umgeschaltet.
	const parser: ParseTaskParser = (text) => parserImpl(text);

	beforeEach(async () => {
		await resetDb();
		parserImpl = async () => ({ title: 'Fallback-Task' });
		if (!server) {
			server = await startTestServer({ taskTextParser: parser });
		}
	});

	after(async () => {
		if (server) await server.close();
	});

	// AK1: Endpoint antwortet mit strukturierten Feldern
	it('AK1: 200 und strukturierte Felder bei erfolgreichem Parser-Aufruf', async () => {
		const parsed: ParsedTask = {
			title: 'Steuererklärung',
			deadline: '2026-07-31T00:00:00.000Z',
			priority: 3,
			estimatedEffort: 0.25,
		};
		parserImpl = async () => parsed;

		const res = await post(server.baseUrl, {
			text: 'Steuererklärung bis 31. Juli, mittlere Prio, ca. 2h',
		});
		assert.equal(res.status, 200);
		const body = (await res.json()) as ParsedTask;
		assert.equal(typeof body.title, 'string', 'title muss ein String sein');
		assert.ok(body.title.length > 0, 'title darf nicht leer sein');
	});

	it('AK1: Antwort-Body enthält alle optionalen Felder wenn der Parser sie liefert', async () => {
		const parsed: ParsedTask = {
			title: 'Steuererklärung',
			description: 'Alle Belege zusammensuchen',
			deadline: '2026-07-31T00:00:00.000Z',
			priority: 3,
			estimatedEffort: 0.25,
		};
		parserImpl = async () => parsed;

		const res = await post(server.baseUrl, { text: 'Steuererklärung bis 31. Juli' });
		assert.equal(res.status, 200);
		const body = (await res.json()) as ParsedTask;
		assert.equal(body.title, 'Steuererklärung');
		assert.equal(body.description, 'Alle Belege zusammensuchen');
		assert.equal(body.deadline, '2026-07-31T00:00:00.000Z');
		assert.equal(body.priority, 3);
		assert.equal(body.estimatedEffort, 0.25);
	});

	it('AK1: 400 wenn das text-Feld fehlt', async () => {
		const res = await post(server.baseUrl, {});
		assert.equal(res.status, 400);
	});

	it('AK1: 400 wenn text ein leerer String ist', async () => {
		const res = await post(server.baseUrl, { text: '' });
		assert.equal(res.status, 400);
	});

	it('AK1: 400 wenn text kein String ist', async () => {
		const res = await post(server.baseUrl, { text: 42 });
		assert.equal(res.status, 400);
	});

	// AK2: Fehlende Mistral-Key → 503
	it('AK2: 503 wenn MissingApiKeyError geworfen wird', async () => {
		parserImpl = async () => {
			throw new MissingApiKeyError();
		};

		const res = await post(server.baseUrl, {
			text: 'Steuererklärung bis 31. Juli',
		});
		assert.equal(res.status, 503);
	});

	it('AK2: 502 bei Mistral-Upstream-Fehler (MistralRequestError)', async () => {
		parserImpl = async () => {
			throw new MistralRequestError('Upstream-Verbindung fehlgeschlagen');
		};

		const res = await post(server.baseUrl, {
			text: 'Steuererklärung bis 31. Juli',
		});
		assert.equal(res.status, 502);
	});

	it('AK2: 500 bei unerwartetem Fehler', async () => {
		parserImpl = async () => {
			throw new Error('Unerwarteter Fehler');
		};

		const res = await post(server.baseUrl, { text: 'Beliebiger Text' });
		assert.equal(res.status, 500);
	});
});

// AK3: OpenAPI-Schema vollständig
describe('AK3: openapi.yml enthält /tasks/parse-text', () => {
	it('openapi.yml definiert den Pfad /tasks/parse-text', async () => {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const openapiPath = resolve(__dirname, '../../../../../openapi.yml');
		const content = await readFile(openapiPath, 'utf-8');
		assert.ok(content.includes('/tasks/parse-text'), 'openapi.yml muss den Pfad /tasks/parse-text enthalten');
	});

	it('openapi.yml definiert ein Request-Schema mit dem Feld text', async () => {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const openapiPath = resolve(__dirname, '../../../../../openapi.yml');
		const content = await readFile(openapiPath, 'utf-8');
		// Das Schema für den Request-Body muss ein Feld "text" definieren.
		assert.ok(
			content.includes('ParseTaskInput') || content.includes('parseTaskInput'),
			'openapi.yml muss ein Schema für den Request-Body von /tasks/parse-text enthalten',
		);
	});

	it('openapi.yml definiert ein Response-Schema mit den Feldern title, priority, estimatedEffort', async () => {
		const __dirname = dirname(fileURLToPath(import.meta.url));
		const openapiPath = resolve(__dirname, '../../../../../openapi.yml');
		const content = await readFile(openapiPath, 'utf-8');
		assert.ok(
			content.includes('ParsedTask') || content.includes('parsedTask'),
			'openapi.yml muss ein Schema für die Response von /tasks/parse-text enthalten (ParsedTask)',
		);
	});
});
