/**
 * Zentraler Fehlervertrag (Issue #1130): Statuscode + Body `{ message }` existieren genau
 * einmal — alle Routen importieren die Helfer von hier, statt lokale Kopien zu pflegen.
 * Der HTTP-Vertrag ist byte-identisch zu den bisherigen Dubletten (siehe error-contract.test.ts).
 */
import type { ErrorRequestHandler, Response } from 'express';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import type { components } from '../api.js';

export type ErrorDto = components['schemas']['Error'];

/** Sammelt die Einzelmeldungen eines Sequelize-Validierungsfehlers. */
const validationMessages = (error: SequelizeValidationError): string[] => error.errors.map((item) => item.message);

/** Schreibt Statuscode und `{ message }`-Body in die Response. */
export function sendError(res: Response<ErrorDto>, status: number, message: string): void {
	res.status(status).json({ message });
}

/** Pfad ohne Query-String für Logs — die Query kann Tokens tragen (z. B. Kündigungs-Link). */
export function logUrl(req: { originalUrl: string }): string {
	return req.originalUrl.split('?')[0];
}

/** Übersetzt Schreibfehler in passende HTTP-Statuscodes (400 bei Validierung, sonst 500). */
export function handleWriteError(res: Response<ErrorDto>, error: unknown): void {
	if (error instanceof SequelizeValidationError) {
		sendError(res, 400, validationMessages(error).join('; '));
		return;
	}
	sendError(res, 500, 'Interner Serverfehler.');
}

/**
 * Globaler Fehlerhandler (#2549 AK1): jeder unbehandelte Routen-Fehler — auch async Rejections
 * (Express 5) und die `next(err)`-Durchreiche des CSRF-Handlers — endet als JSON `{ message }`
 * statt der Express-HTML-Seite und erzeugt genau einen Log-Eintrag mit Methode, Pfad und Fehler.
 * Details bleiben im Log, nie im Body. Fehler MIT Status (Framework: body-parser 400/413) behalten
 * ihren Status auf dem gemeinsamen Vertrag; „nackte" Errors laufen als 500. Mount: letzte
 * Middleware in `createApp`.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
	console.error(`${req.method} ${logUrl(req)}`, error);
	if (res.headersSent) {
		next(error);
		return;
	}
	const status = (error as { status?: unknown }).status ?? (error as { statusCode?: unknown }).statusCode;
	if (typeof status === 'number' && status >= 400 && status <= 599) {
		sendError(res, status, status < 500 ? 'Ungültige Anfrage.' : 'Interner Serverfehler.');
		return;
	}
	sendError(res, 500, 'Interner Serverfehler.');
};

/**
 * Maschinenlesbarer Grund einer paketbedingten Ablehnung (#1456 AK7).
 * @public Vertrag für die Guards aus T2 — in T1 selbst noch ohne Aufrufer.
 */
export type PlanErrorCode = 'plan_required' | 'quota_exhausted';

/**
 * Fehlervertrag für paketbedingte Ablehnungen (#1456 AK7): zusätzlich zu `message` trägt der Body
 * die optionalen Felder `code`, `feature`, `requiredPlan`, `currentPlan`, damit das Frontend einen
 * gezielten Upgrade-Hinweis statt eines generischen Fehlers zeigen kann. `plan_required` gehört zu
 * 403, `quota_exhausted` zu 429 — der Status kommt vom Aufrufer. Alle anderen Fehler nutzen
 * weiterhin `sendError` und bleiben exakt `{ message }`.
 * @public Vertrag für die Guards aus T2 — in T1 selbst noch ohne Aufrufer (nur Tests).
 */
export function sendPlanError(
	res: Response<ErrorDto>,
	status: number,
	message: string,
	fields: { code: PlanErrorCode; feature: string; requiredPlan?: string; currentPlan?: string },
): void {
	const body: ErrorDto = { message, code: fields.code, feature: fields.feature };
	if (fields.requiredPlan !== undefined) {
		body.requiredPlan = fields.requiredPlan;
	}
	if (fields.currentPlan !== undefined) {
		body.currentPlan = fields.currentPlan;
	}
	res.status(status).json(body);
}

/** Pfad-Parameter als positive Ganzzahl parsen; sonst `null`. */
export function parseId(raw: string | string[]): number | null {
	const id = Number(Array.isArray(raw) ? raw[0] : raw);
	return Number.isInteger(id) && id > 0 ? id : null;
}
