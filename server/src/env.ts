import { fileURLToPath } from 'node:url';

/**
 * Lädt lokale Umgebungsvariablen aus einer `.env`-Datei in `process.env`, **bevor** andere Module
 * sie auslesen (z. B. `MISTRAL_API_KEY` in {@link ../llm/mistral.ts}). Ohne diesen Schritt würde ein
 * lokal in `.env` hinterlegter Schlüssel nie gelesen — der Endpoint `POST /tasks/suggest-pillars`
 * antwortet dann mit HTTP 503 („MISTRAL_API_KEY ist nicht gesetzt …"), obwohl der Key vorliegt.
 *
 * Genutzt wird die native Node-Funktion `process.loadEnvFile` (stabil ab Node 22, siehe
 * conventions.md „Node >= 22") — **keine** zusätzliche Abhängigkeit nötig. Der Pfad wird explizit
 * relativ zu diesem Modul aufgelöst (`server/.env`), damit das Start-Arbeitsverzeichnis egal ist:
 * `dist/env.js` → `dist/../.env` = `server/.env`. So findet auch `node server/dist/index.js` aus dem
 * Repo-Root die Datei.
 *
 * In Umgebungen **ohne** `.env` (CI-Tests, Deployment mit echten Umgebungs-Secrets) existiert die
 * Datei nicht; der dabei geworfene `ENOENT`-Fehler wird bewusst verschluckt. Jeder **andere** Fehler
 * (z. B. unlesbare oder fehlerhaft formatierte `.env`) wird dagegen sichtbar gemacht — sonst kehrte
 * still der verwirrende 503 zurück, den dieser Fix gerade diagnostizierbar machen soll. Bereits
 * gesetzte echte Umgebungsvariablen bleiben so oder so maßgeblich.
 */
const loadEnv = (): void => {
	const envPath = fileURLToPath(new URL('../.env', import.meta.url));
	try {
		process.loadEnvFile(envPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
			console.warn(`Konnte ${envPath} nicht laden:`, error);
		}
		// ENOENT: Keine `.env` vorhanden (CI/Deployment) — echte Umgebungsvariablen genügen.
	}
};

loadEnv();
