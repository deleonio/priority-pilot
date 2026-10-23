import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError, type ErrorDto } from '../http-error.js';
import { User } from '../../models/index.js';
import { resolveGeoUser } from './geoConfig.js';

/**
 * Pro-User Push-Gruppen (#2850, docs/push-konzept.md §5): die vier Gruppen-Schalter
 * „Aufgaben und Erinnerungen“, „Erfolge und Rückblicke“, „Gruppen“ und „Tipps und Angebote“
 * (Defaults: drei Gruppen an, Tipps abweichend aus). „Fürsorge“ bleibt der bestehende
 * Schalter `carePushEnabled` an `/care-config` (#1794). Muster: `/split-hint-config` (#1994) —
 * derselbe Nutzer-Auflösungs-Weg inkl. Dev-Pass-Through, bewusst ohne Plan-Gate.
 */

type PushGroupsDto = {
	taskPushEnabled: boolean;
	successPushEnabled: boolean;
	groupPushEnabled: boolean;
	tipPushEnabled: boolean;
};

/** Defaults = Verhalten ohne gespeicherte Werte (§5: drei Gruppen an, Tipps aus). */
const PUSH_GROUPS_DEFAULTS: PushGroupsDto = {
	taskPushEnabled: true,
	successPushEnabled: true,
	groupPushEnabled: true,
	tipPushEnabled: false,
};

/** Alle vier Flags müssen Boolean sein — Verstöße werden nicht persistiert. */
const validatePushGroups = (body: unknown): PushGroupsDto | null => {
	if (typeof body !== 'object' || body === null) return null;
	const { taskPushEnabled, successPushEnabled, groupPushEnabled, tipPushEnabled } = body as Record<string, unknown>;
	if (
		typeof taskPushEnabled !== 'boolean' ||
		typeof successPushEnabled !== 'boolean' ||
		typeof groupPushEnabled !== 'boolean' ||
		typeof tipPushEnabled !== 'boolean'
	) {
		return null;
	}
	return { taskPushEnabled, successPushEnabled, groupPushEnabled, tipPushEnabled };
};

export const pushGroupsRouter = Router();

// GET /push-groups — gespeicherte Gruppen des Users, sonst die Defaults (§5).
pushGroupsRouter.get('/push-groups', async (req: Request, res: Response<PushGroupsDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		res.json({
			taskPushEnabled: user.taskPushEnabled ?? PUSH_GROUPS_DEFAULTS.taskPushEnabled,
			successPushEnabled: user.successPushEnabled ?? PUSH_GROUPS_DEFAULTS.successPushEnabled,
			groupPushEnabled: user.groupPushEnabled ?? PUSH_GROUPS_DEFAULTS.groupPushEnabled,
			tipPushEnabled: user.tipPushEnabled ?? PUSH_GROUPS_DEFAULTS.tipPushEnabled,
		});
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});

// PUT /push-groups — validierte Gruppen speichern; bei Verstoß 400 ohne Persistenz.
pushGroupsRouter.put('/push-groups', async (req: Request, res: Response<PushGroupsDto | ErrorDto>) => {
	try {
		const user = await resolveGeoUser(req);
		if (!user) {
			sendError(res, 401, 'Anmeldung erforderlich.');
			return;
		}
		const groups = validatePushGroups(req.body);
		if (!groups) {
			sendError(res, 400, 'Ungültige Push-Gruppen: alle vier Flags müssen Boolean sein.');
			return;
		}
		await User.update(groups, { where: { id: user.id } });
		res.json(groups);
	} catch {
		sendError(res, 500, 'Interner Serverfehler.');
	}
});
