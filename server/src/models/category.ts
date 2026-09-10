import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';
import { CATEGORY_COLORS } from './categoryColors.js';

/**
 * Thematische Kategorie einer Aufgabe oder Serie — die **flache** Ordnungsebene neben den
 * Lebensbalance-Säulen. Anders als eine Säule trägt sie keinen Anteil und keine Konfidenz und
 * fließt in keine Berechnung ein (Wert, Score, Balance): Sie dient dem Gruppieren, Wiederfinden
 * und Filtern. Ein Datensatz hat höchstens **eine** Kategorie (0..1, `tasks.categoryId` /
 * `series.categoryId`), während er auf 0..n Säulen anteilig einzahlt.
 *
 * Nutzer-eigene Stammdaten wie die Säulen: gebunden über die nullbare `userId` (nullbar wegen des
 * Dev-Pass-Through-Modus ohne Login), Namen sind **pro Nutzer eindeutig**. Neue Konten starten
 * ohne Kategorien — es gibt bewusst keinen Seed-Bestand.
 */
class Category extends Model {
	public id!: number;
	public name!: string;
	public color!: string;
	public userId!: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Category.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING(40),
			allowNull: false,
			validate: {
				len: [1, 40],
			},
		},
		// Badge-Farbe aus der festen Palette (siehe categoryColors.ts). Als String gespeichert statt
		// als ENUM: eine spätere Palettenerweiterung bräuchte sonst eine Tabellen-Migration.
		color: {
			type: DataTypes.STRING(7),
			allowNull: false,
			defaultValue: CATEGORY_COLORS[0],
			validate: {
				isIn: [[...CATEGORY_COLORS]],
			},
		},
		// Eigentümer-Bindung analog `Pillar.userId` (#421): nullbar für den Pass-Through-Modus.
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Category',
		tableName: 'categories',
		timestamps: true,
		// Kategoriennamen sind pro Nutzer eindeutig (Muster `pillars_name_user_id`).
		indexes: [{ unique: true, fields: ['name', 'userId'], name: 'categories_name_user_id' }],
	},
);

export default Category;
