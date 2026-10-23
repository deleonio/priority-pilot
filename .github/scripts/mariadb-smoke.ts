// MariaDB-Smoke (#2828): faehrt die Kernabfragen gegen den in ci-mariadb.yml gestarteten Server
// (NODE_ENV=test, DB_DIALECT=mysql, SESSION_SECRET gesetzt → Auth-Gate aktiv) und bricht bei jeder
// Abweichung mit Exit 1 ab — damit wird der Workflow rot und Dialekt-Fehler fallen hier auf, nicht
// erst in Produktion. Schritte: MariaDB-Version (AK3), Registrieren + Login mit Session-Cookie,
// Task anlegen und zuruecklesen, Admin-KPIs mit per ADMIN_EMAILS befoerdertem Nutzer (AK2).
//
// Aufruf: node .github/scripts/mariadb-smoke.ts
// Env: BASE_URL (Default http://127.0.0.1:3100), ADMIN_EMAILS/MARIADB_* wie im Workflow gesetzt.

import { createRequire } from 'node:module';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3100';
const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() ?? 'smoke-admin@example.com';
const PASSWORD = 'smoke-password-1';
const TASK_TITLE = 'MariaDB-Smoke-Task';
const READY_TIMEOUT_MS = 90_000;

// mysql2 ist eine Server-Abhaengigkeit (pnpm hoistet sie nicht ins Root-Node_modules) —
// deshalb per createRequire aus dem Server-Paket aufloesen statt eigenen Deps in .github.
const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url));
const mysql = serverRequire('mysql2/promise') as typeof import('mysql2/promise');

class SmokeError extends Error {}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

interface HttpResponse {
	status: number;
	body: unknown;
	cookies: string[];
}

const request = async (path: string, init?: RequestInit): Promise<HttpResponse> => {
	const res = await fetch(`${BASE_URL}${path}`, init);
	const text = await res.text();
	let body: unknown = text;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		// Nicht-JSON (z. B. Fehlerseite) bleibt als Text — die Auswertung meldet ihn mit.
	}
	return { status: res.status, body, cookies: res.headers.getSetCookie() };
};

/** Ersten Cookie (nur Name=Wert, ohne Attribute) aus einem Set-Cookie-Header holen. */
const sessionCookie = (cookies: string[]): string => {
	const first = cookies[0]?.split(';')[0];
	if (!first || !first.includes('=')) {
		throw new SmokeError('Kein Session-Cookie erhalten.');
	}
	return first;
};

const assertStatus = (
	name: string,
	res: HttpResponse,
	expected: number,
): HttpResponse & { body: Record<string, unknown> } => {
	if (res.status !== expected) {
		throw new SmokeError(`${name}: erwartet HTTP ${expected}, erhalten ${res.status} — ${JSON.stringify(res.body)}`);
	}
	// Komplette Response durchreichen (Status, Cookies, Body) — der Login-Schritt braucht
	// z. B. den Session-Cookie aus dem Register-/Login-Header weiter unten.
	return { ...res, body: (res.body ?? {}) as Record<string, unknown> };
};

const step = async (name: string, fn: () => Promise<string>): Promise<void> => {
	const detail = await fn();
	console.log(`OK  ${name}${detail ? ` — ${detail}` : ''}`);
};

// Server-Bereitschaft: IRGENDEIN HTTP-Status genuegt (Server lauscht) — mit aktivem Auth-Gate
// antwortet /tasks ohne Session mit 401, ein 200-Warten wie im E2E wuerde hier nie gruen.
const waitForServer = async (): Promise<void> => {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	let lastError: unknown = null;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${BASE_URL}/tasks`);
			console.log(`Server bereit (HTTP ${res.status}).`);
			return;
		} catch (error) {
			lastError = error;
			await wait(1_000);
		}
	}
	throw new SmokeError(`Server wurde innerhalb von ${READY_TIMEOUT_MS / 1000}s nicht bereit: ${String(lastError)}`);
};

const smoke = async (): Promise<void> => {
	await step('Server-Bereitschaft', waitForServer);

	await step('MariaDB-Version', async () => {
		const connection = await mysql.createConnection({
			host: process.env.MARIADB_HOST ?? '127.0.0.1',
			port: Number(process.env.MARIADB_PORT ?? '3306'),
			user: process.env.MARIADB_USER ?? 'balamentum',
			password: process.env.MARIADB_PASSWORD ?? 'balamentum',
			database: process.env.MARIADB_DATABASE ?? 'balamentum_smoke',
		});
		try {
			const [rows] = await connection.query('SELECT VERSION() AS version');
			const version = (rows as { version: string }[])[0]?.version;
			if (!version) {
				throw new SmokeError('SELECT VERSION() lieferte keine Version.');
			}
			return version;
		} finally {
			await connection.end();
		}
	});

	let adminCookie = '';
	await step('Registrieren + Login', async () => {
		const registered = assertStatus(
			'Registrieren',
			await request('/auth/register', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD }),
			}),
			201,
		);
		if (registered.body.email !== ADMIN_EMAIL) {
			throw new SmokeError(`Registrieren: unerwarteter Body ${JSON.stringify(registered.body)}`);
		}
		adminCookie = sessionCookie(registered.cookies);
		const loggedIn = assertStatus(
			'Login',
			await request('/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json', cookie: adminCookie },
				body: JSON.stringify({ email: ADMIN_EMAIL, password: PASSWORD }),
			}),
			200,
		);
		// Der Login regeneriert die Session (alte Id wird zerstoert) — ab hier gilt der
		// frische Cookie der Login-Antwort, nicht mehr der aus dem Register.
		adminCookie = sessionCookie(loggedIn.cookies);
		return `als ${String(loggedIn.body.email ?? ADMIN_EMAIL)}`;
	});

	let taskId = 0;
	await step('Task anlegen und zuruecklesen', async () => {
		const created = assertStatus(
			'Task anlegen',
			await request('/tasks', {
				method: 'POST',
				headers: { 'content-type': 'application/json', cookie: adminCookie },
				body: JSON.stringify({ title: TASK_TITLE }),
			}),
			201,
		);
		taskId = Number(created.body.id);
		if (!Number.isFinite(taskId) || taskId <= 0) {
			throw new SmokeError(`Task anlegen: keine plausible Id — ${JSON.stringify(created.body)}`);
		}
		const readBack = assertStatus(
			'Task lesen',
			await request(`/tasks/${taskId}`, { headers: { cookie: adminCookie } }),
			200,
		);
		if (readBack.body.title !== TASK_TITLE || Number(readBack.body.id) !== taskId) {
			throw new SmokeError(`Task lesen: uebereinstimmung fehlt — ${JSON.stringify(readBack.body)}`);
		}
		return `Task ${taskId} ('${TASK_TITLE}')`;
	});

	await step('Admin-KPIs', async () => {
		const kpis = assertStatus(
			'Admin-KPIs',
			await request('/admin/kpis?zeitraum=woche', { headers: { cookie: adminCookie } }),
			200,
		);
		if (kpis.body.zeitraum !== 'woche' || !Array.isArray(kpis.body.zeilen)) {
			throw new SmokeError(`Admin-KPIs: unerwarteter Body ${JSON.stringify(kpis.body)}`);
		}
		return `${(kpis.body.zeilen as unknown[]).length} Zeilen`;
	});
};

try {
	await smoke();
	console.log('MariaDB-Smoke bestanden.');
} catch (error) {
	console.error(`MariaDB-Smoke fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
}
