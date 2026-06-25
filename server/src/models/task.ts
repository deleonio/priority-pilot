import {
	BelongsToManyAddAssociationMixin,
	BelongsToManyGetAssociationsMixin,
	BelongsToManyRemoveAssociationMixin,
	BelongsToManySetAssociationsMixin,
	DataTypes,
	Model,
} from 'sequelize';
import sequelize from '../database.js';
import Dependency from './dependency.js';
import Pillar from './pillar.js';
import TaskPillar from './taskPillar.js';

export type TaskStatus = 'Open' | 'In process' | 'Done';

/** Eine Säule samt der zugehörigen Join-Zeile (`share`/`confidence`), wie sie `getPillars()` liefert. */
export type PillarWithContribution = Pillar & { TaskPillar: TaskPillar };

class Task extends Model {
	public id!: number;
	public title!: string;
	public status!: TaskStatus;
	public priority!: number;
	public estimatedEffort!: number;
	public actualEffort?: number | null;
	public description?: string | null;
	public deadline?: Date | null;

	// Serien-Verknüpfung (siehe models/series.ts): `seriesId` zeigt auf die Vorlage, `seriesOccurrence`
	// ist der Idempotenz-Anker des Termins (Periodendatum), `isException` markiert eine vom Nutzer
	// abweichend bearbeitete Instanz (Status-/Deadline-Override, siehe routes/tasks.ts, AC2).
	public seriesId?: number | null;
	public isException!: boolean;
	public seriesOccurrence?: Date | null;

	public addDependency!: BelongsToManyAddAssociationMixin<Task, number>;
	public removeDependency!: BelongsToManyRemoveAssociationMixin<Task, number>;
	public getDependencies!: BelongsToManyGetAssociationsMixin<Task>;

	public addDependent!: BelongsToManyAddAssociationMixin<Task, number>;
	public removeDependent!: BelongsToManyRemoveAssociationMixin<Task, number>;
	public getDependents!: BelongsToManyGetAssociationsMixin<Task>;

	// Säulen-Beiträge (n:m über `task_pillars`); die Join-Zeile trägt `share`/`confidence`.
	public getPillars!: BelongsToManyGetAssociationsMixin<PillarWithContribution>;
	public setPillars!: BelongsToManySetAssociationsMixin<Pillar, number>;
	public addPillar!: BelongsToManyAddAssociationMixin<Pillar, number>;
	/** Eager-geladene Säulen-Beiträge (über `include: [Pillar]`); je Eintrag mit `TaskPillar`. */
	public Pillars?: PillarWithContribution[];

	public Dependency!: Dependency;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

Task.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		title: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		status: {
			type: DataTypes.ENUM('Open', 'In process', 'Done'),
			allowNull: false,
			defaultValue: 'Open',
		},
		priority: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 3,
			validate: {
				min: 1,
				max: 5,
			},
		},
		estimatedEffort: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0.5,
			validate: {
				min: 0.1,
				max: 1,
			},
		},
		actualEffort: {
			type: DataTypes.FLOAT,
			allowNull: true,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		deadline: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		// Serien-Spalten (#141): Verknüpfung auf die Vorlage (`seriesId`), Idempotenz-Anker des
		// Termins (`seriesOccurrence`) und Override-Markierung (`isException`).
		seriesId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		isException: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		seriesOccurrence: {
			type: DataTypes.DATE,
			allowNull: true,
		},
		// Die Säulen-Zuordnung ist n:m und liegt in `task_pillars` (siehe taskPillar.ts /
		// models/index.ts) — daher keine `pillarId`-Spalte mehr direkt am Task.
	},
	{
		sequelize,
		modelName: 'Task',
		tableName: 'tasks',
		timestamps: true,
	},
);

export default Task;
