import { Sequelize } from 'sequelize';

const storage = process.env.DATABASE_STORAGE ?? './database.sqlite';

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage,
	logging: false,
	...(storage === ':memory:' ? { pool: { max: 1 } } : {}),
});

export default sequelize;
