import {
	BelongsToManyAddAssociationMixin,
	BelongsToManyGetAssociationsMixin,
	BelongsToManyRemoveAssociationMixin,
	DataTypes,
	Model,
} from 'sequelize';
import sequelize from '../database.js';
import Dependency from './dependency.js';

/** Mögliche Statuswerte einer Aufgabe */
export type TaskStatus = 'Open' | 'In process' | 'Done';

/**
 * Repräsentiert eine Aufgabe, die im System verwaltet wird.
 * Neben den eigentlichen Feldern stellt die Klasse auch Methoden
 * bereit, um Abhängigkeiten zwischen Aufgaben zu pflegen.
 */
class Task extends Model {
	/** Eindeutige ID der Aufgabe */
	public id!: number;
	/** Titel oder Kurzbeschreibung */
	public title!: string;
	/** Aktueller Bearbeitungsstatus */
	public status!: TaskStatus;
	/** Wichtigkeit im Vergleich zu anderen Aufgaben */
	public priority!: number;
	/** Geschätzter Zeitaufwand in Stunden */
	public estimatedEffort!: number;
	/** Tatsächlicher Zeitaufwand */
	public actualEffort?: number;
	/** Ausführliche Beschreibung der Aufgabe */
	public description?: string;
	/** Fälligkeitsdatum der Aufgabe */
	public deadline?: Date;

	/** Weitere Aufgaben als Abhängigkeit verknüpfen */
	public addDependency!: BelongsToManyAddAssociationMixin<Task, number>;
	/** Eine bestehende Abhängigkeit entfernen */
	public removeDependency!: BelongsToManyRemoveAssociationMixin<Task, number>;
	/** Alle abhängigen Aufgaben abrufen */
	public getDependencies!: BelongsToManyGetAssociationsMixin<Task>;

	/** Task wird abhängig von einem anderen gemacht */
	public addDependent!: BelongsToManyAddAssociationMixin<Task, number>;
	/** Abhängigkeit zu einem anderen Task lösen */
	public removeDependent!: BelongsToManyRemoveAssociationMixin<Task, number>;
	/** Alle Tasks abrufen, die von diesem abhängen */
	public getDependents!: BelongsToManyGetAssociationsMixin<Task>;

	/** Zwischentabelle mit zusätzlichen Infos zur Abhängigkeit */
	public Dependency!: Dependency;

	/** Erstellungszeitpunkt */
	public readonly createdAt!: Date;
	/** Letzte Aktualisierung */
	public readonly updatedAt!: Date;
}

Task.init(
	{
		id: {
			// Primärschlüssel der Tabelle
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		title: {
			// Titel oder Kurzbeschreibung
			type: DataTypes.STRING,
			allowNull: false,
		},
		status: {
			// Mögliche Statuswerte
			type: DataTypes.ENUM('Open', 'In process', 'Done'),
			allowNull: false,
			defaultValue: 'Open',
		},
		priority: {
			// Wichtigkeit auf einer Skala
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 3,
		},
		estimatedEffort: {
			// Geschätzter Zeitaufwand in Stunden
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0.5,
			validate: {
				min: 0.1,
			},
		},
		actualEffort: {
			// Tatsächlich benötigte Zeit
			type: DataTypes.FLOAT,
			allowNull: true,
		},
		description: {
			// Ausführliche Beschreibung
			type: DataTypes.TEXT,
			allowNull: true,
		},
		deadline: {
			// Fälligkeitsdatum
			type: DataTypes.DATE,
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
