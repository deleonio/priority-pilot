/**
 * Lädt lokale Umgebungsvariablen aus einer `.env`-Datei in `process.env`, **bevor** andere Module
 * sie auslesen (z. B. `MISTRAL_API_KEY` in {@link ../llm/mistral.ts}). Ohne diesen Schritt würde ein
 * lokal in `.env` hinterlegter Schlüssel nie gelesen — der Endpoint `POST /tasks/suggest-pillars`
 * antwortet dann mit HTTP 503 („MISTRAL_API_KEY ist nicht gesetzt …"), obwohl der Key vorliegt.
 *
 * Genutzt wird die native Node-Funktion `process.loadEnvFile` (stabil ab Node 22, siehe
 * conventions.md „Node >= 22") — **keine** zusätzliche Abhängigkeit nötig. Die Datei wird relativ
 * zum aktuellen Arbeitsverzeichnis (`server/`) erwartet.
 *
 * In Umgebungen **ohne** `.env` (CI-Tests, Deployment mit echten Umgebungs-Secrets) existiert die
 * Datei nicht; der dabei geworfene Fehler wird bewusst verschluckt. Bereits gesetzte echte
 * Umgebungsvariablen bleiben so oder so maßgeblich.
 */
const loadEnv = (): void => {
	try {
		process.loadEnvFile();
	} catch {
		// Keine `.env` vorhanden (CI/Deployment) — echte Umgebungsvariablen genügen.
	}
};

loadEnv();
