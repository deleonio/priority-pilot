import type { Server } from 'node:http';
import sequelize from '../database.js';
import { createApp, type AppDeps } from '../express/index.js';
import { createSessionStore, disconnectStore } from '../express/session.js';
// Import models to ensure associations are registered before sync
import '../models/index.js';

export const resetDb = async (): Promise<void> => {
	await sequelize.sync({ force: true });
};

export const closeDb = async (): Promise<void> => {
	// No-op: closing the Sequelize singleton prevents subsequent resetDb() calls in later
	// test suites from working (SQLITE_MISUSE: Database is closed). In-memory SQLite
	// connections are cleaned up on process exit, so there is nothing real to release here.
};

export interface TestServer {
	baseUrl: string;
	close: () => Promise<void>;
}

export const startTestServer = async (deps: AppDeps = {}): Promise<TestServer> => {
	// Respect injected store; only create (and own) a new one if none was provided.
	const sessionStore = deps.sessionStore ?? (await createSessionStore());
	const ownsStore = !deps.sessionStore;
	const app = createApp({ ...deps, sessionStore });
	return new Promise((resolve, reject) => {
		const server: Server = app.listen(0, () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				reject(new Error('Could not get server address'));
				return;
			}
			const baseUrl = `http://localhost:${addr.port}`;
			resolve({
				baseUrl,
				close: async () => {
					await new Promise<void>((res, rej) => {
						server.close((err) => {
							if (err && (err as Error & { code?: string }).code === 'ERR_SERVER_NOT_RUNNING') {
								res();
							} else if (err) {
								rej(err);
							} else {
								res();
							}
						});
					});
					if (ownsStore) disconnectStore(sessionStore);
				},
			});
		});
		server.on('error', reject);
	});
};
