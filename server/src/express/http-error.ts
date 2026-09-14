/**
 * Zentraler Fehlervertrag (Issue #1130): Statuscode + Body `{ message }` existieren genau
 * einmal — alle Routen importieren die Helfer von hier, statt lokale Kopien zu pflegen.
 * Der HTTP-Vertrag ist byte-identisch zu den bisherigen Dubletten (siehe error-contract.test.ts).
 */
import type { Response } from 'express';
import { ValidationError as SequelizeValidationError } from 'sequelize';
import type { components } from '../api.js';

export type ErrorDto = components['schemas']['Error'];

/** Sammelt die Einzelmeldungen eines Sequelize-Validierungsfehlers. */
const validationMessages = (error: SequelizeValidationError): string[] => error.errors.map((item) => item.message);

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
