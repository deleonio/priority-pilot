/**
 * Zentraler Fehlervertrag (Issue #1130): Statuscode + Body `{ message }` existieren genau
 * einmal — alle Routen importieren die Helfer von hier, statt lokale Kopien zu pflegen.
 * Der HTTP-Vertrag ist byte-identisch zu den bisherigen Dubletten (siehe error-contract.test.ts).
 */
import type { Response } from 'express';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import type { components } from '../api.js';

type ErrorDto = components['schemas']['Error'];

/** Sammelt die Einzelmeldungen eines Sequelize-Validierungsfehlers. */
const validationMessages = (error: SequelizeValidationError): string[] => {
	const raw: unknown = error.errors.length > 0 ? error.errors : error.message;
	const items: unknown[] = Array.isArray(raw) ? raw : [];
	return items
		.map((item) => (typeof item === 'object' && item !== null && 'message' in item ? item.message : item))
		.map((message) => (typeof message === 'string' ? message : ''))
		.filter((message) => message !== '');
};

/** Schreibt Statuscode und `{ message }`-Body in die Response. */
export function sendError(res: Response<ErrorDto>, status: number, message: string): void {
	res.status(status).json({ message });
}

/** Übersetzt Schreibfehler in passende HTTP-Statuscodes (400 bei Validierung, sonst 500). */
export function handleWriteError(res: Response<ErrorDto>, error: unknown): void {
	if (error instanceof SequelizeValidationError) {
		sendError(res, 400, validationMessages(error).join('; '));
		return;
	}
	sendError(res, 500, 'Interner Serverfehler.');
}

/** Pfad-Parameter als positive Ganzzahl parsen; sonst `null`. */
export function parseId(raw: string | string[]): number | null {
	const id = Number(Array.isArray(raw) ? raw[0] : raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}
