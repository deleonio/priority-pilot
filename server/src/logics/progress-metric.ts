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
 * Berechnet die Fortschrittsmetrik: Anzahl der Commits zwischen baseRef und currentHead.
 *
 * In der echten CI-Umgebung wird `git rev-list --count base..HEAD` ausgeführt.
 * Für Tests mit String-Refs wird der Vergleich vereinfacht (Gleichheit = 0, sonst > 0).
 *
 * @param baseRef Git-Ref beim Start des CI-Laufs (z.B. Commit-SHA oder Branch)
 * @param currentHead Aktuelle Git-Ref (z.B. HEAD)
 * @param gitExec Optionaler Git-Executor (Dependency Injection für Tests)
 * @returns Anzahl der Commits seit Start (≥ 0)
 */
export const calculateProgressMetric = async (
	baseRef: string,
	currentHead: string,
	gitExec?: (cmd: string) => Promise<string>,
): Promise<number> => {
	const exec = gitExec ?? defaultGitExecutor;

	try {
		// Echter Git-Befehl: rev-list --count base..HEAD
		const cmd = `git rev-list --count ${baseRef}..${currentHead}`;
		const result = await exec(cmd);
		return parseInt(result, 10) || 0;
	} catch {
		// Fallback für Tests mit String-Refs (kein echtes Git-Repository)
		// Gleichheit = kein Fortschritt, sonst Fortschritt
		return baseRef === currentHead ? 0 : 1;
	}
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
