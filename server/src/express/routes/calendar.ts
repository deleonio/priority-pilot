import { Router } from 'express';
import type { Request, Response } from 'express';
import sequelize from '../../database.js';
import { sendError, sendPlanError, type ErrorDto } from '../http-error.js';
import { CalendarEvent, CalendarSource, User } from '../../models/index.js';
import { getUserId } from '../requireAuth.js';
import { CALENDAR_SOURCE_LIMIT, PLAN_VALUES, effectivePlan } from '../../logics/plans.js';
import { fetchIcs, parseIcsEvents, replaceCalendarEvents, type ParsedEvent } from '../../logics/calendar-ics.js';
import { fetchCaldavEvents } from '../../logics/calendar-caldav.js';
import { encryptSecret, isSecretKeyConfigured } from '../../logics/secret-crypto.js';

/**
 * Kalenderquellen per ICS-Adresse (#2209): lesend abrufen und die Termine speichern. Hängt hinter
 * dem globalen `requireAuth`; fremde Quellen sind über die `userId`-Bedingung unsichtbar (404,
 * Muster `placeFavorites.ts`). Die Adresse ist geheim und steht in keiner Antwort. CalDAV-Quellen
 * (#2211) bringen Benutzername und App-Passwort mit; das Passwort wird nur verschlüsselt gespeichert,
 * Zugangsdaten stehen ebenfalls in keiner Antwort.
 *
 * Die Anzahl der Quellen ist eine Paketgrenze ({@link CALENDAR_SOURCE_LIMIT}), kein Feature —
 * sie greift deshalb unabhängig vom Rollout-Schalter `MONETIZATION_ENFORCED`.
 */

const MAX_NAME_LENGTH = 100;
const MAX_URL_LENGTH = 2048;
const MAX_CREDENTIAL_LENGTH = 1024;
const DEFAULT_NAME = 'Kalender';

type CalendarSourceDto = { id: number; name: string; type: 'ics' | 'caldav' };
type CalendarEventDto = { sourceId: number; start: string; end: string; title: string; allDay: boolean };

const serializeSource = (source: CalendarSource): CalendarSourceDto => ({
	id: source.id,
	name: source.name,
	type: source.type,
});

const credential = (value: unknown): string =>
	typeof value === 'string' && value.length <= MAX_CREDENTIAL_LENGTH ? value : '';

const serializeEvent = (event: CalendarEvent): CalendarEventDto => ({
	sourceId: event.sourceId,
	start: event.start.toISOString(),
	end: event.end.toISOString(),
	title: event.title,
	allDay: event.allDay,
});

const isHttpUrl = (value: string): boolean => {
	const protocol = value.length <= MAX_URL_LENGTH ? URL.parse(value)?.protocol : undefined;
	return protocol === 'http:' || protocol === 'https:';
};

export const calendarRouter = Router();

// GET /calendar-sources — eigene Quellen, älteste zuerst (ohne Adresse).
calendarRouter.get('/calendar-sources', async (req: Request, res: Response<CalendarSourceDto[] | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const sources = await CalendarSource.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
		res.json(sources.map(serializeSource));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// POST /calendar-sources — Paketgrenze prüfen, sofort abrufen, Quelle + Termine speichern (AK1/AK4);
// CalDAV nur mit Server-Schlüssel (#2211 AK5).
calendarRouter.post('/calendar-sources', async (req: Request, res: Response<CalendarSourceDto | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const body = req.body as
		{ url?: unknown; name?: unknown; type?: unknown; username?: unknown; password?: unknown } | undefined;
	const url = typeof body?.url === 'string' ? body.url.trim() : '';
	if (!isHttpUrl(url)) {
		sendError(res, 400, 'Bitte eine gültige Kalender-Adresse (http oder https) angeben.');
		return;
	}
	const type = body?.type ?? 'ics';
	if (type !== 'ics' && type !== 'caldav') {
		sendError(res, 400, 'Unbekannte Kalender-Art.');
		return;
	}
	const username = type === 'caldav' ? credential(body?.username).trim() : '';
	const password = type === 'caldav' ? credential(body?.password) : '';
	if (type === 'caldav' && (username === '' || password === '')) {
		sendError(res, 400, 'Für CalDAV bitte Benutzername und App-Passwort angeben.');
		return;
	}
	if (type === 'caldav' && !isSecretKeyConfigured()) {
		sendError(
			res,
			400,
			'CalDAV ist auf diesem Server nicht eingerichtet. Verbinde den Kalender über seine ICS-Adresse.',
		);
		return;
	}
	const name = (typeof body?.name === 'string' ? body.name.trim() : '').slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;
	try {
		const plan = effectivePlan((await User.findByPk(userId))?.plan ?? 'free');
		const count = await CalendarSource.count({ where: { userId } });
		if (count >= CALENDAR_SOURCE_LIMIT[plan]) {
			sendPlanError(res, 403, `Dein Paket erlaubt höchstens ${CALENDAR_SOURCE_LIMIT[plan]} Kalender.`, {
				code: 'plan_required',
				feature: 'calendar_sources',
				requiredPlan: PLAN_VALUES.find((candidate) => CALENDAR_SOURCE_LIMIT[candidate] > count),
				currentPlan: plan,
			});
			return;
		}
		let events: ParsedEvent[];
		try {
			events =
				type === 'caldav'
					? await fetchCaldavEvents(url, username, password, new Date())
					: parseIcsEvents(await fetchIcs(url), new Date());
		} catch {
			sendError(res, 400, 'Die Kalender-Adresse ließ sich nicht abrufen.');
			return;
		}
		const source = await sequelize.transaction(async (transaction) => {
			const created = await CalendarSource.create(
				type === 'caldav'
					? { userId, name, url, type, username, passwordEncrypted: encryptSecret(password) }
					: { userId, name, url },
				{ transaction },
			);
			await replaceCalendarEvents(created, events, transaction);
			return created;
		});
		res.status(201).json(serializeSource(source));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// DELETE /calendar-sources/:id — entfernt Quelle samt Zugangsdaten und ihre Termine (AK3, #2211 AK4);
// fremde/unbekannte → 404.
calendarRouter.delete('/calendar-sources/:id', async (req: Request, res: Response<ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	const id = Number(req.params.id);
	try {
		const source = Number.isInteger(id) ? await CalendarSource.findOne({ where: { id, userId } }) : null;
		if (!source) {
			sendError(res, 404, 'Kalender nicht gefunden.');
			return;
		}
		await sequelize.transaction(async (transaction) => {
			await CalendarEvent.destroy({ where: { sourceId: source.id }, transaction });
			await source.destroy({ transaction });
		});
		res.status(204).end();
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// GET /calendar-events — eigene Termine aller Quellen, nach Start sortiert (AK5).
calendarRouter.get('/calendar-events', async (req: Request, res: Response<CalendarEventDto[] | ErrorDto>) => {
	const userId = getUserId(req);
	if (userId === undefined) {
		sendError(res, 401, 'Anmeldung erforderlich.');
		return;
	}
	try {
		const events = await CalendarEvent.findAll({ where: { userId }, order: [['start', 'ASC']] });
		res.json(events.map(serializeEvent));
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
