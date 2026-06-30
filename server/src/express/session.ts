import session from 'express-session';
import { dirname, basename } from 'node:path';

// Tracks disconnect callbacks per store so callers can clean up Redis connections.
const storeDisconnectors = new Map<session.Store, () => void>();

export async function createSessionStore(): Promise<session.Store> {
	const storeType = process.env.SESSION_STORE;

	if (storeType === 'redis') {
		if (!process.env.REDIS_URL) {
			throw new Error('REDIS_URL muss gesetzt sein wenn SESSION_STORE=redis verwendet wird');
		}
		const { createClient } = await import('redis');
		const { RedisStore } = await import('connect-redis');
		const client = createClient({ url: process.env.REDIS_URL });
		try {
			await client.connect();
		} catch (err) {
			client.disconnect();
			throw err;
		}
		const store = new RedisStore({ client });
		storeDisconnectors.set(store, () => client.disconnect());
		return store;
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

/** Disconnects the backing store connection (Redis) if one exists. No-op for SQLite/MemoryStore. */
export function disconnectStore(store: session.Store): void {
	const disconnect = storeDisconnectors.get(store);
	if (disconnect) {
		try {
			disconnect();
		} catch {
			// ignore errors during cleanup
		}
		storeDisconnectors.delete(store);
	}
}
