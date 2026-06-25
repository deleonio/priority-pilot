// CI-Entrypoint des Modell-Routers (#153) — die schlanke Brücke zwischen dem Sonnet-
// Klassifikationsschritt der Composite-Action und dem deterministischen Vertrag in
// `model-router.ts`. Liest EIN Token (`haiku|sonnet|opus`) von stdin, läuft durch `resolveModel`
// und schreibt die Step-Outputs (`model`, `token`, `effort`) sowie das Logging (Job-Summary +
// `::notice::`). Bricht NIE hart ab (set -e-fest, Exit 0) — ungültiger Output fällt definiert auf
// das ausgewogene Default-Modell zurück.

import { appendFileSync } from 'node:fs';
import { resolveModel, type ModelDecision, type ModelToken } from './model-router.js';

// Effort-Kopplung (#153, M2/3): Das Komplexitäts-Token bestimmt zugleich die Reasoning-Tiefe, mit
// der die Workflows den Agent starten — trivial → low, Standard → medium, komplex → high.
export const EFFORT_IDS: Record<ModelToken, string> = {
	haiku: 'low',
	sonnet: 'medium',
	opus: 'high',
};

/** Die aufbereiteten CI-Ausgaben einer Router-Entscheidung. */
export interface RouterOutputs {
	/** Die Schlüssel-Werte für `$GITHUB_OUTPUT` (Step-Outputs der Composite-Action). */
	outputs: { model: string; token: ModelToken; effort: string };
	/** Markdown-Block für `$GITHUB_STEP_SUMMARY`. */
	summary: string;
	/** Einzeiler für `::notice::`. */
	notice: string;
}

/**
 * Reine, testbare Aufbereitung der Router-Entscheidung in die CI-Ausgaben. Trägt das gewählte
 * Modell, das Token, die gekoppelte Effort-Stufe sowie die Begründung + das Fallback-Flag.
 */
export const buildRouterOutputs = (raw: string | null | undefined): RouterOutputs => {
	const decision: ModelDecision = resolveModel(raw);
	const effort = EFFORT_IDS[decision.token];
	const flag = decision.fallback ? ' _(Fallback)_' : '';
	const summary = [
		'### Modell-Router',
		'',
		`- **Modell:** \`${decision.model}\`${flag}`,
		`- **Token:** \`${decision.token}\``,
		`- **Effort:** \`${effort}\``,
		`- **Fallback:** \`${decision.fallback}\``,
		`- **Begründung:** ${decision.reason}`,
	].join('\n');
	const notice = `Modell-Router: ${decision.model} (token=${decision.token}, effort=${effort}, fallback=${decision.fallback})`;
	return { outputs: { model: decision.model, token: decision.token, effort }, summary, notice };
};

/**
 * Schreibt Inhalt exit-fest an eine GitHub-Datei-Senke (`$GITHUB_OUTPUT`/`$GITHUB_STEP_SUMMARY`).
 * IO-Fehler (z. B. nicht beschreibbare Senke) werden defensiv geschluckt, damit ein Schreibfehler
 * einer Senke weder die übrigen Ausgaben noch die Exit-0-Garantie des Routers gefährdet.
 */
const appendToSink = (path: string | undefined, content: string): void => {
	if (!path) return;
	try {
		appendFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
	} catch (err) {
		console.error(`Modell-Router: Schreiben nach ${path} fehlgeschlagen — wird ignoriert.`, err);
	}
};

/** Liest stdin vollständig als UTF-8-String (leerer String, wenn nichts anliegt). */
const readStdin = async (): Promise<string> => {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
	return Buffer.concat(chunks).toString('utf8');
};

/** CLI-Lauf: Token von stdin → Step-Outputs + Logging. Bricht NIE hart ab (Exit 0). */
export const main = async (): Promise<void> => {
	const raw = await readStdin();
	const { outputs, summary, notice } = buildRouterOutputs(raw);
	appendToSink(process.env.GITHUB_OUTPUT, `model=${outputs.model}\ntoken=${outputs.token}\neffort=${outputs.effort}`);
	appendToSink(process.env.GITHUB_STEP_SUMMARY, summary);
	// Vollständige `::notice::`-Annotation (Modell + Token + Effort + Fallback) aus der EINEN Quelle
	// der Wahrheit (`buildRouterOutputs.notice`) — kein Re-Parsen von `$GITHUB_OUTPUT` in der Action.
	process.stdout.write(`::notice title=Modell-Router::${notice}\n`);
};

// Direktaufruf (als CLI-Entrypoint der Composite-Action), aber NICHT beim Import durch die Tests:
// Die Testdateien enden auf `*.test.ts`, der Entrypoint auf `entrypoint.ts`.
const invokedPath = process.argv[1] ?? '';
if (invokedPath.endsWith('entrypoint.ts') || invokedPath.endsWith('entrypoint.js')) {
	// Letztes Sicherheitsnetz für die Exit-0-Garantie (AK3): Selbst eine unerwartete Rejection (z. B.
	// stdin-Fehler) darf den Composite-Step unter `set -e` nicht auf Fehler laufen lassen.
	main().catch((err) => {
		console.error('Modell-Router: unerwarteter Fehler — fällt auf Exit 0 zurück.', err);
		process.exit(0);
	});
}
