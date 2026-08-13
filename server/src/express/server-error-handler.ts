import process from 'node:process';

/**
 * Fehler-Callback für `app.listen` (AK4 — Startup-Error-Handling #619): Bei einem Server-Start-Fehler
 * (insb. `EADDRINUSE` — belegter Port) wird der Fehler geloggt und der Prozess kontrolliert mit
 * Exit-Code 1 beendet.
 *
 * Bewusst in ein eigenes, logikfreies Modul ausgelagert: der Spec-Test kann die Funktion so direkt
 * aufrufen, ohne `express/index.ts` (und damit `src/logics`) importieren zu müssen — ein echter
 * `app.listen`-Versuch auf einen belegten Port würde die Test-Suite blockieren und ungenutzte Logik
 * in den Coverage-Scope ziehen.
 */
export const handleServerError = (error: NodeJS.ErrnoException, port: number): void => {
	console.error('Server-Start-Fehler:', error);
	if (error.code === 'EADDRINUSE') {
		console.error(`Port ${port} ist bereits belegt (EADDRINUSE)`);
	}
	process.exit(1);
};
