import session from 'express-session';
import { dirname, basename } from 'node:path';

export async function createSessionStore(): Promise<session.Store> {
	const storeType = process.env.SESSION_STORE;

	if (storeType === 'redis') {
		if (!process.env.REDIS_URL) {
			throw new Error('REDIS_URL muss gesetzt sein wenn SESSION_STORE=redis verwendet wird');
		}
		const { createClient } = await import('redis');
		const { RedisStore } = await import('connect-redis');
		const client = createClient({ url: process.env.REDIS_URL });
		await client.connect();
		return new RedisStore({ client });
	}

	if (storeType === 'sqlite') {
		const connectSqlite3 = (await import('connect-sqlite3')).default;
		const SqliteStore = connectSqlite3(session);
		const dbPath = process.env.SESSION_DB_PATH ?? 'sessions.db';
		const dir = dirname(dbPath);
		const db = basename(dbPath);
		// connect-sqlite3 SQLiteStore signature ist nicht strukturell identisch zu express-session.Store in dieser TS-Version
		return new SqliteStore({ db, dir }) as session.Store;
	}

	if (process.env.NODE_ENV === 'production') {
		throw new Error('SESSION_STORE muss in Produktion gesetzt sein (sqlite oder redis)');
	}

	return new session.MemoryStore();
}
