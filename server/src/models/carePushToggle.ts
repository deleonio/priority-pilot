import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Verlauf des Schalters „Fürsorge-Hinweise“ (`User.carePushEnabled`, #1798 AK5): ein Eintrag je
 * tatsächlichem Wechsel über `PUT /care-config`. Die Wirkungs-Auswertung (`logics/careWirkung.ts`)
 * ordnet Nutzer damit dem Push-Stand in ihrer Zielwoche zu.
 */
class CarePushToggle extends Model {
	public id!: number;
	public userId!: number;
	public aktiv!: boolean;
	public geaendertAm!: Date;
}

CarePushToggle.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		aktiv: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		geaendertAm: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'CarePushToggle',
		tableName: 'care_push_toggles',
		timestamps: false,
	},
);

export default CarePushToggle;
