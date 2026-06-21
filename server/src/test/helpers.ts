import type { Server } from 'node:http';
import sequelize from '../database.js';
import { createApp, type AppDeps } from '../express/index.js';
// Import models to ensure associations are registered before sync
import '../models/index.js';

export const resetDb = async (): Promise<void> => {
	await sequelize.sync({ force: true });
};

export const closeDb = async (): Promise<void> => {
	await sequelize.close();
};

export interface TestServer {
	baseUrl: string;
	close: () => Promise<void>;
}

export const startTestServer = (deps: AppDeps = {}): Promise<TestServer> => {
	return new Promise((resolve, reject) => {
		const app = createApp(deps);
		const server: Server = app.listen(0, () => {
			const addr = server.address();
			if (!addr || typeof addr === 'string') {
				reject(new Error('Could not get server address'));
				return;
			}
			const baseUrl = `http://localhost:${addr.port}`;
			resolve({
				baseUrl,
				close: () =>
					new Promise<void>((res, rej) => {
						server.close((err) => (err ? rej(err) : res()));
					}),
			});
		});
		server.on('error', reject);
	});
};
