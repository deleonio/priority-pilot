import {
	BelongsToManyAddAssociationMixin,
	BelongsToManyGetAssociationsMixin,
	BelongsToManyRemoveAssociationMixin,
	DataTypes,
	Model,
} from 'sequelize';
import sequelize from '../database.js';
import Dependency from './dependency.js';

export type TaskStatus = 'Open' | 'In process' | 'Done';

class Task extends Model {
	public id!: number;
	public title!: string;
	public status!: TaskStatus;
	public priority!: number;
	public estimatedEffort!: number;
	public actualEffort?: number | null;
	public description?: string | null;
	public deadline?: Date | null;
	public pillarId?: number | null;

	public addDependency!: BelongsToManyAddAssociationMixin<Task, number>;
	public removeDependency!: BelongsToManyRemoveAssociationMixin<Task, number>;
	public getDependencies!: BelongsToManyGetAssociationsMixin<Task>;

	public addDependent!: BelongsToManyAddAssociationMixin<Task, number>;
	public removeDependent!: BelongsToManyRemoveAssociationMixin<Task, number>;
	public getDependents!: BelongsToManyGetAssociationsMixin<Task>;

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
		},
		estimatedEffort: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0.5,
			validate: {
				min: 0.1,
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
		// Zuordnung zu einer Lebensbalance-Säule. Zunächst nullable, damit Bestands-Tasks
		// ohne Säule gültig bleiben (siehe Beziehung in models/index.ts).
		pillarId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'Task',
		tableName: 'tasks',
		timestamps: true,
	},
);

export default Task;
