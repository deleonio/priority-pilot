import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/**
 * Vergebene Gamification-Punkte für einen erledigten Task (Konzept §4.4). Genau **eine** Zeile je
 * Task (`taskId` ist unique ⇒ Idempotenz: erneutes „Done" erzeugt keinen zweiten Eintrag).
 * `pünktlich` hält fest, ob der Task vor/zur Deadline erledigt wurde; `zeitpunkt` ist der
 * Erledigungszeitpunkt.
 */
class ScoreEntry extends Model {
	public id!: number;
	public taskId!: number;
	public punkte!: number;
	public pünktlich!: boolean;
	public zeitpunkt!: Date;
}

ScoreEntry.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		taskId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			unique: true,
		},
		punkte: {
			type: DataTypes.FLOAT,
			allowNull: false,
		},
		pünktlich: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
		},
		zeitpunkt: {
			type: DataTypes.DATE,
			allowNull: false,
		},
	},
	{
		sequelize,
		modelName: 'ScoreEntry',
		tableName: 'score_entries',
		timestamps: false,
	},
);

export default ScoreEntry;
