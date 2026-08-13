/**
 * Issue 611: CI Fortschrittsmetrik
 * Spec: docs/spec/issue-611.md
 *
 * Reproduzierbare Metrik für "Fortschritt im CI-Lauf" basierend auf HEAD-Bewegung
 * seit Run-Start (Anzahl der Commits zwischen base und HEAD).
 */

/**
 * Standard Git-Executor mit `child_process.exec`.
 */
const defaultGitExecutor = async (cmd: string): Promise<string> => {
	const { exec } = await import('node:child_process');
	return new Promise((resolve, reject) => {
		exec(cmd, (error, stdout) => {
			if (error) reject(error);
			else resolve(stdout.trim());
		});
	});
};

/**
 * Git-Fehler bei der Fortschrittsberechnung.
 */
export class ProgressMetricError extends Error {
	constructor(
		message: string,
		public cause?: unknown,
	) {
		super(message);
		this.name = 'ProgressMetricError';
	}
}

/**
 * Berechnet die Fortschrittsmetrik: Anzahl der Commits zwischen baseRef und currentHead.
 *
 * Führt `git rev-list --count base..HEAD` aus. Git-Fehler werden propagiert.
 *
 * @param baseRef Git-Ref beim Start des CI-Laufs (z.B. Commit-SHA oder Branch)
 * @param currentHead Aktuelle Git-Ref (z.B. HEAD)
 * @param gitExec Optionaler Git-Executor (Dependency Injection für Tests)
 * @returns Anzahl der Commits seit Start (≥ 0)
 * @throws ProgressMetricError bei Git-Fehlern oder ungültiger Output
 */
export const calculateProgressMetric = async (
	baseRef: string,
	currentHead: string,
	gitExec?: (cmd: string) => Promise<string>,
): Promise<number> => {
	const exec = gitExec ?? defaultGitExecutor;

	const cmd = `git rev-list --count ${baseRef}..${currentHead}`;
	const result = await exec(cmd);

	// Explizite Validierung: Output muss ein gültiger Integer sein
	const parsed = parseInt(result, 10);
	if (isNaN(parsed) || parsed < 0) {
		throw new ProgressMetricError(`Git rev-list output ist keine gültige nicht-negative Zahl: "${result}"`);
	}

	return parsed;
};

/**
 * Prüft, ob "no progress" vorliegt: 0 Commits in 2+ aufeinanderfolgenden Läufen.
 *
 * @param metrics Array von Fortschrittsmetriken aus mehreren CI-Läufen
 * @returns true wenn keine Fortschritt-Bewegung (≥2 Läufe mit 0 und kein Lauf mit >0)
 */
export const checkNoProgressThreshold = (metrics: number[]): boolean => {
	if (metrics.length === 0) return false;

	// No progress nur wenn: (a) mind. 2 Läufe mit 0 UND (b) kein einziger Lauf mit >0
	const zeroRuns = metrics.filter((m) => m === 0).length;
	const hasProgress = metrics.some((m) => m > 0);
	return zeroRuns >= 2 && !hasProgress;
};
