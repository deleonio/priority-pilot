import type { Request } from 'express';
import type { UserRole } from '../models/user.js';
import type { Plan } from '../logics/plans.js';

/** Nutzer-Snapshot, den ein erfolgreicher Login in die Session schreibt. */
export interface SessionUserInput {
	id: number;
	email: string;
	displayName: string;
	avatarUrl?: string | null;
	role: UserRole;
	plan: Plan;
}

/**
 * Meldet `user` in einer frisch regenerierten Session an — gemeinsamer Abschluss für Google-Callback
 * und Magic-Link-Einlösung, damit der Session-Snapshot nur an einer Stelle gepflegt wird.
 * `regenerate()` verhindert Session-Fixation: neue Session-ID vor dem Setzen des Users.
 * `done` erhält einen Fehler, wenn Regenerieren oder Speichern scheitert.
 */
export const establishSession = (req: Request, user: SessionUserInput, done: (err?: unknown) => void): void => {
	req.session.regenerate((regenerateErr) => {
		if (regenerateErr) {
			done(regenerateErr);
			return;
		}
		req.session.user = {
			id: user.id,
			email: user.email,
			displayName: user.displayName,
			avatarUrl: user.avatarUrl ?? null,
			role: user.role,
			// #1456: Paket wie die Rolle eager in den Snapshot — sonst sieht ein Guard, der
			// `req.session.user.plan` direkt liest, bis zum ersten `/auth/me` `undefined`.
			plan: user.plan,
		};
		req.session.save((saveErr) => done(saveErr ?? undefined));
	});
};
