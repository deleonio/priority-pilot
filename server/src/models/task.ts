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

type TaskStatus = 'Open' | 'In process' | 'Done';

/** Eine Säule samt der zugehörigen Join-Zeile (`share`/`confidence`), wie sie `getPillars()` liefert. */
export type PillarWithContribution = Pillar & { TaskPillar: TaskPillar };

/** Eintrag einer abhakbaren Task-Checkliste (#531): stabile UUID, nicht-leerer Titel, Erledigt-Flag. */
export interface ChecklistItem {
	id: string;
	title: string;
	completed: boolean;
}

class Task extends Model {
	public id!: number;
	public title!: string;
	public status!: TaskStatus;
	public priority!: number;
	public estimatedEffort!: number;
	public actualEffort?: number | null;
	public description?: string | null;
	public deadline?: Date | null;
	// Auto-Löschung bei verpasster Deadline (Issue #523): löst der Cron-Trigger die Aufgabe 3 Tage nach
	// Ablauf der Deadline, wenn sie nicht erledigt ist. Default `false` (kein automatischer Eingriff).
	public autoDeleteAfterDeadline!: boolean;

	// Abhakbare Checkliste (Issue #531): JSON-Array aus `{ id, title, completed }`. Default leer;
	// bestehende Tasks ohne Checkliste liefern `[]` (rückwärtskompatibel).
	public checklist!: ChecklistItem[];

	// Serien-Bezug (Habits, siehe #120): `seriesId` verweist auf das Template, aus dem diese Instanz
	// generiert wurde (`null` ⇒ gewöhnlicher Einzel-Task, oder nachdem die Serie gelöscht wurde).
	// `isException` markiert eine nachträglich individuell geänderte Instanz; `seriesOccurrence` ist
	// der unveränderliche Idempotenz-Anker des fälligen Termins (NICHT `deadline`, die verschiebbar ist).
	public seriesId?: number | null;
	public isException!: boolean;
	public seriesOccurrence?: Date | null;
	// Provenienz (#553): dauerhafte, FK-freie Spalte, die beim Generieren einmalig auf `series.id`
	// gesetzt wird und NIE wieder geändert wird — auch nicht beim Löschen der Serie. Während `seriesId`
	// die Live-Verbindung zur (ggf. zwischenzeitlich gelöschten) Serie hält und beim Abkoppeln auf null
	// fällt, bleibt `originSeriesId` als Herkunftsnachweis erhalten. Ermöglicht z. B. „alle Tasks aus
	// Serie X" oder „unerledigte Tasks einer gelöschten Serie aufräumen", OHNE eine dangling FK-Referenz
	// zu hinterlassen. `null` ⇒ nie Teil einer Serie gewesen.
	public originSeriesId?: number | null;

	// Eigentümer des Tasks (Issue #207, AK5 — Datenisolation). Nullable für Abwärtskompatibilität:
	// Alt-Bestände ohne Zuordnung bleiben lesbar; neue Tasks werden über die Session-`userId` gebunden.
	public userId?: number | null;

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
			type: DataTypes.STRING(30),
			allowNull: false,
			validate: {
				len: [1, 30],
			},
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
		// Auto-Löschung bei verpasster Deadline (Issue #523). Default `false`, damit bestehende Aufgaben
		// ohne gesetzte Option nicht still gelöscht werden.
		autoDeleteAfterDeadline: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		// Abhakbare Checkliste (Issue #531): als JSON-Array gespeichert; Default `[]` für
		// Rückwärtskompatibilität (bestehende Tasks bleiben ohne Einträge).
		checklist: {
			type: DataTypes.JSON,
			allowNull: false,
			defaultValue: [],
		},
		// Serien-Instanz-Felder (siehe #120). Der eindeutige Idempotenz-Index liegt auf
		// (`seriesId`, `seriesOccurrence`) — eine Periode wird je Serie höchstens einmal materialisiert.
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
		// Provenienz (#553) — FK-frei: nur Daten, keine referenzielle Integrität (Serie kann gelöscht
		// sein). Nullable für alle Tasks, die nie aus einer Serie generiert wurden.
		originSeriesId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		// Eigentümer-Bindung (Issue #207, AK5). `null` erlaubt (Abwärtskompatibilität, s. o.).
		userId: {
			type: DataTypes.INTEGER,
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
		indexes: [
			// Idempotenz (#120 AK4): je Serie wird ein fälliger Termin höchstens einmal materialisiert.
			{ unique: true, fields: ['seriesId', 'seriesOccurrence'] },
		],
	},
);

export default Task;
