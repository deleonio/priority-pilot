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
 * Prompt gegeben (siehe `llm/mistral.ts`) und kalibrieren so die generischen Vermutungen — adressiert
 * besonders die schwer ableitbaren Säulen „Sinn" und „Mentale Gesundheit" aus #39.
 *
 * Es gibt (noch) kein Nutzerkonzept im Modell → das Feedback ist **global** (Single-User-Annahme).
 * `pillars` hält die bestätigten Beiträge als JSON-Array (`{ pillarId, confidence }`); `share` ist
 * für die Klassifikation irrelevant und wird daher nicht gespeichert.
 */
class PillarFeedback extends Model {
	public id!: number;
	public title!: string;
	public description!: string | null;
	public pillars!: FeedbackPillar[];

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
	},
	{
		sequelize,
		modelName: 'PillarFeedback',
		tableName: 'pillar_feedback',
		timestamps: true,
	},
);

export default PillarFeedback;
