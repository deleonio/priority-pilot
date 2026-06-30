import session from 'express-session';
import { dirname, basename } from 'node:path';

export async function createSessionStore(): Promise<session.Store> {
	const storeType = process.env.SESSION_STORE;

	if (storeType === 'redis') {
		const { createClient } = await import('redis');
		const { RedisStore } = await import('connect-redis');
		const client = createClient({ url: process.env.REDIS_URL });
		await client.connect();
		return new RedisStore({ client }) as unknown as session.Store;
	}

	if (storeType === 'sqlite') {
		const connectSqlite3 = (await import('connect-sqlite3')).default;
		const SqliteStore = connectSqlite3(session);
		const dbPath = process.env.SESSION_DB_PATH ?? 'sessions.db';
		const dir = dirname(dbPath);
		const db = basename(dbPath);
		return new SqliteStore({ db, dir }) as unknown as session.Store;
	}

	return new session.MemoryStore();
}
