import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base } from '@playwright/test';

/**
 * Server-Basis der E2E-Suite: **ein eigenes Backend und ein eigener Vite-Server je Playwright-
 * Worker**.
 *
 * **Warum nicht `webServer` in playwright.config.ts (Stand bis #1364):** Dort startet Playwright
 * genau EIN Backend mit EINER In-Memory-DB für den ganzen Lauf. Alle Specs teilen sich damit
 * denselben Datenbestand, weshalb die Suite auf `workers: 1` festgenagelt war — parallele Worker
 * hätten sich gegenseitig die Daten unter den Füßen weggezogen. Die Folge: Ein Shard nutzt genau
 * einen Kern eines Vier-Kern-Läufers, und die einzige Stellschraube für die Wandzeit war, immer
 * mehr Shards (= Läufer) zu starten. Mit einem Server-Satz je Worker skaliert stattdessen der
 * einzelne Shard.
 *
 * **Isolation:** Jeder Worker bekommt seinen eigenen Backend-Prozess mit eigener `:memory:`-DB;
 * `fullyParallel: false` hält Tests EINER Datei weiterhin in Reihenfolge im selben Worker. Was
 * sich ändert: Specs verschiedener Dateien sehen sich jetzt NICHT mehr in der DB. Ein Spec, der
 * sich stillschweigend auf Daten eines vorher gelaufenen Specs verlassen hat, fällt dadurch auf —
 * das ist gewollt.
 *
 * **Ports:** `parallelIndex` (0…workers-1), nicht `workerIndex` — letzterer wächst bei jedem
 * Worker-Neustart weiter und würde die Ports ins Leere laufen lassen. Die Basen liegen bewusst
 * neben den Entwicklungs-Ports (3000/4173), damit ein lokal laufendes `pnpm dev` die Suite nicht
 * stört und umgekehrt.
 *
 * **Backend-Start:** `node dist/index.js` gegen den in `globalSetup` EINMAL erzeugten Build.
 * Früher baute jeder Shard beim Serverstart selbst (`nodemon` exec `pnpm build && …`); mit
 * mehreren Workern je Shard würden diese Builds ins selbe `server/dist` schreiben und sich
 * gegenseitig zerlegen.
 */

const BACKEND_PORT_BASE = 3100;
const FRONTEND_PORT_BASE = 4200;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const serverDir = resolve(repoRoot, 'server');
const frontendDir = resolve(repoRoot, 'frontend');

export type WorkerServers = {
	backendPort: number;
	frontendPort: number;
	baseURL: string;
};

/**
 * Backend-Umgebung. Inhaltlich unverändert aus der früheren `webServer`-Konfiguration
 * übernommen — die Begründungen zu den leeren Strings stehen dort ausführlich und gelten
 * unverändert: Google-Credentials und LLM-Keys aus einer lokalen `server/.env` würden sonst
 * Auth-Gate bzw. Provider-Fallbacks scharfschalten.
 */
const backendEnv = (port: number): NodeJS.ProcessEnv => ({
	...process.env,
	PORT: String(port),
	DB_RESET: 'true',
	DB_SEED: 'false',
	DATABASE_STORAGE: ':memory:',
	// NODE_ENV=test registriert zusätzlich POST /auth/test-login (server/src/express/routes/auth.ts).
	NODE_ENV: 'test',
	GOOGLE_CLIENT_ID: '',
	GOOGLE_CLIENT_SECRET: '',
	GOOGLE_ALLOWED_EMAILS: '',
	GOOGLE_ALLOWED_EMAIL: '',
	MISTRAL_API_KEY: '',
	OPENROUTER_API_KEY: '',
	MISTRAL_MODEL: '',
	OPENROUTER_MODEL: '',
});

const waitForHttp = async (url: string, timeoutMs: number, label: string): Promise<void> => {
	const deadline = Date.now() + timeoutMs;
	let lastError = '';
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
			lastError = `HTTP ${res.status}`;
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
		}
		await new Promise((r) => setTimeout(r, 250));
	}
	throw new Error(`${label} wurde unter ${url} nicht bereit (${timeoutMs} ms, zuletzt: ${lastError}).`);
};

const stop = async (child: ChildProcess): Promise<void> => {
	if (child.exitCode !== null || child.signalCode !== null) return;
	const ended = new Promise<void>((r) => child.once('exit', () => r()));
	// Prozessgruppe killen (detached: true beim Start): Vite und der Server starten Kindprozesse,
	// ein SIGTERM nur an den Elternteil ließe den Port belegt zurück.
	try {
		process.kill(-child.pid!, 'SIGTERM');
	} catch {
		child.kill('SIGTERM');
	}
	await Promise.race([ended, new Promise((r) => setTimeout(r, 5000))]);
};

// Erster Typparameter = zusaetzliche TEST-Fixtures (keine; `baseURL` ist bereits eine
// Playwright-Option und wird hier nur ueberschrieben), zweiter = WORKER-Fixtures.
// `Record<never, never>` statt `Record<string, never>`: Letzteres zoge eine Index-Signatur ein,
// die jede ueberschriebene Fixture auf `never` zwaenge.
export const test = base.extend<Record<never, never>, { servers: WorkerServers }>({
	servers: [
		// `runTest` statt `use`: Sonst haelt die `react-hooks/rules-of-hooks`-Heuristik den Aufruf
		// fuer einen React-Hook (gleiches Muster wie in fixtures.ts).
		// Das leere `{}` ist PFLICHT und kein Versehen: Playwright liest die Abhaengigkeiten einer
		// Fixture aus der Destrukturierung des ersten Parameters und lehnt einen benannten
		// Parameter zur Laufzeit ab ("First argument must use the object destructuring pattern").
		// eslint-disable-next-line no-empty-pattern
		async ({}, runTest, workerInfo) => {
			const backendPort = BACKEND_PORT_BASE + workerInfo.parallelIndex;
			const frontendPort = FRONTEND_PORT_BASE + workerInfo.parallelIndex;

			const backend = spawn('node', ['dist/index.js'], {
				cwd: serverDir,
				env: backendEnv(backendPort),
				stdio: 'ignore',
				detached: true,
			});
			// `/tasks` als Bereitschafts-URL: liefert HTTP 200 mit leerer Liste, während `/` keine
			// Route hat und mit 404 antworten würde.
			await waitForHttp(
				`http://localhost:${backendPort}/tasks`,
				60_000,
				`Backend (Worker ${workerInfo.parallelIndex})`,
			);

			const frontend = spawn('pnpm', ['exec', 'vite', '--port', String(frontendPort), '--strictPort'], {
				cwd: frontendDir,
				// API_PROXY_TARGET existiert bereits (Browser-MCP-Setup, docs/browser-mcp.md) und
				// zeigt den Vite-Proxy auf genau das Backend DIESES Workers.
				env: { ...process.env, API_PROXY_TARGET: `http://localhost:${backendPort}` },
				stdio: 'ignore',
				detached: true,
			});
			await waitForHttp(`http://localhost:${frontendPort}`, 60_000, `Vite (Worker ${workerInfo.parallelIndex})`);

			await runTest({ backendPort, frontendPort, baseURL: `http://localhost:${frontendPort}` });

			await Promise.all([stop(frontend), stop(backend)]);
		},
		{ scope: 'worker' },
	],

	// Playwrights `baseURL`-Option je Worker umbiegen — `use.baseURL` in der Config kennt die
	// Worker-Nummer nicht und bliebe bei einem festen Port stehen.
	baseURL: async ({ servers }, runTest) => {
		await runTest(servers.baseURL);
	},
});

export { expect, type Page } from '@playwright/test';
