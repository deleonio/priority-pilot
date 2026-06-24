import assert from 'node:assert/strict';

/**
 * Prüft den **Fehler-Response-Vertrag** des Backends (Issue #117):
 * Jede Fehler-Antwort hat den erwarteten Status **und** einen Body der Form
 * `{ message: string }` mit einer **nicht-leeren** Meldung — damit das Frontend
 * dem Nutzer eine anzeigbare Rückmeldung präsentieren kann.
 *
 * Gibt den geparsten Body zurück, damit Aufrufer die konkrete Meldung weiter
 * prüfen können.
 */
export const expectError = async (res: Response, expectedStatus: number): Promise<{ message: string }> => {
	assert.equal(res.status, expectedStatus, `Erwarteter Status ${expectedStatus}, war ${res.status}`);

	const contentType = res.headers.get('content-type') ?? '';
	assert.ok(contentType.includes('application/json'), `Fehler-Body sollte JSON sein, war "${contentType}"`);

	const body = (await res.json()) as Record<string, unknown>;
	assert.ok(body !== null && typeof body === 'object' && !Array.isArray(body), 'Fehler-Body muss ein Objekt sein');
	assert.equal(typeof body.message, 'string', 'Fehler-Body braucht ein string-Feld "message"');
	assert.ok((body.message as string).trim().length > 0, 'Fehler-Meldung darf nicht leer sein');

	return body as { message: string };
};
