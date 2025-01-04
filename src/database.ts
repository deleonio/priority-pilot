import { Sequelize } from 'sequelize';

// Verbindung zur SQLite-Datenbank herstellen
const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: './database.sqlite',
	logging: false, // Deaktiviere SQL-Logs im Terminal
});

export default sequelize;
