import { Sequelize, type Options } from 'sequelize';

/**
 * Baut die Sequelize-Optionen rein aus dem übergebenen Env (#2825): Default und
 * `DB_DIALECT=sqlite` nutzen die SQLite-Datei (`DATABASE_STORAGE`, `:memory:` → Ein-Pool),
 * `DB_DIALECT=mysql` verbindet gegen MariaDB (ADR 0026, Treiber mysql2) mit Zugangsdaten aus der
 * Env, expliziter UTC-Zeitzone und Pool. Ein anderer Dialekt-Wert scheitert hier mit klarer
 * Meldung statt irgendwo in Sequelize.
 */
export const buildDatabaseOptions = (env: NodeJS.ProcessEnv): Options => {
	const dialect = env.DB_DIALECT || 'sqlite';
	if (dialect !== 'sqlite' && dialect !== 'mysql') {
		throw new Error(`Ungültiger DB_DIALECT '${dialect}' — erlaubt sind 'sqlite' (Default) und 'mysql'`);
	}
	if (dialect === 'mysql') {
		return {
			dialect: 'mysql',
			host: env.MARIADB_HOST,
			port: Number(env.MARIADB_PORT ?? '3306'),
			username: env.MARIADB_USER,
			password: env.MARIADB_PASSWORD,
			database: env.MARIADB_DATABASE,
			timezone: '+00:00',
			logging: false,
			pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
		};
	}
	const storage = env.DATABASE_STORAGE ?? './database.sqlite';
	return {
		dialect: 'sqlite',
		storage,
		logging: false,
		...(storage === ':memory:' ? { pool: { max: 1 } } : {}),
	};
};

const sequelize = new Sequelize(buildDatabaseOptions(process.env));

export default sequelize;
