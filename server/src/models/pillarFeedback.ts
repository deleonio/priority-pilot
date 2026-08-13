import { DataTypes, Model } from 'sequelize';
import sequelize from '../database.js';

/** Eine vom Nutzer bestätigte/korrigierte Säulen-Einzahlung (Ground Truth): Säulen-ID + Konfidenz. */
interface FeedbackPillar {
	pillarId: number;
	confidence: number;
}

/**
 * Persistierte Nutzer-Korrektur eines Säulen-Vorschlags (Feedback-Loop, siehe #45). Bestätigt oder
 * korrigiert der Nutzer im Task-Dialog die KI-Vorschläge und speichert den Task, wird daraus ein
 * Feedback-Sample abgelegt: der eingegebene Titel/Beschreibung samt der **final gewählten** Säulen.
 *
 * Die jüngsten Samples werden bei späteren Klassifikationen als zusätzliche Few-Shot-Beispiele in den
 * Prompt gegeben (siehe `llm/llm.ts`) und kalibrieren so die generischen Vermutungen — adressiert
 * besonders die schwer ableitbaren Säulen „Sinn" und „Mentale Gesundheit" aus #39.
 *
 * Seit #430 ist jedes Feedback **pro Nutzer** isoliert: `userId` bindet das Sample an den anfragenden
 * Nutzer, und `loadFeedbackExamples` lädt nur noch die Korrekturen desselben Nutzers. Vorher war das
 * Feedback global (Single-User-Annahme); bestehende Zeilen bleiben über die nullbare Spalte erhalten.
 * `pillars` hält die bestätigten Beiträge als JSON-Array (`{ pillarId, confidence }`); `share` ist
 * für die Klassifikation irrelevant und wird daher nicht gespeichert.
 */
class PillarFeedback extends Model {
	public id!: number;
	public title!: string;
	public description!: string | null;
	public pillars!: FeedbackPillar[];
	/** Eigentümer-Bindung (#430): nullbar für Abwärtskompatibilität mit historischen globalen Samples. */
	public userId!: number | null;

	public readonly createdAt!: Date;
	public readonly updatedAt!: Date;
}

PillarFeedback.init(
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
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		pillars: {
			type: DataTypes.JSON,
			allowNull: false,
			defaultValue: [],
		},
		// Eigentümer-Bindung (#430): nullbar für Abwärtskompatibilität mit historischen globalen
		// Samples. Neue Feedback-Zeilen werden pro Nutzer mit gesetzter userId angelegt.
		userId: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
	},
	{
		sequelize,
		modelName: 'PillarFeedback',
		tableName: 'pillar_feedback',
		timestamps: true,
	},
);

export default PillarFeedback;
